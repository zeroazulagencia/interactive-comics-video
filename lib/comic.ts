// Tipos y utilidades compartidas por la interfaz (sin dependencias de servidor).

import { DEFAULT_VOICE_ID, DEFAULT_VOICE_SPEED, voiceKey } from "@/lib/voices";

export type Panel = {
  id: string;
  order: number;
  imagePrompt: string | null;
  imageUrl: string | null;
  videoPrompt: string | null;
  videoUrl: string | null;
  videoDraft: boolean;
  duration: number | null;
  characters: { id: string }[];
};

export type Character = {
  id: string;
  order: number;
  name: string;
  description: string;
  imageUrl: string | null;
};

export type Scene = {
  id: string;
  order: number;
  title: string | null;
  summary: string | null;
  narration: string | null;
  audioUrl: string | null;
  audioVoice: string | null;
  panels: Panel[];
};

export type JobKind = "voz" | "retrato" | "ilustracion" | "animacion" | "mezcla";

// Generaciones en curso y fallos recientes, por id de escena, panel o comic.
export type ComicJobs = { running: Record<string, JobKind>; errors: Record<string, string> };

export type Comic = {
  id: string;
  title: string;
  author: string | null;
  subtitlesEnabled: boolean;
  prompt: string | null;
  artStyle: string | null;
  motionStyle: string | null;
  voiceId: string;
  voiceSpeed: number;
  videoDuration: number;
  videoTransition: boolean;
  animateCharacters: boolean;
  aspectRatio: string;
  finalVideoUrl: string | null;
  finalVideoOutdated: boolean;
  musicPrompt: string | null;
  youtubeTitle: string | null;
  youtubeDescription: string | null;
  youtubeTags: string | null;
  scenes: Scene[];
  characters: Character[];
  costUsd?: number; // gasto registrado en APIs (GET /api/comics/:id)
  jobs?: ComicJobs;
};

// Resumen que devuelve GET /api/comics para la página de inicio.
export type ComicSummary = {
  id: string;
  title: string;
  aspectRatio: string;
  finalVideoUrl: string | null;
  finalVideoOutdated: boolean;
  updatedAt: string;
  sceneCount: number;
  coverImage: string | null;
  done: number;
  total: number;
  costUsd: number; // gasto registrado en APIs para este proyecto
};

// Saldo estimado de un proveedor: saldo ingresado menos lo gastado desde entonces.
export type ProviderBalance = {
  provider: "openai" | "replicate";
  amountUsd: number | null; // null si no se ha ingresado saldo
  setAt: string | null;
  spentSinceUsd: number;
  remainingUsd: number | null;
  avgPerVideoUsd: number | null; // gasto promedio de este proveedor por video terminado
};

// Resumen que devuelve GET /api/costs para la página de inicio.
export type CostSummary = {
  videoCount: number; // proyectos con video final y costos registrados
  avgPerVideoUsd: number | null;
  totalSpentUsd: number;
  providers: ProviderBalance[];
  videosLeft: number | null; // videos que alcanzan con el saldo estimado
};

// Desglose de costos de un proyecto (GET /api/comics/:id/costs).
export type CostBreakdown = {
  totalUsd: number;
  byKind: { kind: string; amountUsd: number; count: number }[];
};

export const COST_KIND_LABELS: Record<string, string> = {
  guion: "Guion",
  voz: "Voces",
  retrato: "Retratos",
  ilustracion: "Ilustraciones",
  animacion: "Animaciones",
  musica: "Música",
  youtube: "Texto YouTube",
};

export function formatUsd(n: number): string {
  return `US$ ${n.toFixed(2)}`;
}

export const DEFAULT_AUTHOR = "Cristian Parada";

// Duración automática de cada clip: la mitad de la narración (cada escena tiene
// 2 paneles), entre 3 y 8 segundos. Sin audio se estima por la longitud del texto.
export function autoClipSeconds(audioSeconds: number | null, narration: string | null): number {
  const total = audioSeconds ?? (narration ?? "").length / 15;
  return Math.min(8, Math.max(3, Math.ceil(total / 2)));
}

export const DEFAULT_VIDEO_PROMPT =
  "gentle camera motion with slow pan, atmospheric dust particles floating in light, subtle shadow shifts, soft ambient movement throughout the scene";

// Prompt de la música de fondo que se genera al mezclar (meta/musicgen).
// Usa el del proyecto; si no hay (proyectos anteriores), uno neutro.
export function musicPromptFor(c: { title: string; musicPrompt: string | null }): string {
  return (
    c.musicPrompt?.trim() ||
    `Subtle cinematic instrumental background music for a narrated story titled "${c.title}". Atmospheric and understated, no vocals.`
  );
}

export function sceneProgress(s: Scene) {
  const panels = s.panels.length;
  const images = s.panels.filter((p) => p.imageUrl).length;
  const videos = s.panels.filter((p) => p.videoUrl).length;
  const voice = !!s.audioUrl;
  return {
    voice,
    images,
    videos,
    panels,
    complete: voice && panels >= 2 && images === panels && videos === panels,
  };
}

export function comicProgress(c: Comic) {
  let voices = 0;
  let images = 0;
  let videos = 0;
  let panels = 0;
  for (const s of c.scenes) {
    const p = sceneProgress(s);
    if (p.voice) voices++;
    images += p.images;
    videos += p.videos;
    panels += p.panels;
  }
  const scenes = c.scenes.length;
  return {
    scenes,
    voices,
    images,
    videos,
    panels,
    done: voices + images + videos,
    total: scenes + panels * 2,
    complete: scenes > 0 && c.scenes.every((s) => sceneProgress(s).complete),
  };
}

// Divide una narración en frases; se usa para los subtítulos (vista previa y mezcla).
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// fetch + JSON que lanza un Error con el mensaje del servidor si la respuesta no es ok.
export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const hasBody = opts.body !== undefined;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

// Conexión cortada por el navegador o el proxy ("Load failed", "Failed to fetch",
// 502/504) o generación que ya estaba en curso (409): en ambos casos se espera.
function isRecoverable(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof ApiError && [409, 502, 503, 504].includes(e.status));
}

// Generaciones largas: si la conexión se corta antes de la respuesta, el servidor
// sigue trabajando, así que se consulta el comic hasta que aparezca el resultado.
// Con targetId, se detiene al ver un fallo registrado o si la generación ya no
// está en curso en el servidor. Devuelve null cuando el resultado se obtuvo consultando.
export async function apiGenerate<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown },
  recovery: { comicId: string; targetId?: string; done: (c: Comic) => boolean; timeoutMs?: number }
): Promise<T | null> {
  try {
    return await api<T>(url, opts);
  } catch (e) {
    if (!isRecoverable(e)) throw e;
  }
  const deadline = Date.now() + (recovery.timeoutMs ?? 5 * 60_000);
  let missing = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`/api/comics/${recovery.comicId}`).catch(() => null);
    if (!res?.ok) continue;
    const c: Comic = await res.json();
    if (recovery.done(c)) return null;
    if (!recovery.targetId) continue;
    const failure = c.jobs?.errors[recovery.targetId];
    if (failure) throw new Error(failure);
    missing = c.jobs?.running[recovery.targetId] ? 0 : missing + 1;
    if (missing >= 2) throw new Error("La generación se interrumpió. Vuelve a intentarlo.");
  }
  throw new Error("Se perdió la conexión y el resultado no llegó a tiempo. Recarga la página para ver si terminó.");
}

export function findPanel(c: Comic, panelId: string): Panel | undefined {
  for (const s of c.scenes) {
    const p = s.panels.find((x) => x.id === panelId);
    if (p) return p;
  }
  return undefined;
}

export function findScene(c: Comic, sceneId: string): Scene | undefined {
  return c.scenes.find((s) => s.id === sceneId);
}

// ---- Presupuesto ----

// Límite de gasto por proyecto (USD).
export const BUDGET_USD = 5;

// Costos unitarios aproximados para estimar lo que falta por generar.
const EST_USD = {
  portrait: 0.014,
  image: 0.011,
  imagePerRef: 0.008,
  voicePerChar: 0.0001,
  videoPerSecond: 0.02,
  music: 0.07,
};

export type PendingCost = {
  voces: number;
  revoces: number;
  retratos: number;
  ilustraciones: number;
  animaciones: number;
  mezcla: number;
};

export function clipSeconds(c: Comic, s: Scene, p: Panel): number {
  return p.duration || c.videoDuration || autoClipSeconds(null, s.narration);
}

// Personajes sin retrato que aparecen en algún panel (deben generarse antes de ilustrar).
export function missingPortraits(c: Comic): Character[] {
  const used = new Set(c.scenes.flatMap((s) => s.panels.flatMap((p) => (p.characters ?? []).map((x) => x.id))));
  return (c.characters ?? []).filter((ch) => !ch.imageUrl && used.has(ch.id));
}

// La voz de la escena se generó con otra voz o velocidad que la actual del
// proyecto. Los audios anteriores a la elección de voz usaban la voz por defecto.
export function isVoiceOutdated(c: Comic, s: Scene): boolean {
  if (!s.audioUrl) return false;
  const used = s.audioVoice ?? voiceKey(DEFAULT_VOICE_ID, DEFAULT_VOICE_SPEED);
  return used !== voiceKey(c.voiceId, c.voiceSpeed);
}

export function outdatedVoices(c: Comic): Scene[] {
  return c.scenes.filter((s) => isVoiceOutdated(c, s));
}

// Estimación (USD) de lo que falta generar, por tipo de tarea.
export function estimatePending(c: Comic): PendingCost {
  const voice = (s: Scene) => (s.narration ?? "").length * EST_USD.voicePerChar;
  let ilustraciones = 0;
  let animaciones = 0;
  for (const s of c.scenes) {
    for (const p of s.panels) {
      if (!p.imageUrl) ilustraciones += EST_USD.image + (p.characters ?? []).length * EST_USD.imagePerRef;
      if (!p.videoUrl) animaciones += clipSeconds(c, s, p) * EST_USD.videoPerSecond;
    }
  }
  return {
    voces: c.scenes.filter((s) => !s.audioUrl).reduce((sum, s) => sum + voice(s), 0),
    revoces: outdatedVoices(c).reduce((sum, s) => sum + voice(s), 0),
    retratos: missingPortraits(c).length * EST_USD.portrait,
    ilustraciones,
    animaciones,
    mezcla: !c.finalVideoUrl || c.finalVideoOutdated ? EST_USD.music : 0,
  };
}
