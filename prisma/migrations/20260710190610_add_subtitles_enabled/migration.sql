-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Cristian Parada',
    "subtitlesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "prompt" TEXT,
    "artStyle" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT 'horizontal',
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "finalVideoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Comic" ("artStyle", "aspectRatio", "author", "coverImage", "createdAt", "finalVideoUrl", "id", "prompt", "published", "title", "updatedAt") SELECT "artStyle", "aspectRatio", "author", "coverImage", "createdAt", "finalVideoUrl", "id", "prompt", "published", "title", "updatedAt" FROM "Comic";
DROP TABLE "Comic";
ALTER TABLE "new_Comic" RENAME TO "Comic";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
