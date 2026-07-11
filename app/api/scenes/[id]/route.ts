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
  const scene = await prisma.scene.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(scene);
}

// DELETE /api/scenes/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.scene.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
