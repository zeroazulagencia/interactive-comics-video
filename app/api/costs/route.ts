import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CostSummary, ProviderBalance } from "@/lib/comic";

export const dynamic = "force-dynamic";

const PROVIDERS = ["openai", "replicate"] as const;

// GET /api/costs — costo promedio por video y saldo estimado por proveedor
export async function GET() {
  try {
    const [finished, balances] = await Promise.all([
      prisma.comic.findMany({ where: { finalVideoUrl: { not: null } }, select: { id: true } }),
      prisma.apiBalance.findMany(),
    ]);

    // Gasto por proveedor de los proyectos con video final.
    const perComic = await prisma.cost.groupBy({
      by: ["comicId", "provider"],
      where: { comicId: { in: finished.map((c) => c.id) } },
      _sum: { amountUsd: true },
    });
    const videoIds = new Set(perComic.map((r) => r.comicId));
    const videoCount = videoIds.size;
    const providerTotal = (p: string) =>
      perComic.filter((r) => r.provider === p).reduce((s, r) => s + (r._sum.amountUsd ?? 0), 0);

    const total = await prisma.cost.aggregate({ _sum: { amountUsd: true } });

    const providers: ProviderBalance[] = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const b = balances.find((x) => x.provider === provider);
        const spent = b
          ? (
              await prisma.cost.aggregate({
                where: { provider, createdAt: { gte: b.setAt } },
                _sum: { amountUsd: true },
              })
            )._sum.amountUsd ?? 0
          : 0;
        return {
          provider,
          amountUsd: b?.amountUsd ?? null,
          setAt: b?.setAt.toISOString() ?? null,
          spentSinceUsd: spent,
          remainingUsd: b ? b.amountUsd - spent : null,
          avgPerVideoUsd: videoCount ? providerTotal(provider) / videoCount : null,
        };
      })
    );

    // Videos que alcanzan: el proveedor con menos saldo relativo limita.
    const limits = providers
      .filter((p) => p.remainingUsd !== null && p.avgPerVideoUsd)
      .map((p) => Math.max(0, Math.floor(p.remainingUsd! / p.avgPerVideoUsd!)));
    const summary: CostSummary = {
      videoCount,
      avgPerVideoUsd: videoCount ? PROVIDERS.reduce((s, p) => s + providerTotal(p), 0) / videoCount : null,
      totalSpentUsd: total._sum.amountUsd ?? 0,
      providers,
      videosLeft: limits.length ? Math.min(...limits) : null,
    };
    return NextResponse.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error consultando costos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/costs — registra el saldo actual de un proveedor { provider, amountUsd }
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = body?.provider;
  const amountUsd = Number(body?.amountUsd);
  if (!PROVIDERS.includes(provider) || !Number.isFinite(amountUsd) || amountUsd < 0) {
    return NextResponse.json({ error: "Proveedor o saldo inválido" }, { status: 400 });
  }
  const balance = await prisma.apiBalance.upsert({
    where: { provider },
    create: { provider, amountUsd },
    update: { amountUsd, setAt: new Date() },
  });
  return NextResponse.json(balance);
}
