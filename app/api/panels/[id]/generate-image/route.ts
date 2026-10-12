import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/paths";
import { generateImage, imageSizeFor, IMAGE_MODEL } from "@/lib/openai";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";

export const maxDuration = 120;

// POST /api/panels/:id/generate-image — genera la ilustración con gpt-image-1
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const panel = await prisma.panel.findUnique({
    where: { id: params.id },
    include: { scene: { include: { comic: true } } },
  });
  if (!panel) {
    return NextResponse.json({ error: "Panel no encontrado" }, { status: 404 });
  }
  if (!panel.imagePrompt?.trim()) {
    return NextResponse.json(
      { error: "Este panel no tiene prompt de ilustración." },
      { status: 400 }
    );
  }

  if (!startJob(panel.id, panel.scene.comicId, "ilustracion")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const size = imageSizeFor(panel.scene.comic.aspectRatio);
    const { b64, costUsd } = await generateImage(panel.imagePrompt, size);
    await recordCost({
      comicId: panel.scene.comicId,
      kind: "ilustracion",
      provider: "openai",
      model: IMAGE_MODEL,
      amountUsd: costUsd,
    });

    const dir = MEDIA_DIR;
    await mkdir(dir, { recursive: true });
    const filename = `${panel.id}-${Date.now()}.png`;
    await writeFile(path.join(dir, filename), Buffer.from(b64, "base64"));

    const imageUrl = `/generated/${filename}`;
    const [updated] = await prisma.$transaction([
      prisma.panel.update({
        where: { id: panel.id },
        data: { imageUrl, videoUrl: null },
      }),
      prisma.comic.update({
        where: { id: panel.scene.comicId },
        data: { finalVideoOutdated: true },
      }),
    ]);
    finishJob(panel.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la imagen";
    finishJob(panel.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
