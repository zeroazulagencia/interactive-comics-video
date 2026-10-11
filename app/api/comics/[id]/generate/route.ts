import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateScenes } from "@/lib/openai";

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
    const { scenes, musicPrompt } = await generateScenes(comic.prompt, comic.artStyle ?? "");

    // Reemplaza las escenas anteriores en una sola transacción: si algo falla,
    // se conservan las existentes.
    await prisma.$transaction([
      prisma.scene.deleteMany({ where: { comicId: comic.id } }),
      ...scenes.map((s, i) => {
        const [p1, p2] = s.imagePrompts;
        const [v1, v2] = s.videoPrompts;
        return prisma.scene.create({
          data: {
            comicId: comic.id,
            order: i + 1,
            title: s.title || `Escena ${i + 1}`,
            summary: s.summary,
            narration: s.narration,
            panels: {
              create: [
                { order: 1, imagePrompt: p1, videoPrompt: v1 },
                { order: 2, imagePrompt: p2, videoPrompt: v2 },
              ],
            },
          },
        });
      }),
      prisma.comic.update({
        where: { id: comic.id },
        data: { finalVideoOutdated: true, musicPrompt: musicPrompt || null },
      }),
    ]);

    const updated = await prisma.comic.findUnique({
      where: { id: comic.id },
      include: {
        scenes: {
          orderBy: { order: "asc" },
          include: { panels: { orderBy: { order: "asc" } } },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando escenas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
