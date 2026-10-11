import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateVoice, MODEL as VOICE_MODEL } from "@/lib/replicate";
import { recordCost } from "@/lib/costs";

export const maxDuration = 120;

// POST /api/scenes/:id/generate-voice — narra el texto con Replicate (minimax/speech-02-hd)
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const scene = await prisma.scene.findUnique({ where: { id: params.id } });
  if (!scene) {
    return NextResponse.json({ error: "Escena no encontrada" }, { status: 404 });
  }
  if (!scene.narration?.trim()) {
    return NextResponse.json(
      { error: "Esta escena no tiene narración." },
      { status: 400 }
    );
  }

  try {
    const { url: audioSourceUrl, costUsd } = await generateVoice(scene.narration);
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

    const dir = path.join(process.cwd(), "public", "generated");
    await mkdir(dir, { recursive: true });
    const filename = `${scene.id}-${Date.now()}.mp3`;
    await writeFile(path.join(dir, filename), buffer);

    const audioUrl = `/generated/${filename}`;
    const [updated] = await prisma.$transaction([
      prisma.scene.update({
        where: { id: scene.id },
        data: { audioUrl },
      }),
      prisma.comic.update({
        where: { id: scene.comicId },
        data: { finalVideoOutdated: true },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la voz";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
