import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.scene.deleteMany();
  await prisma.comic.deleteMany();

  const comic = await prisma.comic.create({
    data: {
      title: "El primer comic interactivo",
      prompt:
        "Una ciudad silenciosa al amanecer donde una persona descubre que no está sola.",
      artStyle:
        "Ilustración editorial, acuarela desaturada, luz cálida y tenue, grano de papel.",
      scenes: {
        create: [
          {
            order: 1,
            title: "El amanecer",
            summary: "La ciudad despierta vacía y en silencio.",
            narration:
              "Las calles todavía guardaban el frío de la noche. No había pasos, ni voces, solo el zumbido lejano de un semáforo cambiando de color para nadie.",
            imagePrompt:
              "Una avenida urbana desierta al amanecer, luz dorada rasante, niebla baja, fachadas de piedra, un único semáforo encendido, atmósfera melancólica y serena.",
          },
        ],
      },
    },
  });

  console.log(`✅ Seed completo. Comic: ${comic.title} (${comic.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
