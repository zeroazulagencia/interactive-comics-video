-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "summary" TEXT,
    "narration" TEXT,
    "audioUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("audioUrl", "comicId", "createdAt", "id", "narration", "order", "summary", "title", "updatedAt") SELECT "audioUrl", "comicId", "createdAt", "id", "narration", "order", "summary", "title", "updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE INDEX "Scene_comicId_idx" ON "Scene"("comicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
