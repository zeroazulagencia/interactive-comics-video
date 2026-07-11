import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateImage, imageSizeFor } from "@/lib/openai";

export const maxDuration = 120;

// POST /api/panels/:id/generate-image — genera la ilustración con gpt-image-1
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const panel = await prisma.panel.findUnique({
    where: { id: params.id },
    include: { scene: { include: { comic: true } } },
  });
  if (!panel) {
    return NextResponse.json({ error: "Panel no encontrado" }, { status: 404 });
  }
  if (!panel.imagePrompt?.trim()) {
    return NextResponse.json(
      { error: "Este panel no tiene prompt de ilustración." },
      { status: 400 }
    );
  }

  try {
    const size = imageSizeFor(panel.scene.comic.aspectRatio);
    const b64 = await generateImage(panel.imagePrompt, size);

    const dir = path.join(process.cwd(), "public", "generated");
    await mkdir(dir, { recursive: true });
    const filename = `${panel.id}-${Date.now()}.png`;
    await writeFile(path.join(dir, filename), Buffer.from(b64, "base64"));

    const imageUrl = `/generated/${filename}`;
    const updated = await prisma.panel.update({
      where: { id: panel.id },
      data: { imageUrl },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la imagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
