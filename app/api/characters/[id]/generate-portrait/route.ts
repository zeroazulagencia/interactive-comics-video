import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/paths";
import { generateImage, IMAGE_MODEL } from "@/lib/openai";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";
import { portraitPrompt } from "@/lib/cast";

export const maxDuration = 120;

// POST /api/characters/:id/generate-portrait — retrato de referencia del personaje
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const character = await prisma.character.findUnique({ where: { id: params.id }, include: { comic: true } });
  if (!character) {
    return NextResponse.json({ error: "Personaje no encontrado" }, { status: 404 });
  }
  if (!character.description.trim()) {
    return NextResponse.json({ error: "Describe primero el aspecto del personaje." }, { status: 400 });
  }

  if (!startJob(character.id, character.comicId, "retrato")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const { b64, costUsd } = await generateImage(portraitPrompt(character, character.comic.artStyle), "1024x1024");
    await recordCost({
      comicId: character.comicId,
      kind: "retrato",
      provider: "openai",
      model: IMAGE_MODEL,
      amountUsd: costUsd,
    });

    await mkdir(MEDIA_DIR, { recursive: true });
    const filename = `${character.id}-${Date.now()}.png`;
    await writeFile(path.join(MEDIA_DIR, filename), Buffer.from(b64, "base64"));

    const updated = await prisma.character.update({
      where: { id: character.id },
      data: { imageUrl: `/generated/${filename}` },
    });
    finishJob(character.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando el retrato";
    finishJob(character.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
