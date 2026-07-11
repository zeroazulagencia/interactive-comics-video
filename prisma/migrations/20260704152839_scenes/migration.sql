/*
  Warnings:

  - You are about to drop the `Panel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `description` on the `Comic` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Panel_sceneId_idx";

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN "imagePrompt" TEXT;
ALTER TABLE "Scene" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Scene" ADD COLUMN "narration" TEXT;
ALTER TABLE "Scene" ADD COLUMN "summary" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Panel";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "artStyle" TEXT,
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Comic" ("coverImage", "createdAt", "id", "published", "title", "updatedAt") SELECT "coverImage", "createdAt", "id", "published", "title", "updatedAt" FROM "Comic";
DROP TABLE "Comic";
ALTER TABLE "new_Comic" RENAME TO "Comic";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
