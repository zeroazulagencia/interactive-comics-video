import { NextResponse } from "next/server";
import { comicInclude, prisma } from "@/lib/prisma";
import { idsFor } from "@/lib/cast";
import { generateScenes, TEXT_MODEL } from "@/lib/openai";
import { recordCost } from "@/lib/costs";

export const maxDuration = 120;

// POST /api/comics/:id/generate — genera escenas con gpt-5.5 y reemplaza las existentes
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const comic = await prisma.comic.findUnique({ where: { id: params.id } });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!comic.prompt?.trim()) {
    return NextResponse.json(
      { error: "Escribe primero un prompt / idea para el comic." },
      { status: 400 }
    );
  }

  try {
    const { cast, scenes, musicPrompt, costUsd } = await generateScenes(
      comic.prompt,
      comic.artStyle ?? "",
      comic.motionStyle ?? "",
      comic.animateCharacters
    );
    await recordCost({ comicId: comic.id, kind: "guion", provider: "openai", model: TEXT_MODEL, amountUsd: costUsd });

    // Reemplaza escenas y elenco anteriores en una sola transacción: si algo
    // falla, se conservan los existentes.
    await prisma.$transaction(async (tx) => {
      await tx.scene.deleteMany({ where: { comicId: comic.id } });
      await tx.character.deleteMany({ where: { comicId: comic.id } });
      const byName = new Map<string, string>();
      for (const [i, c] of cast.entries()) {
        const created = await tx.character.create({
          data: { comicId: comic.id, order: i + 1, name: c.name, description: c.description },
        });
        byName.set(c.name.toLowerCase(), created.id);
      }
      for (const [i, s] of scenes.entries()) {
        const [p1, p2] = s.imagePrompts;
        const [v1, v2] = s.videoPrompts;
        const [c1, c2] = s.panelCast;
        await tx.scene.create({
          data: {
            comicId: comic.id,
            order: i + 1,
            title: s.title || `Escena ${i + 1}`,
            summary: s.summary,
            narration: s.narration,
            panels: {
              create: [
                { order: 1, imagePrompt: p1, videoPrompt: v1, characters: { connect: idsFor(c1, byName) } },
                { order: 2, imagePrompt: p2, videoPrompt: v2, characters: { connect: idsFor(c2, byName) } },
              ],
            },
          },
        });
      }
      await tx.comic.update({
        where: { id: comic.id },
        data: { finalVideoOutdated: true, musicPrompt: musicPrompt || null },
      });
    });

    const updated = await prisma.comic.findUnique({ where: { id: comic.id }, include: comicInclude });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando escenas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
