import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { MEDIA_DIR } from "@/lib/paths";
import { generateVoice, MODEL as VOICE_MODEL } from "@/lib/replicate";
import { recordCost } from "@/lib/costs";
import { finishJob, JOB_BUSY, startJob } from "@/lib/jobs";
import { voiceKey } from "@/lib/voices";

export const maxDuration = 120;

// POST /api/scenes/:id/generate-voice — narra el texto con la voz del proyecto (minimax/speech-02-hd)
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const scene = await prisma.scene.findUnique({ where: { id: params.id }, include: { comic: true } });
  if (!scene) {
    return NextResponse.json({ error: "Escena no encontrada" }, { status: 404 });
  }
  if (!scene.narration?.trim()) {
    return NextResponse.json(
      { error: "Esta escena no tiene narración." },
      { status: 400 }
    );
  }

  if (!startJob(scene.id, scene.comicId, "voz")) {
    return NextResponse.json(JOB_BUSY, { status: 409 });
  }
  try {
    const voice = { voiceId: scene.comic.voiceId, speed: scene.comic.voiceSpeed };
    const { url: audioSourceUrl, costUsd } = await generateVoice(scene.narration, voice);
    await recordCost({
      comicId: scene.comicId,
      kind: "voz",
      provider: "replicate",
      model: VOICE_MODEL,
      amountUsd: costUsd,
    });

    const audioRes = await fetch(audioSourceUrl);
    if (!audioRes.ok) throw new Error("No se pudo descargar el audio generado.");
    const buffer = Buffer.from(await audioRes.arrayBuffer());

    const dir = MEDIA_DIR;
    await mkdir(dir, { recursive: true });
    const filename = `${scene.id}-${Date.now()}.mp3`;
    await writeFile(path.join(dir, filename), buffer);

    const audioUrl = `/generated/${filename}`;
    const [updated] = await prisma.$transaction([
      prisma.scene.update({
        where: { id: scene.id },
        data: { audioUrl, audioVoice: voiceKey(voice.voiceId, voice.speed) },
      }),
      prisma.comic.update({
        where: { id: scene.comicId },
        data: { finalVideoOutdated: true },
      }),
    ]);
    finishJob(scene.id);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la voz";
    finishJob(scene.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
