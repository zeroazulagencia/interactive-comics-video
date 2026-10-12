// Elenco: prompts de retratos y de paneles con referencias (solo servidor).

import { readFile } from "fs/promises";
import { mediaPath } from "@/lib/paths";
import type { ImageRef } from "@/lib/openai";

type CastChar = { name: string; description: string; imageUrl: string | null };

export function portraitPrompt(c: { name: string; description: string }, artStyle: string | null): string {
  return [
    `Character reference portrait of ${c.name}: ${c.description || "a character from the story"}.`,
    "Head and shoulders, facing the viewer, neutral expression, plain light background, soft even lighting.",
    "No text, letters or captions.",
    artStyle?.trim() ? `Style: ${artStyle.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// Antepone al prompt del panel quién es quién en las imágenes de referencia y
// el aspecto fijo de cada personaje, para que se vea igual en todas las escenas.
export function panelPrompt(imagePrompt: string, chars: CastChar[]): string {
  if (chars.length === 0) return imagePrompt;
  const withRef = chars.filter((c) => c.imageUrl);
  const withoutRef = chars.filter((c) => !c.imageUrl);
  const lines: string[] = [];
  if (withRef.length > 0) {
    lines.push(
      "Reference images: keep each character identical to their reference (same face, age, skin tone, hairstyle and clothing).",
      ...withRef.map((c, i) => `- Image ${i + 1}: ${c.name}. ${c.description}`)
    );
  }
  if (withoutRef.length > 0) {
    lines.push("Characters:", ...withoutRef.map((c) => `- ${c.name}: ${c.description}`));
  }
  lines.push("Never write names, captions or any text in the image.", "", "Scene:", imagePrompt);
  return lines.join("\n");
}

export async function readRef(imageUrl: string): Promise<ImageRef> {
  const data = await readFile(mediaPath(imageUrl));
  const mime = imageUrl.endsWith(".png") ? "image/png" : imageUrl.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { data, mime };
}

// Relaciona nombres (del guion) con ids de personajes, sin distinguir mayúsculas.
export function idsFor(names: string[], byName: Map<string, string>): { id: string }[] {
  const ids = new Set<string>();
  for (const n of names) {
    const id = byName.get(n.trim().toLowerCase());
    if (id) ids.add(id);
  }
  return [...ids].map((id) => ({ id }));
}
