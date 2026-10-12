import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/panels/:id — edita los prompts, la duración o el elenco de un panel
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["imagePrompt", "videoPrompt", "duration"]) {
    if (k in body) data[k] = body[k];
  }
  if ("duration" in data) {
    const d = Number(data.duration);
    data.duration = d > 0 ? Math.round(Math.min(10, d)) : null;
  }
  if (Array.isArray(body.characterIds)) {
    data.characters = { set: body.characterIds.map((id: string) => ({ id })) };
  }
  const panel = await prisma.panel.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(panel);
}
