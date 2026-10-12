// Rutas configurables por env, para que la app de escritorio guarde los datos
// en la carpeta del usuario. Por defecto usan las carpetas del proyecto.

import path from "path";

// Voces, ilustraciones, animaciones y videos finales. Se sirven en /generated/*.
export const MEDIA_DIR = process.env.MEDIA_DIR
  ? path.resolve(process.env.MEDIA_DIR)
  : path.join(process.cwd(), "public", "generated");

export const ASSETS_DIR = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.join(process.cwd(), "assets");

export const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

// Convierte una URL "/generated/archivo" en su ruta en disco.
export function mediaPath(url: string): string {
  return path.join(MEDIA_DIR, url.replace(/^\/generated\//, ""));
}
