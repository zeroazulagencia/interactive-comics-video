import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ComicSummary } from "@/lib/comic";

// GET /api/comics — lista todos los comics con portada y progreso
export async function GET() {
  try {
    const comics = await prisma.comic.findMany({
      include: {
        scenes: {
          orderBy: { order: "asc" },
          select: {
            audioUrl: true,
            panels: { orderBy: { order: "asc" }, select: { imageUrl: true, videoUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    const costs = await prisma.cost.groupBy({ by: ["comicId"], _sum: { amountUsd: true } });
    const costOf = (id: string) => costs.find((r) => r.comicId === id)?._sum.amountUsd ?? 0;
    const summaries: ComicSummary[] = comics.map((c) => {
      const panels = c.scenes.flatMap((s) => s.panels);
      return {
        id: c.id,
        title: c.title,
        aspectRatio: c.aspectRatio,
        finalVideoUrl: c.finalVideoUrl,
        finalVideoOutdated: c.finalVideoOutdated,
        updatedAt: c.updatedAt.toISOString(),
        sceneCount: c.scenes.length,
        coverImage: c.coverImage ?? panels.find((p) => p.imageUrl)?.imageUrl ?? null,
        done:
          c.scenes.filter((s) => s.audioUrl).length +
          panels.filter((p) => p.imageUrl).length +
          panels.filter((p) => p.videoUrl).length,
        total: c.scenes.length + panels.length * 2,
        costUsd: costOf(c.id),
      };
    });
    return NextResponse.json(summaries);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error consultando comics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/comics — crea un comic (título + proporción)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.title) {
      return NextResponse.json({ error: "title es requerido" }, { status: 400 });
    }
    const aspectRatio = body.aspectRatio === "vertical" ? "vertical" : "horizontal";
    const comic = await prisma.comic.create({
      data: { title: body.title, aspectRatio },
    });
    return NextResponse.json(comic, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error creando comic";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
