# Interactive Comics Video

App base en Next.js (App Router) + TypeScript + Prisma + SQLite.

## Modelo de datos

```
Comic 1—* Scene 1—* Panel
```

- **Comic**: título, descripción, portada, publicado.
- **Scene**: escena ordenada dentro de un comic.
- **Panel**: viñeta con imagen/video/audio, caption, diálogo y duración.

## Puesta en marcha

```bash
npm install
npm run db:migrate    # crea dev.db y aplica el esquema
npm run db:seed       # carga datos de ejemplo
npm run dev           # http://localhost:3000
```

## API

- `GET  /api/comics` — lista comics con escenas y paneles
- `POST /api/comics` — crea un comic `{ title, description?, coverImage? }`
- `GET  /api/comics/:id` — un comic con su contenido
- `PATCH /api/comics/:id` — actualiza un comic
- `DELETE /api/comics/:id` — elimina un comic (cascada)

## Scripts útiles

- `npm run db:studio` — abre Prisma Studio para ver/editar la base de datos.

## Variables de entorno

Ver `.env.example`. El `.env` incluye `OPENAI_APIKEY` y `DATABASE_URL`.

## App para Mac

La carpeta `desktop/` empaqueta el estudio como app de Mac con [Tauri](https://tauri.app): una ventana nativa que arranca el servidor de Next.js incluido (con Node, ffmpeg y ffprobe). Los datos se guardan en `~/Library/Application Support/com.zeroazul.narra/` y las claves de API se configuran desde **Ajustes**.

Para publicar una versión, sube una etiqueta `vX.Y.Z`. El flujo `.github/workflows/desktop.yml` compila los `.dmg` (Apple Silicon e Intel) y los publica en GitHub Releases; el botón **Descargar app** del inicio enlaza a la última versión.
