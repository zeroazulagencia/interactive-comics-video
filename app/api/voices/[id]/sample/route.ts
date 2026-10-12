import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { MEDIA_DIR } from "@/lib/paths";
import { generateVoice, MODEL as VOICE_MODEL } from "@/lib/replicate";
import { recordCost } from "@/lib/costs";
import { DEFAULT_VOICE_SPEED, VOICE_SAMPLE_TEXT, VOICES } from "@/lib/voices";

export const maxDuration = 120;

// GET /api/voices/:id/sample — muestra de la voz. Se genera una sola vez y se
// guarda; la velocidad se ajusta al reproducir.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!VOICES.some((v) => v.id === params.id)) {
    return NextResponse.json({ error: "Voz desconocida" }, { status: 404 });
  }
  const filename = `voice-sample-${params.id}.mp3`;
  const file = path.join(MEDIA_DIR, filename);
  const url = `/generated/${filename}`;
  if (existsSync(file)) return NextResponse.json({ url });

  try {
    const { url: source, costUsd } = await generateVoice(VOICE_SAMPLE_TEXT, {
      voiceId: params.id,
      speed: DEFAULT_VOICE_SPEED,
    });
    await recordCost({ comicId: null, kind: "voz", provider: "replicate", model: VOICE_MODEL, amountUsd: costUsd });
    const res = await fetch(source);
    if (!res.ok) throw new Error("No se pudo descargar la muestra.");
    await mkdir(MEDIA_DIR, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la muestra";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
