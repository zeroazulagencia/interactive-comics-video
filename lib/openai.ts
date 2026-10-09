// Cliente mínimo de OpenAI vía fetch (sin SDK).
// Modelos configurables por env; por defecto gpt-5.5 (texto) y gpt-image-1 (imagen).

const API = "https://api.openai.com/v1";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

function key(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("Falta OPENAI_API_KEY en .env");
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

// Acumula el contenido de un stream SSE de chat/completions.
async function readStreamedContent(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("La respuesta no soporta streaming.");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

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
      const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    }
  }
  return content || "{}";
}

export type GeneratedScene = {
  title: string;
  summary: string;
  narration: string;
  imagePrompts: [string, string];
  videoPrompts: [string, string]; // prompt de animación para cada panel (inglés)
};

// Genera ~10 escenas a partir del prompt e historia + estilo de ilustración.
// Cada escena trae 2 prompts de imagen (dos momentos distintos de la escena)
// para ayudar a entender mejor lo que se narra.
export async function generateScenes(
  prompt: string,
  artStyle: string
): Promise<GeneratedScene[]> {
  const system = `Eres un guionista y director de arte. A partir de una idea, desarrollas una historia en ESCENAS.
Reglas:
- Devuelve ALREDEDOR DE 10 escenas (ni muchas más ni menos, salvo que la historia realmente lo pida).
- Cada escena es breve: describe lo que SUCEDE, no un guion extenso.
- "narration": locución/texto que narra el suceso, de 2 a 3 oraciones, evocador pero sin extenderse demasiado (el audio no debe superar ~12 segundos).
- "imagePrompts": arreglo de EXACTAMENTE 2 prompts (en inglés), cada uno para UNA sola ilustración (no viñetas de cómic). Deben mostrar DOS MOMENTOS O ÁNGULOS DISTINTOS dentro de la misma escena (ej. un establishing shot y luego un close-up de la acción/emoción clave), para ayudar a entender mejor la historia que se narra — no repitas la misma composición. Describe composición, encuadre, luz, color, sujetos, ambiente y detalles en cada uno. Integra SIEMPRE el estilo indicado para mantener coherencia entre todas las escenas.
- "videoPrompts": arreglo de EXACTAMENTE 2 prompts de animación (en inglés), uno para CADA imagePrompt. IMPORTANTE: NUNCA intentes animar personas o figuras (los modelos de video distorsionan los rostros/cuerpos). Enfócate SOLO en: cámara (slow pan/tilt/push-in/zoom), elementos atmosféricos (polvo, humo, luz, sombras, partículas), objetos inanimados (papeles, cortinas, hojas, agua) y efectos de luz. Ejemplo: "soft slow push-in camera, dust motes floating in warm light, shadows deepening slowly across the room". NUNCA uses palabras como "person", "people", "character" en videoPrompts.
- "title": título corto de la escena.
Responde SOLO JSON válido con la forma: {"scenes":[{"title":"...","summary":"...","narration":"...","imagePrompts":["...","..."],"videoPrompts":["...","..."]}]}`;

  const user = `IDEA / HISTORIA:\n${prompt}\n\nESTILO DE ILUSTRACIÓN (aplicar a todos los imagePrompt):\n${
    artStyle || "libre, coherente en todas las escenas"
  }`;

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
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${TEXT_MODEL}) ${res.status}: ${err}`);
  }

  const content = await readStreamedContent(res);
  let parsed: { scenes?: unknown; escenas?: unknown };
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
  return scenes;
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
  return {
    title: str(o.title),
    summary: str(o.summary),
    narration,
    imagePrompts,
    videoPrompts: pair(o.videoPrompts),
  };
}

// Tamaños soportados por gpt-image-1 según la proporción del proyecto.
export function imageSizeFor(aspectRatio: string): "1024x1536" | "1536x1024" {
  return aspectRatio === "vertical" ? "1024x1536" : "1536x1024";
}

// Genera una imagen y devuelve el PNG en base64.
export async function generateImage(
  imagePrompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"
): Promise<string> {
  const res = await call(`${API}/images/generations`, {
    model: IMAGE_MODEL,
    prompt: imagePrompt,
    size,
    n: 1,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI (${IMAGE_MODEL}) ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La API no devolvió imagen.");
  return b64;
}
