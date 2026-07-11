// Mezcla el comic completo en un único mp4:
// - Cada escena tiene 2 paneles (imagen animada); cada uno se ralentiza para
//   ocupar la mitad de la duración del audio de narración de su escena.
// - Se agrega música de fondo (generada aparte) en loop, a bajo volumen para
//   no tapar la narración.
// - Se agregan tarjetas de título (fondo negro + texto Montserrat) al inicio
//   y al final con el nombre del proyecto y autor.
// - Subtítulos automáticos con el texto de narración sobre cada escena.
// - Fadeout final a negro + 3 segundos extra de música sobre negro.

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import { Resvg } from "@resvg/resvg-js";

const run = promisify(execFile);

const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "Montserrat-Bold.ttf");
const TITLE_CARD_SECONDS = 3;
const FADE_DURATION = 2; // segundos de fadeout a negro al final
const POST_BLACK_SECONDS = 3; // segundos extra de música sobre negro
const MUSIC_VOLUME = 0.10;

// Escapa texto para insertarlo en un atributo XML/SVG.
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Divide un texto en líneas para que quepa en un ancho máximo aproximado.
function wrapText(text: string, maxWidthPx: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.58;
  const maxChars = Math.max(Math.floor(maxWidthPx / charWidth), 20);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

// Renderiza una tarjeta de título (fondo negro + título + autor) a PNG.
function renderTitleCardPng(title: string, author: string, width: number, height: number): Buffer {
  const isHorizontal = width > height;
  const fontSize = Math.round(isHorizontal ? width * 0.055 : width * 0.08);
  const authorFontSize = Math.round(fontSize * 0.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="black"/>
    <text x="50%" y="44%" font-family="Montserrat" font-weight="700" font-size="${fontSize}"
      fill="white" text-anchor="middle" dominant-baseline="middle">${escapeXml(title)}</text>
    <text x="50%" y="56%" font-family="Montserrat" font-weight="400" font-size="${authorFontSize}"
      fill="#aaaaaa" text-anchor="middle" dominant-baseline="middle">By ${escapeXml(author)}</text>
  </svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  });
  return resvg.render().asPng();
}

// Renderiza un PNG de subtítulo (texto blanco sobre fondo semitransparente, abajo).
// Fuente serif tipo Times.
function renderSubtitlePng(text: string, width: number, height: number): Buffer {
  const fontSize = Math.round(width * 0.035);
  const padding = 10;
  const lines = wrapText(text, width * 0.85, fontSize);
  const lineHeight = fontSize * 1.3;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxY = height - boxHeight - 50;
  const boxWidth = Math.round(width * 0.9);
  const boxX = Math.round((width - boxWidth) / 2);

  const lineSvgs = lines
    .map(
      (line, i) =>
        `<text x="50%" y="${boxY + padding + fontSize + i * lineHeight}" font-family="Georgia, serif" font-size="${fontSize}" fill="white" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("\n    ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="rgba(0,0,0,0.55)" rx="8"/>
    ${lineSvgs}
  </svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return resvg.render().asPng();
}

async function ffprobeDuration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`No se pudo leer la duración de ${file}`);
  }
  return seconds;
}

function resolutionFor(aspectRatio: string): { width: number; height: number } {
  return aspectRatio === "vertical" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

export type MixScene = {
  audioPath: string;
  panelVideoPaths: [string, string];
};

export async function mixComic(opts: {
  scenes: MixScene[];
  title: string;
  author: string;
  subtitleChunks: string[][];
  subtitlesEnabled: boolean;
  aspectRatio: string;
  musicPath: string;
  outputPath: string;
}): Promise<void> {
  const { scenes, title, author, subtitleChunks, subtitlesEnabled, aspectRatio, musicPath, outputPath } = opts;
  if (scenes.length === 0) throw new Error("No hay escenas para mezclar.");
  if (scenes.length !== subtitleChunks.length) {
    throw new Error("La cantidad de grupos de subtítulos no coincide con las escenas.");
  }

  const { width, height } = resolutionFor(aspectRatio);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "comic-mix-"));

  try {
    const sceneParts: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const { audioPath, panelVideoPaths } = scenes[i];
      const audioDuration = await ffprobeDuration(audioPath);
      const halfDuration = audioDuration / 2;

      // --- Crear los 2 paneles (slowmo + escala, sin audio ambiental) ---
      const panelParts: string[] = [];
      for (let p = 0; p < 2; p++) {
        const videoPath = panelVideoPaths[p];
        const videoDuration = await ffprobeDuration(videoPath);
        const factor = halfDuration / videoDuration;
        const partPath = path.join(tmpDir, `s${i}-p${p}.mp4`);
        await run("ffmpeg", [
          "-y",
          "-i", videoPath,
          "-vf",
          `setpts=${factor}*PTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=24,format=yuv420p`,
          "-an",
          "-t", String(halfDuration),
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          partPath,
        ]);
        panelParts.push(partPath);
      }

      // --- Concatenar los 2 paneles ---
      const panelListFile = path.join(tmpDir, `s${i}-list.txt`);
      await writeFile(panelListFile, panelParts.map((p) => `file '${p}'`).join("\n"));
      const sceneVideoOnly = path.join(tmpDir, `s${i}-video.mp4`);
      await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", panelListFile, "-c", "copy", sceneVideoOnly]);

      // --- Mezclar video + audio (y subtítulos si están activados) ---
      // Nota: los paneles de p-video traen audio ambiental pero se descarta
      // con -an porque el ralentizado con atempo genera artefactos.
      const scenePart = path.join(tmpDir, `s${i}-final.mp4`);

      if (subtitlesEnabled) {
        // Renderizar subtítulos por frases para esta escena
        const sentences = subtitleChunks[i] || [""];
        const segDuration = audioDuration / sentences.length;

        const subPngs: string[] = [];
        for (let j = 0; j < sentences.length; j++) {
          const subPng = path.join(tmpDir, `s${i}-sub-${j}.png`);
          await writeFile(subPng, renderSubtitlePng(sentences[j], width, height));
          subPngs.push(subPng);
        }

        const ffmpegInputs: string[] = ["-y", "-i", sceneVideoOnly, "-i", audioPath];
        for (const png of subPngs) {
          ffmpegInputs.push("-i", png);
        }

        // Construir cadena de overlays: cada frase aparece en su segmento de tiempo
        let filterChain = "";
        for (let j = 0; j < subPngs.length; j++) {
          const start = j * segDuration;
          const end = (j + 1) * segDuration;
          if (j === 0) {
            filterChain = `[0:v][2:v]overlay=0:0:enable='between(t,${start.toFixed(1)},${end.toFixed(1)})'`;
          } else {
            filterChain += `[s${j - 1}][${2 + j}:v]overlay=0:0:enable='between(t,${start.toFixed(1)},${end.toFixed(1)})'`;
          }
          if (j < subPngs.length - 1) {
            filterChain += `[s${j}]; `;
          } else {
            filterChain += `[vid]`;
          }
        }

        await run("ffmpeg", [
          ...ffmpegInputs,
          "-filter_complex",
          `${filterChain}`,
          "-map", "[vid]",
          "-map", "1:a",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-c:a", "aac",
          "-ar", "44100",
          "-ac", "2",
          "-b:a", "192k",
          "-shortest",
          scenePart,
        ]);
      } else {
        // Sin subtítulos: solo video + audio de narración
        await run("ffmpeg", [
          "-y",
          "-i", sceneVideoOnly,
          "-i", audioPath,
          "-map", "0:v",
          "-map", "1:a",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-c:a", "aac",
          "-ar", "44100",
          "-ac", "2",
          "-b:a", "192k",
          "-shortest",
          scenePart,
        ]);
      }
      sceneParts.push(scenePart);
    }

    // --- Concatenar todas las escenas narradas ---
    const narratedListFile = path.join(tmpDir, "narrated-list.txt");
    await writeFile(narratedListFile, sceneParts.map((p) => `file '${p}'`).join("\n"));
    const narratedPath = path.join(tmpDir, "narrated.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", narratedListFile, "-c", "copy", narratedPath]);
    const narratedDuration = await ffprobeDuration(narratedPath);

    // --- Música de fondo en loop, a bajo volumen ---
    const withMusicPath = path.join(tmpDir, "with-music.mp4");
    await run("ffmpeg", [
      "-y",
      "-i", narratedPath,
      "-stream_loop", "-1",
      "-i", musicPath,
      "-filter_complex",
      `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voice];` +
        `[1:a]volume=${MUSIC_VOLUME},aformat=sample_rates=44100:channel_layouts=stereo[music];` +
        `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      "-map", "0:v",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", String(narratedDuration),
      withMusicPath,
    ]);

    // --- Tarjeta de título (con autor) ---
    const titleCardPng = path.join(tmpDir, "title-card.png");
    await writeFile(titleCardPng, renderTitleCardPng(title, author, width, height));

    const introPath = path.join(tmpDir, "intro.mp4");
    const outroPath = path.join(tmpDir, "outro.mp4");
    for (const cardPath of [introPath, outroPath]) {
      await run("ffmpeg", [
        "-y",
        "-loop", "1",
        "-i", titleCardPng,
        "-stream_loop", "-1",
        "-i", musicPath,
        "-t", String(TITLE_CARD_SECONDS),
        "-filter_complex",
        `[1:a]volume=${MUSIC_VOLUME},aformat=sample_rates=44100:channel_layouts=stereo[bg];` +
          `[0:v]fps=24,format=yuv420p[vid]`,
        "-map", "[vid]",
        "-map", "[bg]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        cardPath,
      ]);
    }

    // --- Concat inicial: intro + narrado+musica + outro ---
    const rawPath = path.join(tmpDir, "raw.mp4");
    const finalListFile = path.join(tmpDir, "final-list.txt");
    await writeFile(
      finalListFile,
      [introPath, withMusicPath, outroPath].map((p) => `file '${p}'`).join("\n")
    );
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", finalListFile, "-c", "copy", rawPath]);

    // --- Fadeout a negro + 3 segundos extra ---
    // La música YA está mezclada en rawPath (intro + withMusic + outro).
    // Solo extendemos el audio existente con silencio para que no se corte.
    const rawDuration = await ffprobeDuration(rawPath);
    const fadeStart = Math.max(0, rawDuration - FADE_DURATION);
    const totalDuration = rawDuration + POST_BLACK_SECONDS;

    await run("ffmpeg", [
      "-y",
      "-i", rawPath,
      "-filter_complex",
      `[0:v]fade=t=out:st=${fadeStart}:d=${FADE_DURATION}[v];` +
        `[0:a]apad=pad_len=${Math.round(POST_BLACK_SECONDS * 44100)}[aout]`,
      "-map", "[v]",
      "-map", "[aout]",
      "-t", String(totalDuration),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "192k",
      outputPath,
    ]);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}