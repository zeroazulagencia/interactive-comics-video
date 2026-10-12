// Precios por proveedor (USD) para calcular el costo de cada llamada.
// Fuentes (consultadas 2026-10): developers.openai.com/api/docs/pricing y las
// páginas de cada modelo en replicate.com. Actualizar aquí si cambian.

export type Provider = "openai" | "replicate";
export type CostKind = "guion" | "voz" | "retrato" | "ilustracion" | "animacion" | "musica" | "youtube";

// Modelos de texto: USD por 1M de tokens.
const TEXT_PRICES: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
};
const DEFAULT_TEXT_PRICE = TEXT_PRICES["gpt-5.5"];

// Modelos de imagen: USD por 1M de tokens.
const IMAGE_PRICES: Record<string, { textInput: number; imageInput: number; imageOutput: number }> = {
  "gpt-image-1": { textInput: 5, imageInput: 10, imageOutput: 40 },
  "gpt-image-1-mini": { textInput: 2, imageInput: 2.5, imageOutput: 8 },
  "gpt-image-2.5-flare": { textInput: 5, imageInput: 8, imageOutput: 30 },
};
const DEFAULT_IMAGE_PRICE = IMAGE_PRICES["gpt-image-2.5-flare"];

const VOICE_USD_PER_1K_CHARS = 0.1; // minimax/speech-02-hd
const VIDEO_USD_PER_SECOND_720P = 0.02; // prunaai/p-video, sin draft
const VIDEO_DRAFT_USD_PER_SECOND_720P = 0.005; // prunaai/p-video, modo borrador
const MUSIC_USD_PER_GPU_SECOND = 0.0014; // meta/musicgen en Nvidia A100 (80GB)

export type TextUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

export function textCost(model: string, usage: TextUsage | null | undefined): number {
  if (!usage) return 0;
  const p = TEXT_PRICES[model] ?? DEFAULT_TEXT_PRICE;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const input = (usage.prompt_tokens ?? 0) - cached;
  return (input * p.input + cached * p.cachedInput + (usage.completion_tokens ?? 0) * p.output) / 1_000_000;
}

export type ImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

export function imageCost(model: string, usage: ImageUsage | null | undefined): number {
  if (!usage) return 0;
  const p = IMAGE_PRICES[model] ?? DEFAULT_IMAGE_PRICE;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const textIn = usage.input_tokens_details?.text_tokens ?? (usage.input_tokens ?? 0) - imageIn;
  return (textIn * p.textInput + imageIn * p.imageInput + (usage.output_tokens ?? 0) * p.imageOutput) / 1_000_000;
}

export function voiceCost(characters: number): number {
  return (characters / 1000) * VOICE_USD_PER_1K_CHARS;
}

export function videoCost(seconds: number, draft = false): number {
  return seconds * (draft ? VIDEO_DRAFT_USD_PER_SECOND_720P : VIDEO_USD_PER_SECOND_720P);
}

export function musicCost(predictSeconds: number): number {
  return predictSeconds * MUSIC_USD_PER_GPU_SECOND;
}
