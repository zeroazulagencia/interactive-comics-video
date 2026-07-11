-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "imagePrompt" TEXT,
    "imageUrl" TEXT,
    "videoPrompt" TEXT,
    "videoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Panel_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "artStyle" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT 'horizontal',
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "finalVideoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Comic" ("artStyle", "coverImage", "createdAt", "finalVideoUrl", "id", "prompt", "published", "title", "updatedAt") SELECT "artStyle", "coverImage", "createdAt", "finalVideoUrl", "id", "prompt", "published", "title", "updatedAt" FROM "Comic";
DROP TABLE "Comic";
ALTER TABLE "new_Comic" RENAME TO "Comic";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Panel_sceneId_idx" ON "Panel"("sceneId");
