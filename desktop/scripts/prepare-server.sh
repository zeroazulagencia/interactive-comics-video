#!/usr/bin/env bash
# Arma el servidor de Next.js con todo lo que necesita para ir dentro de la app:
# Node, ffmpeg/ffprobe, migraciones y módulos nativos. Se ejecuta en macOS.
# Uso: desktop/scripts/prepare-server.sh <arm64|x64>
set -euo pipefail

ARCH="${1:?Indica la arquitectura: arm64 o x64}"
NODE_VERSION="${NODE_VERSION:-22.23.3}"
FFMPEG_RELEASE="${FFMPEG_RELEASE:-b6.1.1}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/desktop/src-tauri/resources/server"
TMP="$(mktemp -d)"

cd "$ROOT"
rm -rf "$OUT"
mkdir -p "$OUT"

npx prisma generate
NEXT_STANDALONE=1 DATABASE_URL="file:$TMP/build.db" npm run build

cp -R .next/standalone/. "$OUT/"
rm -f "$OUT"/.env "$OUT"/.env.*
rm -rf "$OUT/public"
mkdir -p "$OUT/.next" "$OUT/public" "$OUT/prisma" "$OUT/node_modules"
cp -R .next/static "$OUT/.next/static"
cp -R public/. "$OUT/public/"
rm -rf "$OUT/public/generated"
cp -R assets "$OUT/assets"
cp -R prisma/migrations "$OUT/prisma/migrations"
rm -rf "$OUT/node_modules/.prisma" "$OUT/node_modules/@prisma/client" "$OUT/node_modules/@resvg"
mkdir -p "$OUT/node_modules/@prisma"
cp -R node_modules/.prisma "$OUT/node_modules/.prisma"
cp -R node_modules/@prisma/client "$OUT/node_modules/@prisma/client"
cp -R node_modules/@resvg "$OUT/node_modules/@resvg"
cp desktop/server/migrate.cjs "$OUT/migrate.cjs"

curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$ARCH.tar.gz" | tar -xz -C "$TMP"
cp "$TMP/node-v$NODE_VERSION-darwin-$ARCH/bin/node" "$OUT/node"

for bin in ffmpeg ffprobe; do
  curl -fsSL "https://github.com/eugeneware/ffmpeg-static/releases/download/$FFMPEG_RELEASE/$bin-darwin-$ARCH.gz" | gunzip > "$OUT/$bin"
  chmod +x "$OUT/$bin"
done

# macOS solo ejecuta binarios firmados; se firman de forma local (ad hoc).
if command -v codesign >/dev/null; then
  codesign --force --sign - "$OUT/ffmpeg" "$OUT/ffprobe"
  find "$OUT/node_modules" \( -name "*.node" -o -name "*.dylib" \) -exec codesign --force --sign - {} \;
fi

rm -rf "$TMP"
du -sh "$OUT"
