import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/comics/:id/characters — agrega un personaje al elenco
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const last = await prisma.character.findFirst({ where: { comicId: params.id }, orderBy: { order: "desc" } });
  const character = await prisma.character.create({
    data: {
      comicId: params.id,
      order: (last?.order ?? 0) + 1,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Nuevo personaje",
      description: typeof body.description === "string" ? body.description : "",
    },
  });
  return NextResponse.json(character);
}
