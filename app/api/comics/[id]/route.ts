import { NextResponse } from "next/server";
import { comicInclude, prisma } from "@/lib/prisma";
import { comicJobs } from "@/lib/jobs";

// GET /api/comics/:id — un comic con sus escenas
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const comic = await prisma.comic.findUnique({
    where: { id: params.id },
    include: comicInclude,
  });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const spent = await prisma.cost.aggregate({ where: { comicId: comic.id }, _sum: { amountUsd: true } });
  return NextResponse.json({ ...comic, costUsd: spent._sum.amountUsd ?? 0, jobs: comicJobs(comic.id) });
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
    "voiceId",
    "voiceSpeed",
    "videoDuration",
    "videoTransition",
    "animateCharacters",
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
  if ("voiceSpeed" in data) data.voiceSpeed = Math.min(1.4, Math.max(0.8, Number(data.voiceSpeed) || 1.15));
  if ("videoDuration" in data) data.videoDuration = Math.round(Math.min(10, Math.max(0, Number(data.videoDuration) || 0)));

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
