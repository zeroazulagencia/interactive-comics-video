import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Comic completo tal como lo usa la interfaz: escenas, paneles (con los ids de
// sus personajes) y elenco.
export const comicInclude = {
  scenes: {
    orderBy: { order: "asc" },
    include: { panels: { orderBy: { order: "asc" }, include: { characters: { select: { id: true } } } } },
  },
  characters: { orderBy: { order: "asc" } },
} satisfies Prisma.ComicInclude;
