// Cliente mínimo de OpenAI vía fetch (sin SDK).
// Modelos configurables por env; por defecto gpt-5.5 (texto) y gpt-image-2.5-flare (imagen).

import { imageCost, textCost, type ImageUsage, type TextUsage } from "@/lib/pricing";
import { apiKey } from "@/lib/settings";

const API = "https://api.openai.com/v1";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
// Calidad media: buena relación costo/calidad (~US$ 0.01-0.02 por imagen).
export const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? "medium";

function key(): string {
  const k = apiKey("OPENAI_APIKEY");
  if (!k) throw new Error("Falta la clave de OpenAI (OPENAI_APIKEY).");
  return k;
}

// Hace la petición y expone la causa real si la conexión falla ("fetch failed").
async function call(url: string, payload: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key()}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const cause =
      e instanceof Error && e.cause
        ? ` (causa: ${String((e.cause as { message?: string })?.message ?? e.cause)})`
        : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo conectar con OpenAI: ${msg}${cause}`);
  }
}

async function callForm(url: string, form: FormData): Promise<Response> {
  try {
    return await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key()}` }, body: form });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo conectar con OpenAI: ${msg}`);
  }
}

// Acumula el contenido de un stream SSE de chat/completions y el uso de
// tokens (último chunk, requiere stream_options.include_usage).
async function readStreamedContent(res: Response): Promise<{ content: string; usage: TextUsage | null }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("La respuesta no soporta streaming.");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: TextUsage | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      const chunk = JSON.parse(data);
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) content += delta;
      if (chunk?.usage) usage = chunk.usage;
    }
  }
  return { content: content || "{}", usage };
}

export type GeneratedScene = {
  title: string;
  summary: string;
  narration: string;
  imagePrompts: [string, string];
  videoPrompts: [string, string]; // prompt de animación para cada panel (inglés)
  panelCast: [string[], string[]]; // nombres del elenco que aparecen en cada panel
};

export type CastMember = { name: string; description: string };

export type GeneratedStory = {
  cast: CastMember[];
  scenes: GeneratedScene[];
  musicPrompt: string; // música de fondo acorde al tono de la historia (inglés)
  costUsd: number;
};

// Genera ~10 escenas a partir del prompt e historia + estilo de ilustración.
// Cada escena trae 2 prompts de imagen (dos momentos distintos de la escena)
// para ayudar a entender mejor lo que se narra.
export async function generateScenes(
  prompt: string,
  artStyle: string,
  motionStyle = "",
  animateCharacters = false
): Promise<GeneratedStory> {
  const system = `Eres un guionista y director de arte. A partir de una idea, desarrollas una historia en ESCENAS.
Reglas:
- Devuelve ALREDEDOR DE 10 escenas (ni muchas más ni menos, salvo que la historia realmente lo pida).
- Cada escena es breve: describe lo que SUCEDE, no un guion extenso.
- "narration": locución/texto que narra el suceso, de 2 a 3 oraciones, evocador pero sin extenderse demasiado (el audio no debe superar ~12 segundos).
- "imagePrompts": arreglo de EXACTAMENTE 2 prompts (en inglés), cada uno para UNA sola ilustración (no viñetas de cómic). Deben mostrar DOS MOMENTOS O ÁNGULOS DISTINTOS dentro de la misma escena (ej. un establishing shot y luego un close-up de la acción/emoción clave), para ayudar a entender mejor la historia que se narra — no repitas la misma composición. Describe composición, encuadre, luz, color, sujetos, ambiente y detalles en cada uno. Integra SIEMPRE el estilo indicado para mantener coherencia entre todas las escenas.
${CAST_RULES}
- "videoPrompts": arreglo de EXACTAMENTE 2 prompts de animación (en inglés), uno para CADA imagePrompt. ${
    animateCharacters ? VIDEO_RULE_ANIMATE : VIDEO_RULE_STATIC
  } Si se indica un TIPO DE ANIMACIÓN, todos los videoPrompts deben seguirlo.
- "title": título corto de la escena.
- "musicPrompt" (uno para toda la historia, en inglés): música instrumental de fondo acorde al género y tono de la historia (instrumentos, tempo, atmósfera). Debe ser sutil para no tapar la narración: sin voces ni letras.
Responde SOLO JSON válido con la forma: {"musicPrompt":"...","cast":[{"name":"...","description":"..."}],"scenes":[{"title":"...","summary":"...","narration":"...","imagePrompts":["...","..."],"videoPrompts":["...","..."],"panelCast":[["..."],["..."]]}]}`;

  const user = `IDEA / HISTORIA:\n${prompt}\n\nESTILO DE ILUSTRACIÓN (aplicar a todos los imagePrompt):\n${
    artStyle || "libre, coherente en todas las escenas"
  }${motionStyle ? `\n\nTIPO DE ANIMACIÓN (aplicar a todos los videoPrompt):\n${motionStyle}` : ""}`;

  // Streaming: la generación de >=10 escenas tarda más de lo que algunos
  // proxies toleran sin recibir bytes; sin stream la respuesta no envía
  // nada hasta el final y la conexión se corta ("other side closed").
  const res = await call(`${API}/chat/completions`, {
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${TEXT_MODEL}) ${res.status}: ${err}`);
  }

  const { content, usage } = await readStreamedContent(res);
  let parsed: { scenes?: unknown; escenas?: unknown; musicPrompt?: unknown; cast?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("El modelo devolvió un JSON inválido.");
  }
  const raw = parsed.scenes ?? parsed.escenas;
  const scenes = Array.isArray(raw) ? raw.map(normalizeScene).filter((s): s is GeneratedScene => s !== null) : [];
  if (scenes.length === 0) {
    throw new Error("El modelo no devolvió escenas válidas.");
  }
  return {
    cast: normalizeCast(parsed.cast),
    scenes,
    musicPrompt: str(parsed.musicPrompt),
    costUsd: textCost(TEXT_MODEL, usage),
  };
}

const CAST_RULES = `- "cast": el ELENCO, es decir, los personajes (personas, animales o criaturas) que aparecen en más de una ilustración, máximo 6. Cada uno con "name" (nombre corto en español, único) y "description" (en inglés, aspecto visual FIJO y concreto: edad, complexión, tono de piel, rostro, peinado y color de pelo, ropa y accesorios característicos). Esta descripción es la fuente de verdad: el mismo personaje debe verse IGUAL en todas las escenas.
- "panelCast": arreglo de EXACTAMENTE 2 listas (una por imagePrompt) con los "name" del elenco que aparecen en esa ilustración (lista vacía si no aparece nadie del elenco).
- En los imagePrompts, cuando aparezca un personaje del elenco, nómbralo y repite sus rasgos clave de "description" (no inventes otro aspecto). Nunca pidas texto, letreros ni nombres escritos en la imagen.`;

const VIDEO_RULE_STATIC = `IMPORTANTE: NUNCA intentes animar personas o figuras (los modelos de video distorsionan los rostros/cuerpos). Enfócate SOLO en: cámara (slow pan/tilt/push-in/zoom), elementos atmosféricos (polvo, humo, luz, sombras, partículas), objetos inanimados (papeles, cortinas, hojas, agua) y efectos de luz. Ejemplo: "soft slow push-in camera, dust motes floating in warm light, shadows deepening slowly across the room". NUNCA uses palabras como "person", "people", "character" en videoPrompts.`;

const VIDEO_RULE_ANIMATE = `Combina movimiento de cámara suave (slow pan/tilt/push-in) con movimiento SUTIL y natural de los personajes (respirar, parpadear, girar levemente la cabeza, pequeños gestos de las manos), más elementos atmosféricos (polvo, luz, humo, agua). Evita acciones grandes o rápidas, que deforman rostros y cuerpos.`;

function normalizeCast(v: unknown): CastMember[] {
  const seen = new Set<string>();
  const out: CastMember[] = [];
  for (const c of Array.isArray(v) ? v : []) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const name = str(o.name);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, description: str(o.description) });
  }
  return out;
}

function names(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).map(str).filter(Boolean);
}

export type DetectedCast = {
  cast: CastMember[];
  panelCast: [string[], string[]][]; // por escena, en el mismo orden
  costUsd: number;
};

// Deduce el elenco de un proyecto ya escrito (proyectos anteriores al elenco).
export async function detectCast(
  scenes: { narration: string; imagePrompts: string[] }[],
  artStyle: string
): Promise<DetectedCast> {
  const system = `Eres director de arte de una historia ilustrada. Recibes sus escenas (narración y prompts de las 2 ilustraciones de cada una) y defines el elenco para que los personajes se vean iguales en todas las ilustraciones.
Reglas:
${CAST_RULES.split("\n").slice(0, 2).join("\n")}
- Si los prompts describen a un personaje de formas distintas, elige UNA descripción coherente con el estilo.
- "scenes": una entrada por escena, en el mismo orden recibido, con su "panelCast".
Responde SOLO JSON válido con la forma: {"cast":[{"name":"...","description":"..."}],"scenes":[{"panelCast":[["..."],["..."]]}]}`;
  const user = `ESTILO: ${artStyle || "libre"}\n\n${scenes
    .map(
      (s, i) =>
        `ESCENA ${i + 1}\nNarración: ${s.narration}\nIlustración 1: ${s.imagePrompts[0] ?? ""}\nIlustración 2: ${s.imagePrompts[1] ?? ""}`
    )
    .join("\n\n")}`;

  const res = await call(`${API}/chat/completions`, {
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${TEXT_MODEL}) ${res.status}: ${err}`);
  }
  const { content, usage } = await readStreamedContent(res);
  let parsed: { cast?: unknown; scenes?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("El modelo devolvió un JSON inválido.");
  }
  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  return {
    cast: normalizeCast(parsed.cast),
    panelCast: scenes.map((_, i) => {
      const pc = (rawScenes[i] as { panelCast?: unknown } | undefined)?.panelCast;
      const arr = Array.isArray(pc) ? pc : [];
      return [names(arr[0]), names(arr[1])];
    }),
    costUsd: textCost(TEXT_MODEL, usage),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pair(v: unknown): [string, string] {
  const arr = Array.isArray(v) ? v : [];
  return [str(arr[0]), str(arr[1])];
}

// Descarta escenas sin narración o sin los 2 prompts de imagen y completa
// el resto de campos con strings seguros.
function normalizeScene(s: unknown): GeneratedScene | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const narration = str(o.narration);
  const imagePrompts = pair(o.imagePrompts);
  if (!narration || !imagePrompts[0] || !imagePrompts[1]) return null;
  const pc = Array.isArray(o.panelCast) ? o.panelCast : [];
  return {
    title: str(o.title),
    summary: str(o.summary),
    narration,
    imagePrompts,
    videoPrompts: pair(o.videoPrompts),
    panelCast: [names(pc[0]), names(pc[1])],
  };
}

export type YoutubeMeta = {
  title: string;
  description: string;
  tags: string[];
  costUsd: number;
};

// Genera título, descripción y etiquetas para publicar el video en YouTube.
export async function generateYoutubeMeta(input: {
  title: string;
  author: string;
  prompt: string;
  narrations: string[];
  vertical: boolean;
}): Promise<YoutubeMeta> {
  const system = `Eres especialista en publicar videos narrados en YouTube. A partir de la historia de un video, escribes en español el texto para publicarlo.
Reglas:
- "title": atractivo y claro, máximo 90 caracteres, sin clickbait engañoso ni MAYÚSCULAS completas.
- "description": 3 a 5 párrafos cortos. Empieza con un gancho de 1-2 oraciones (lo que se ve en la vista previa), luego un resumen sin revelar el final, una línea de créditos con el autor y una invitación a suscribirse. Termina con 3 a 5 hashtags relevantes en una línea. Máximo 4500 caracteres.
- "tags": entre 10 y 20 etiquetas de búsqueda (sin #), en español, de más general a más específica; en total no deben superar 450 caracteres.
${input.vertical ? "- Es un video vertical para YouTube Shorts: incluye #Shorts entre los hashtags.\n" : ""}Responde SOLO JSON válido con la forma: {"title":"...","description":"...","tags":["..."]}`;

  const user = `TÍTULO DEL PROYECTO: ${input.title}\nAUTOR: ${input.author}\n\nIDEA ORIGINAL:\n${
    input.prompt
  }\n\nNARRACIÓN COMPLETA (en orden):\n${input.narrations.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;

  const res = await call(`${API}/chat/completions`, {
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${TEXT_MODEL}) ${res.status}: ${err}`);
  }

  const { content, usage } = await readStreamedContent(res);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("El modelo devolvió un JSON inválido.");
  }
  const title = str(parsed.title);
  const description = str(parsed.description);
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(str).filter(Boolean) : [];
  if (!title || !description) throw new Error("El modelo no devolvió título y descripción.");
  return { title, description, tags, costUsd: textCost(TEXT_MODEL, usage) };
}

// Tamaños de imagen según la proporción del proyecto.
export function imageSizeFor(aspectRatio: string): "1024x1536" | "1536x1024" {
  return aspectRatio === "vertical" ? "1024x1536" : "1536x1024";
}

export type ImageRef = { data: Buffer; mime: string };

// Genera una imagen y devuelve el PNG en base64 y su costo. Con referencias
// (retratos del elenco) usa el endpoint de edición, que las toma como guía.
export async function generateImage(
  imagePrompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024",
  refs: ImageRef[] = []
): Promise<{ b64: string; costUsd: number }> {
  let res: Response;
  if (refs.length === 0) {
    res = await call(`${API}/images/generations`, {
      model: IMAGE_MODEL,
      prompt: imagePrompt,
      size,
      quality: IMAGE_QUALITY,
      n: 1,
    });
  } else {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", imagePrompt);
    form.append("size", size);
    form.append("quality", IMAGE_QUALITY);
    form.append("n", "1");
    refs.forEach((r, i) => {
      const ext = r.mime === "image/png" ? "png" : r.mime === "image/webp" ? "webp" : "jpg";
      form.append("image[]", new Blob([new Uint8Array(r.data)], { type: r.mime }), `ref-${i + 1}.${ext}`);
    });
    res = await callForm(`${API}/images/edits`, form);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${IMAGE_MODEL}) ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La API no devolvió imagen.");
  return { b64, costUsd: imageCost(IMAGE_MODEL, data.usage as ImageUsage | undefined) };
}
