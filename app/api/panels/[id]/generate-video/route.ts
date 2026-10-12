import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR, mediaPath } from "@/lib/paths";
import { generateVideo, VIDEO_MODEL } from "@/lib/replicate";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";

export const maxDuration = 300;

// POST /api/panels/:id/generate-video — anima la ilustración con prunaai/p-video
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const panel = await prisma.panel.findUnique({
    where: { id: params.id },
    include: { scene: { include: { comic: true } } },
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
  const duration = Math.max(1, Math.min(20, body.duration ?? 5));
  const aspectRatio = panel.scene.comic.aspectRatio === "vertical" ? "9:16" : "16:9";
  const motionStyle = panel.scene.comic.motionStyle?.trim();
  const prompt = motionStyle ? `${panel.videoPrompt}. Animation style: ${motionStyle}` : panel.videoPrompt;

  if (!startJob(panel.id, panel.scene.comicId, "animacion")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const imagePath = mediaPath(panel.imageUrl);
    const imageBuffer = await readFile(imagePath);
    const mime = panel.imageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
    const imageDataUri = `data:${mime};base64,${imageBuffer.toString("base64")}`;

    const { url: videoSourceUrl, costUsd } = await generateVideo(imageDataUri, prompt, duration, aspectRatio);
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
        data: { videoUrl },
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
