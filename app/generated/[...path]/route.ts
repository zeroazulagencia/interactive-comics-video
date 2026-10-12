import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { MEDIA_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

// GET /generated/* — sirve los archivos generados en runtime. `next start` solo
// sirve los archivos de public/ que existían al hacer el build.
const GENERATED_DIR = MEDIA_DIR;

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  const filePath = path.resolve(GENERATED_DIR, ...params.path);
  if (!filePath.startsWith(GENERATED_DIR + path.sep)) {
    return new Response("No encontrado", { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("No encontrado", { status: 404 });
    size = info.size;
  } catch {
    return new Response("No encontrado", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
  };

  // Soporte de Range para que <video>/<audio> puedan adelantar la reproducción.
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? parseInt(range[1], 10) : Math.max(0, size - parseInt(range[2], 10));
    const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
