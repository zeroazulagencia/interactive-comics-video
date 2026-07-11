import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/panels/:id — edita los prompts de un panel
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["imagePrompt", "videoPrompt"]) {
    if (k in body) data[k] = body[k];
  }
  const panel = await prisma.panel.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(panel);
}
