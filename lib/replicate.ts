// Cliente mínimo de Replicate vía fetch (sin SDK).
// Narración con minimax/speech-02-hd: voz profunda/madura en español (no ibérico).
// Animación con prunaai/p-video: image-to-video de alta calidad.
// Fallback: wan-video/wan2.1-with-lora.

const API = "https://api.replicate.com/v1";
const MODEL = "minimax/speech-02-hd";
// Modelo oficial de prunaai/p-video (image-to-video)
const VIDEO_MODEL = "prunaai/p-video";
// Modelo comunitario (no oficial): requiere fijar el hash de versión y usar
// POST /v1/predictions, ya que el atajo /models/{owner}/{name}/predictions
// solo existe para modelos oficiales.
const VIDEO_MODEL_VERSION = "c48fa8ec65b13143cb552ab98ea17984eab9d70e9fe99479117de40a2a7f9ed0";
// meta/musicgen (también comunitario, requiere version fija).
const MUSIC_MODEL_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

export const VOICE_ID = process.env.REPLICATE_VOICE_ID ?? "Spanish_ReliableMan";

// wan2.1-with-lora solo acepta estos valores de "frames" (a 16fps: ~1 a ~5s).
export const VIDEO_FRAME_OPTIONS = [17, 33, 49, 65, 81] as const;
export type VideoFrames = (typeof VIDEO_FRAME_OPTIONS)[number];

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) throw new Error("Falta REPLICATE_API_TOKEN en .env");
  return t;
}

type Prediction = {
  status: string;
  output: unknown;
  error: string | null;
  urls: { get: string };
};

// Crea una predicción fijada a una versión (modelos comunitarios) y espera a que
// termine (polling), para modelos que tardan más de lo que el header
// "Prefer: wait" puede bloquear de forma síncrona.
async function runVersionAndPoll(
  version: string,
  input: Record<string, unknown>,
  { pollMs = 3000, maxWaitMs = 5 * 60 * 1000 } = {}
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API}/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ version, input }),
    });
  } catch (e) {
    const cause =
      e instanceof Error && e.cause
        ? ` (causa: ${String((e.cause as { message?: string })?.message ?? e.cause)})`
        : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo conectar con Replicate: ${msg}${cause}`);
  }

  let data: Prediction = await res.json();
  if (!res.ok) {
    throw new Error(`Replicate (${version}) ${res.status}: ${JSON.stringify(data)}`);
  }

  const start = Date.now();
  while (data.status !== "succeeded" && data.status !== "failed" && data.status !== "canceled") {
    if (Date.now() - start > maxWaitMs) {
      throw new Error(`Replicate (${version}) no terminó a tiempo (status: ${data.status}).`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
    const poll = await fetch(data.urls.get, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    data = await poll.json();
  }

  if (data.status !== "succeeded" || !data.output) {
    throw new Error(`Replicate (${version}) ${data.status}: ${data.error ?? "sin salida"}`);
  }
  return data.output;
}

// Genera narración a partir de texto y devuelve la URL temporal del audio (mp3).
export async function generateVoice(text: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          text,
          voice_id: VOICE_ID,
          language_boost: "Spanish",
          emotion: "neutral",
          speed: 1.15,
          audio_format: "mp3",
        },
      }),
    });
  } catch (e) {
    const cause =
      e instanceof Error && e.cause
        ? ` (causa: ${String((e.cause as { message?: string })?.message ?? e.cause)})`
        : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo conectar con Replicate: ${msg}${cause}`);
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Replicate (${MODEL}) ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  }
  if (data.status !== "succeeded" || !data.output) {
    throw new Error(`Replicate no devolvió audio (status: ${data.status}).`);
  }
  return data.output as string;
}

export type VideoAspectRatio = "16:9" | "9:16";

// Anima una imagen con prunaai/p-video (image-to-video de alta calidad).
// Parámetros: duración en segundos, resolución 720p, fps 24.
// Retorna la URL pública del mp4.
export async function generateVideo(
  imageDataUri: string,
  prompt: string,
  duration: number,
  aspectRatio: VideoAspectRatio = "16:9"
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API}/models/${VIDEO_MODEL}/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          image: imageDataUri,
          prompt,
          duration: Math.max(1, Math.min(20, Math.round(duration))),
          fps: 24,
          resolution: "720p",
          disable_safety_filter: true,
          prompt_upsampling: true,
        },
      }),
    });
  } catch (e) {
    const cause =
      e instanceof Error && e.cause
        ? ` (causa: ${String((e.cause as { message?: string })?.message ?? e.cause)})`
        : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo conectar con Replicate: ${msg}${cause}`);
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Replicate (${VIDEO_MODEL}) ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  }
  if (data.status !== "succeeded" || !data.output) {
    throw new Error(`Replicate (${VIDEO_MODEL}) no devolvió video (status: ${data.status}).`);
  }
  const url = Array.isArray(data.output) ? data.output[0] : data.output;
  if (typeof url !== "string") throw new Error("Replicate no devolvió un video válido.");
  return url;
}

// Fallback: wan-video/wan2.1-with-lora (modelo comunitario, requiere version hash).
export async function generateVideoFallback(
  imageDataUri: string,
  prompt: string,
  frames: number,
  aspectRatio: VideoAspectRatio = "16:9"
): Promise<string> {
  const output = await runVersionAndPoll(VIDEO_MODEL_VERSION, {
    image: imageDataUri,
    prompt,
    frames,
    model: "14b",
    resolution: "480p",
    aspect_ratio: aspectRatio,
    // Default del modelo es 5. Lo dejamos en 5 para evitar alucinaciones
    // (valores altos fuerzan al modelo a inventar movimiento donde no hay).
    sample_guide_scale: 5,
  });
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== "string") throw new Error("Replicate no devolvió un video válido.");
  return url;
}

// Genera música instrumental de fondo (meta/musicgen) y devuelve la URL del audio.
export async function generateMusic(prompt: string, durationSeconds: number): Promise<string> {
  const output = await runVersionAndPoll(MUSIC_MODEL_VERSION, {
    prompt,
    duration: durationSeconds,
    model_version: "stereo-melody-large",
    output_format: "mp3",
    normalization_strategy: "loudness",
  });
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== "string") throw new Error("Replicate no devolvió música válida.");
  return url;
}
