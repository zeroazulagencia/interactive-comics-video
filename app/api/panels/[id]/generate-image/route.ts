import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/paths";
import { generateImage, imageSizeFor, IMAGE_MODEL } from "@/lib/openai";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";
import { panelPrompt, readRef } from "@/lib/cast";

export const maxDuration = 120;

// POST /api/panels/:id/generate-image — genera la ilustración; los retratos del
// elenco que aparece en el panel se envían como referencia.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const panel = await prisma.panel.findUnique({
    where: { id: params.id },
    include: { scene: { include: { comic: true } }, characters: { orderBy: { order: "asc" } } },
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

  const missing = panel.characters.filter((c) => !c.imageUrl).map((c) => c.name);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Genera primero el retrato de ${missing.join(", ")} en el Elenco.` },
      { status: 400 }
    );
  }

  if (!startJob(panel.id, panel.scene.comicId, "ilustracion")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const size = imageSizeFor(panel.scene.comic.aspectRatio);
    const refs = await Promise.all(panel.characters.map((c) => readRef(c.imageUrl!)));
    const { b64, costUsd } = await generateImage(panelPrompt(panel.imagePrompt, panel.characters), size, refs);
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
        data: { imageUrl, videoUrl: null, videoDraft: false },
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
