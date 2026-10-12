import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CostBreakdown } from "@/lib/comic";

// GET /api/comics/:id/costs — gasto en APIs del proyecto, por tipo de tarea
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await prisma.cost.groupBy({
    by: ["kind"],
    where: { comicId: params.id },
    _sum: { amountUsd: true },
    _count: true,
  });
  const byKind = rows.map((r) => ({ kind: r.kind, amountUsd: r._sum.amountUsd ?? 0, count: r._count }));
  const breakdown: CostBreakdown = {
    totalUsd: byKind.reduce((s, r) => s + r.amountUsd, 0),
    byKind,
  };
  return NextResponse.json(breakdown);
}
