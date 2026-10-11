// Claves de API. En la web vienen de .env; en la app de escritorio el usuario
// las guarda desde Ajustes en settings.json, dentro de su carpeta de datos.

import fs from "fs";
import path from "path";

export type ApiKeyName = "OPENAI_APIKEY" | "REPLICATE_APIKEY";

export const IS_DESKTOP = process.env.NARRA_DESKTOP === "1";

function settingsFile(): string | null {
  const dir = process.env.NARRA_DATA_DIR;
  return dir ? path.join(dir, "settings.json") : null;
}

function readSettings(): Partial<Record<ApiKeyName, string>> {
  const file = settingsFile();
  if (!file) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function apiKey(name: ApiKeyName): string | undefined {
  return readSettings()[name]?.trim() || process.env[name] || undefined;
}

export function saveApiKeys(keys: Partial<Record<ApiKeyName, string>>) {
  const file = settingsFile();
  if (!file) throw new Error("No hay carpeta de datos configurada.");
  const next = { ...readSettings() };
  for (const [k, v] of Object.entries(keys) as [ApiKeyName, string | undefined][]) {
    if (typeof v === "string" && v.trim()) next[k] = v.trim();
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
}
