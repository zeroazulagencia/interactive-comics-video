import { prisma } from "@/lib/prisma";
import type { CostKind, Provider } from "@/lib/pricing";

// Registra el costo de una llamada. Un fallo al registrar no debe romper la
// generación, así que solo se reporta en consola.
export async function recordCost(entry: {
  comicId: string | null;
  kind: CostKind;
  provider: Provider;
  model: string;
  amountUsd: number;
}): Promise<void> {
  try {
    await prisma.cost.create({ data: entry });
  } catch (e) {
    console.error("No se pudo registrar el costo", e);
  }
}
