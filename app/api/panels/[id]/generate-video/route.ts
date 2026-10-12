import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR, mediaPath } from "@/lib/paths";
import { generateVideo, VIDEO_MODEL } from "@/lib/replicate";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";
import { ffprobeDuration } from "@/lib/ffmpeg";
import { autoClipSeconds } from "@/lib/comic";

export const maxDuration = 300;

// POST /api/panels/:id/generate-video — anima la ilustración con prunaai/p-video.
// Body opcional: { duration?: segundos, draft?: boolean }. Sin duration usa la del
// panel, la del proyecto o la automática (según la narración).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const panel = await prisma.panel.findUnique({
    where: { id: params.id },
    include: { scene: { include: { comic: true, panels: { orderBy: { order: "asc" } } } } },
  });
  if (!panel) {
    return NextResponse.json({ error: "Panel no encontrado" }, { status: 404 });
  }
  if (!panel.imageUrl) {
    return NextResponse.json(
      { error: "Genera primero la ilustración de este panel." },
      { status: 400 }
    );
  }
  if (!panel.videoPrompt?.trim()) {
    return NextResponse.json(
      { error: "Este panel no tiene prompt de animación." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const comic = panel.scene.comic;
  const draft = body.draft === true;
  const motionStyle = comic.motionStyle?.trim();
  // Transición: el clip del primer panel termina en la ilustración del siguiente.
  const next = panel.scene.panels.find((p) => p.order > panel.order && p.imageUrl);
  const lastFrameUrl = comic.videoTransition && next ? next.imageUrl : null;
  // Sin esta indicación, p-video corta a otro plano cuando el prompt describe
  // solo el ambiente (por ejemplo, la cuerda y las tablas en vez de los personajes).
  const prompt = [
    panel.videoPrompt,
    motionStyle ? `Animation style: ${motionStyle}` : "",
    comic.animateCharacters
      ? "Characters may move subtly and naturally (breathing, blinking, small gestures) while their faces and bodies stay consistent"
      : "",
    lastFrameUrl
      ? "One single continuous shot that starts exactly on the input image and moves smoothly into the final image. No cuts, no jumps"
      : "One single continuous shot that starts exactly on the input image and keeps its composition, characters and framing. No cuts, no scene changes, no new shots",
  ]
    .filter(Boolean)
    .join(". ");

  if (!startJob(panel.id, panel.scene.comicId, "animacion")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const duration = Number(body.duration) || panel.duration || comic.videoDuration || (await autoDuration(panel.scene));
    const { url: videoSourceUrl, costUsd } = await generateVideo(await dataUri(panel.imageUrl), prompt, duration, {
      draft,
      lastFrameDataUri: lastFrameUrl ? await dataUri(lastFrameUrl) : undefined,
      promptUpsampling: false,
    });
    await recordCost({
      comicId: panel.scene.comicId,
      kind: "animacion",
      provider: "replicate",
      model: VIDEO_MODEL,
      amountUsd: costUsd,
    });

    const videoRes = await fetch(videoSourceUrl);
    if (!videoRes.ok) throw new Error("No se pudo descargar el video generado.");
    const buffer = Buffer.from(await videoRes.arrayBuffer());

    const dir = MEDIA_DIR;
    await mkdir(dir, { recursive: true });
    const filename = `${panel.id}-${Date.now()}.mp4`;
    await writeFile(path.join(dir, filename), buffer);

    const videoUrl = `/generated/${filename}`;
    const [updated] = await prisma.$transaction([
      prisma.panel.update({
        where: { id: panel.id },
        data: { videoUrl, videoDraft: draft },
      }),
      prisma.comic.update({
        where: { id: panel.scene.comicId },
        data: { finalVideoOutdated: true },
      }),
    ]);
    finishJob(panel.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando el video";
    finishJob(panel.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function dataUri(url: string): Promise<string> {
  const buffer = await readFile(mediaPath(url));
  const mime = url.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function autoDuration(scene: { audioUrl: string | null; narration: string | null }): Promise<number> {
  const audioSeconds = scene.audioUrl ? await ffprobeDuration(mediaPath(scene.audioUrl)).catch(() => null) : null;
  return autoClipSeconds(audioSeconds, scene.narration);
}
