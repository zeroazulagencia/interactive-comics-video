import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/characters/:id — edita nombre o descripción
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["name", "description"]) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  const character = await prisma.character.update({ where: { id: params.id }, data });
  return NextResponse.json(character);
}

// DELETE /api/characters/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.character.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
