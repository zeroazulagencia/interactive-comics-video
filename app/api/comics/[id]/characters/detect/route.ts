import { NextResponse } from "next/server";
import { comicInclude, prisma } from "@/lib/prisma";
import { detectCast, TEXT_MODEL } from "@/lib/openai";
import { recordCost } from "@/lib/costs";
import { idsFor } from "@/lib/cast";

export const maxDuration = 120;

// POST /api/comics/:id/characters/detect — deduce el elenco de las escenas ya
// escritas y lo asigna a cada panel. Conserva los personajes con el mismo nombre.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const comic = await prisma.comic.findUnique({ where: { id: params.id }, include: comicInclude });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (comic.scenes.length === 0) {
    return NextResponse.json({ error: "El proyecto no tiene escenas." }, { status: 400 });
  }

  try {
    const { cast, panelCast, costUsd } = await detectCast(
      comic.scenes.map((s) => ({ narration: s.narration ?? "", imagePrompts: s.panels.map((p) => p.imagePrompt ?? "") })),
      comic.artStyle ?? ""
    );
    await recordCost({ comicId: comic.id, kind: "guion", provider: "openai", model: TEXT_MODEL, amountUsd: costUsd });

    await prisma.$transaction(async (tx) => {
      const byName = new Map(comic.characters.map((c) => [c.name.toLowerCase(), c.id]));
      let order = comic.characters.reduce((m, c) => Math.max(m, c.order), 0);
      for (const c of cast) {
        if (byName.has(c.name.toLowerCase())) continue;
        const created = await tx.character.create({
          data: { comicId: comic.id, order: ++order, name: c.name, description: c.description },
        });
        byName.set(c.name.toLowerCase(), created.id);
      }
      for (const [i, s] of comic.scenes.entries()) {
        for (const [k, panel] of s.panels.slice(0, 2).entries()) {
          await tx.panel.update({
            where: { id: panel.id },
            data: { characters: { set: idsFor(panelCast[i]?.[k] ?? [], byName) } },
          });
        }
      }
    });

    const updated = await prisma.comic.findUnique({ where: { id: comic.id }, include: comicInclude });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error detectando el elenco";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
