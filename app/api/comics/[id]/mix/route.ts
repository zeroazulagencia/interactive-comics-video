import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { mixComic } from "@/lib/ffmpeg";
import { generateMusic } from "@/lib/replicate";
import { musicPromptFor, splitSentences } from "@/lib/comic";

export const maxDuration = 300;

const MUSIC_SECONDS = 30;

// POST /api/comics/:id/mix — genera música y mezcla escenas + narración en un mp4 final
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const comic = await prisma.comic.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: { panels: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!comic) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (comic.scenes.length === 0) {
    return NextResponse.json({ error: "El proyecto no tiene escenas." }, { status: 400 });
  }
  for (const s of comic.scenes) {
    if (!s.audioUrl) {
      return NextResponse.json(
        { error: `La escena "${s.title ?? s.order}" todavía no tiene audio.` },
        { status: 400 }
      );
    }
    if (s.panels.length < 2 || s.panels.some((p) => !p.imageUrl || !p.videoUrl)) {
      return NextResponse.json(
        { error: `La escena "${s.title ?? s.order}" todavía no tiene sus 2 paneles con imagen y animación.` },
        { status: 400 }
      );
    }
  }

  try {
    const publicDir = path.join(process.cwd(), "public");
    const generatedDir = path.join(publicDir, "generated");
    await mkdir(generatedDir, { recursive: true });

    const scenes = comic.scenes.map((s) => ({
      audioPath: path.join(publicDir, s.audioUrl!),
      panelVideoPaths: [
        path.join(publicDir, s.panels[0].videoUrl!),
        path.join(publicDir, s.panels[1].videoUrl!),
      ] as [string, string],
    }));

    // Divide cada narración en frases (oraciones) para subtítulos secuenciales
    const subtitleChunks = comic.scenes.map((s) => {
      const sentences = splitSentences(s.narration || "");
      return sentences.length > 0 ? sentences : [""];
    });

    // Música de fondo acorde a la historia.
    const musicSourceUrl = await generateMusic(musicPromptFor(comic), MUSIC_SECONDS);
    const musicRes = await fetch(musicSourceUrl);
    if (!musicRes.ok) throw new Error("No se pudo descargar la música generada.");
    const musicBuffer = Buffer.from(await musicRes.arrayBuffer());
    const musicFilename = `${comic.id}-music-${Date.now()}.mp3`;
    const musicPath = path.join(generatedDir, musicFilename);
    await writeFile(musicPath, musicBuffer);

    const filename = `${comic.id}-mix-${Date.now()}.mp4`;
    const outputPath = path.join(generatedDir, filename);
    await mixComic({
      scenes,
      title: comic.title,
      author: comic.author || "Cristian Parada",
      subtitleChunks,
      subtitlesEnabled: comic.subtitlesEnabled ?? true,
      aspectRatio: comic.aspectRatio,
      musicPath,
      outputPath,
    });

    const finalVideoUrl = `/generated/${filename}`;
    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: { finalVideoUrl, finalVideoOutdated: false },
      include: {
        scenes: {
          orderBy: { order: "asc" },
          include: { panels: { orderBy: { order: "asc" } } },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error mezclando el video";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
