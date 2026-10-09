import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/scenes/:id — edita los textos de una escena
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["title", "summary", "narration"]) {
    if (k in body) data[k] = body[k];
  }

  const current = await prisma.scene.findUnique({ where: { id: params.id } });
  if (!current) {
    return NextResponse.json({ error: "Escena no encontrada" }, { status: 404 });
  }
  // Si cambia la narración, el audio anterior ya no corresponde al texto.
  const narrationChanged = "narration" in data && data.narration !== current.narration;
  if (narrationChanged) data.audioUrl = null;

  const [scene] = await prisma.$transaction([
    prisma.scene.update({ where: { id: params.id }, data }),
    ...(narrationChanged
      ? [prisma.comic.update({ where: { id: current.comicId }, data: { finalVideoOutdated: true } })]
      : []),
  ]);
  return NextResponse.json(scene);
}

// DELETE /api/scenes/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const scene = await prisma.scene.findUnique({ where: { id: params.id } });
  if (!scene) {
    return NextResponse.json({ error: "Escena no encontrada" }, { status: 404 });
  }
  await prisma.$transaction([
    prisma.scene.delete({ where: { id: params.id } }),
    prisma.comic.update({ where: { id: scene.comicId }, data: { finalVideoOutdated: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
