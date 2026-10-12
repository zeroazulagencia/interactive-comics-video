// Aplica las migraciones de Prisma pendientes sobre la base de datos local de la
// app de escritorio. Se ejecuta antes de arrancar el servidor.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const dir = process.env.MIGRATIONS_DIR;
  if (!dir) throw new Error("Falta MIGRATIONS_DIR");
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "_narra_migrations" ("name" TEXT PRIMARY KEY, "appliedAt" DATETIME DEFAULT CURRENT_TIMESTAMP)'
    );
    const rows = await db.$queryRawUnsafe('SELECT "name" FROM "_narra_migrations"');
    const done = new Set(rows.map((r) => r.name));
    const pending = fs
      .readdirSync(dir)
      .filter((n) => fs.existsSync(path.join(dir, n, "migration.sql")) && !done.has(n))
      .sort();
    for (const name of pending) {
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const statements = sql
        .replace(/^\s*--.*$/gm, "")
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of statements) await db.$executeRawUnsafe(s);
      await db.$executeRawUnsafe('INSERT INTO "_narra_migrations" ("name") VALUES (?)', name);
      console.log(`migración aplicada: ${name}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
