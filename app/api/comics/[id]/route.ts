import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/comics/:id — un comic con sus escenas
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const comic = await prisma.comic.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: { panels: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json(comic);
}

// PATCH /api/comics/:id — actualiza título, prompt, estilo
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of [
    "title",
    "prompt",
    "artStyle",
    "motionStyle",
    "published",
    "author",
    "subtitlesEnabled",
    "musicPrompt",
    "youtubeTitle",
    "youtubeDescription",
    "youtubeTags",
  ]) {
    if (k in body) data[k] = body[k];
  }

  const current = await prisma.comic.findUnique({ where: { id: params.id } });
  if (!current) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  // Campos que aparecen en el video final (tarjetas de título, subtítulos y música).
  const affectsVideo = (["title", "author", "subtitlesEnabled", "musicPrompt"] as const).some(
    (k) => k in data && data[k] !== current[k]
  );
  if (affectsVideo) data.finalVideoOutdated = true;

  const comic = await prisma.comic.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(comic);
}

// DELETE /api/comics/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.comic.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
