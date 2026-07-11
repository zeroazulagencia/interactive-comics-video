import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/comics — lista todos los comics
export async function GET() {
  try {
    const comics = await prisma.comic.findMany({
      include: { _count: { select: { scenes: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(comics);
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
