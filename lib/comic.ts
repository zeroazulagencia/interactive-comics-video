// Tipos y utilidades compartidas por la interfaz (sin dependencias de servidor).

export type Panel = {
  id: string;
  order: number;
  imagePrompt: string | null;
  imageUrl: string | null;
  videoPrompt: string | null;
  videoUrl: string | null;
};

export type Scene = {
  id: string;
  order: number;
  title: string | null;
  summary: string | null;
  narration: string | null;
  audioUrl: string | null;
  panels: Panel[];
};

export type Comic = {
  id: string;
  title: string;
  author: string | null;
  subtitlesEnabled: boolean;
  prompt: string | null;
  artStyle: string | null;
  aspectRatio: string;
  finalVideoUrl: string | null;
  finalVideoOutdated: boolean;
  musicPrompt: string | null;
  youtubeTitle: string | null;
  youtubeDescription: string | null;
  youtubeTags: string | null;
  scenes: Scene[];
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
};

export const DEFAULT_AUTHOR = "Cristian Parada";

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
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}
