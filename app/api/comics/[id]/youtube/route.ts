import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateYoutubeMeta } from "@/lib/openai";

export const maxDuration = 120;

// POST /api/comics/:id/youtube — genera título, descripción y etiquetas para YouTube
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const comic = await prisma.comic.findUnique({
    where: { id: params.id },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const narrations = comic.scenes.map((s) => s.narration?.trim() ?? "").filter(Boolean);
  if (narrations.length === 0) {
    return NextResponse.json({ error: "El proyecto no tiene narración." }, { status: 400 });
  }

  try {
    const meta = await generateYoutubeMeta({
      title: comic.title,
      author: comic.author || "Cristian Parada",
      prompt: comic.prompt ?? "",
      narrations,
      vertical: comic.aspectRatio === "vertical",
    });
    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: {
        youtubeTitle: meta.title,
        youtubeDescription: meta.description,
        youtubeTags: meta.tags.join(", "),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando el texto para YouTube";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
