"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Panel = {
  id: string;
  order: number;
  imagePrompt: string | null;
  imageUrl: string | null;
  videoPrompt: string | null;
  videoUrl: string | null;
};
type Scene = {
  id: string;
  order: number;
  title: string | null;
  summary: string | null;
  narration: string | null;
  audioUrl: string | null;
  panels: Panel[];
};
type Comic = {
  id: string;
  title: string;
  author: string | null;
  subtitlesEnabled: boolean;
  prompt: string | null;
  artStyle: string | null;
  aspectRatio: string;
  finalVideoUrl: string | null;
  finalVideoOutdated: boolean;
  scenes: Scene[];
};

const DEFAULT_VIDEO_PROMPT =
  "gentle camera motion with slow pan, atmospheric dust particles floating in light, subtle shadow shifts, soft ambient movement throughout the scene";
const VIDEO_SECONDS_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1s", seconds: 1 },
  { label: "2s", seconds: 2 },
  { label: "3s", seconds: 3 },
  { label: "4s", seconds: 4 },
  { label: "5s", seconds: 5 },
];

const SCENES_PER_PAGE = 1;

const btnPrimary =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none";
const btnSecondary =
  "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none";
const btnGhost = "text-sm text-gray-400 hover:text-red-600";
const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";
const noticeClass = "rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800";
const errorClass = "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

function isComicComplete(comic: Comic): boolean {
  return (
    comic.scenes.length > 0 &&
    comic.scenes.every(
      (s) => !!s.audioUrl && s.panels.length >= 2 && s.panels.every((p) => p.imageUrl && p.videoUrl)
    )
  );
}

export default function ComicDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [comic, setComic] = useState<Comic | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [artStyle, setArtStyle] = useState("");
  const [author, setAuthor] = useState("");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<{
    kind: "audios" | "imágenes" | "animaciones";
    current: number;
    total: number;
  } | null>(null);
  const [batchErrors, setBatchErrors] = useState<{ label: string; sceneIndex: number | null }[]>([]);

  const [mixing, setMixing] = useState(false);
  const [mixError, setMixError] = useState<string | null>(null);

  const [page, setPage] = useState(0);

  // Recarga el comic. Con `syncForm` también reemplaza los campos de la
  // cabecera; sin él se conservan las ediciones no guardadas.
  async function load(syncForm = false) {
    const res = await fetch(`/api/comics/${id}`);
    if (!res.ok) return setNotFound(true);
    const data: Comic = await res.json();
    setComic(data);
    if (syncForm) {
      setTitle(data.title);
      setPrompt(data.prompt ?? "");
      setArtStyle(data.artStyle ?? "");
      setAuthor(data.author ?? "Cristian Parada");
      setSubtitlesEnabled(data.subtitlesEnabled ?? true);
    }
    return data;
  }

  useEffect(() => {
    load(true);
  }, [id]);

  async function saveMeta() {
    setSavingMeta(true);
    setError(null);
    await fetch(`/api/comics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Sin título", prompt, artStyle, author, subtitlesEnabled }),
    });
    setSavingMeta(false);
    load(true);
  }

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      // Guarda prompt/estilo antes de generar
      await fetch(`/api/comics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, artStyle, author, subtitlesEnabled }),
      });
      const res = await fetch(`/api/comics/${id}/generate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status} generando escenas`);
        return;
      }
      setComic(data);
      setPage(0);
    } catch (e) {
      setError(
        "La petición no llegó a completarse (posible timeout o conexión bloqueada hacia OpenAI). Revisa la Terminal del servidor."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function removeComic() {
    if (!confirm("¿Eliminar este proyecto?")) return;
    await fetch(`/api/comics/${id}`, { method: "DELETE" });
    router.push("/");
  }

  // Corre `task` sobre cada item que cumpla `shouldRun`, uno a la vez,
  // saltando el resto. Sigue de largo si un item falla.
  async function runBatch<T>(
    kind: "audios" | "imágenes" | "animaciones",
    items: T[],
    shouldRun: (item: T) => boolean,
    label: (item: T) => string,
    getSceneIndex: (item: T) => number | null,
    task: (item: T) => Promise<void>
  ) {
    const pending = items.filter(shouldRun);
    if (pending.length === 0) return;

    setBatchErrors([]);
    setBatch({ kind, current: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      setBatch({ kind, current: i + 1, total: pending.length });
      try {
        await task(item);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error desconocido";
        const shortMsg = msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
        setBatchErrors((prev) => [
          ...prev,
          { label: `${label(item)}: ${shortMsg}`, sceneIndex: getSceneIndex(item) },
        ]);
      }
      await load();
    }
    setBatch(null);
  }

  async function generateAllVoices() {
    await runBatch(
      "audios",
      comic!.scenes,
      (s) => !s.audioUrl && !!s.narration?.trim(),
      (s) => `Escena "${s.title ?? s.order}"`,
      (s) => {
        const idx = comic!.scenes.indexOf(s);
        return idx >= 0 ? idx : null;
      },
      async (s) => {
        const res = await fetch(`/api/scenes/${s.id}/generate-voice`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      }
    );
  }

  function allPanels(): { sceneTitle: string; sceneIndex: number; panel: Panel }[] {
    return comic!.scenes.flatMap((s, si) => s.panels.map((panel) => ({ sceneTitle: s.title ?? String(s.order), sceneIndex: si, panel })));
  }

  async function generateAllImages() {
    await runBatch(
      "imágenes",
      allPanels(),
      ({ panel }) => !panel.imageUrl && !!panel.imagePrompt?.trim(),
      ({ sceneTitle, panel }) => `Escena "${sceneTitle}" panel ${panel.order}`,
      ({ sceneIndex }) => sceneIndex,
      async ({ panel }) => {
        const res = await fetch(`/api/panels/${panel.id}/generate-image`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      }
    );
  }

  async function generateAllVideos() {
    await runBatch(
      "animaciones",
      allPanels(),
      ({ panel }) => !panel.videoUrl && !!panel.imageUrl,
      ({ sceneTitle, panel }) => `Escena "${sceneTitle}" panel ${panel.order}`,
      ({ sceneIndex }) => sceneIndex,
      async ({ panel }) => {
        const videoPrompt = panel.videoPrompt?.trim() || DEFAULT_VIDEO_PROMPT;
        await fetch(`/api/panels/${panel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoPrompt }),
        });
        const res = await fetch(`/api/panels/${panel.id}/generate-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: 5 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      }
    );
  }

  async function mixComic() {
    setMixError(null);
    setMixing(true);
    const res = await fetch(`/api/comics/${id}/mix`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMixing(false);
    if (!res.ok) return setMixError(data.error ?? `Error ${res.status} mezclando el video`);
    setComic(data);
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-4 text-gray-500">Proyecto no encontrado</p>
        <Link href="/" className={btnSecondary}>Volver</Link>
      </main>
    );
  }
  if (!comic) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-gray-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-900">
        ← Todos los proyectos
      </Link>

      {/* Cabecera / metadatos */}
      <header className="mb-10 rounded-lg border border-gray-200 bg-white p-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          Proyecto · {comic.aspectRatio === "vertical" ? "Vertical (9:16)" : "Horizontal (16:9)"}
        </p>

        <input
          className="mb-6 w-full border-0 border-b border-gray-300 px-0 pb-2 text-2xl font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className={labelClass}>Prompt / idea de la historia</label>
        <textarea
          className={`${inputClass} mb-4`}
          rows={4}
          placeholder="Describe la historia. Incluye el tono y, si quieres, el estilo visual…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <label className={labelClass}>Estilo de ilustración (se aplica a todas las escenas)</label>
        <textarea
          className={inputClass}
          rows={2}
          placeholder="p. ej. acuarela desaturada, luz cálida, grano de papel…"
          value={artStyle}
          onChange={(e) => setArtStyle(e.target.value)}
        />

        <label className={labelClass}>Autor</label>
        <input
          className={inputClass}
          placeholder="Cristian Parada"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />

        <label className="mb-1 mt-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={subtitlesEnabled}
            onChange={(e) => setSubtitlesEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Subtítulos
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className={btnPrimary} onClick={generate} disabled={generating || !prompt.trim()}>
            {generating ? "Generando…" : comic.scenes.length ? "Regenerar escenas" : "Generar escenas"}
          </button>
          <button className={btnSecondary} onClick={saveMeta} disabled={savingMeta}>
            {savingMeta ? "Guardando…" : "Guardar"}
          </button>
          <button className={btnGhost} onClick={removeComic}>Eliminar proyecto</button>
        </div>

        {generating && (
          <p className={`${noticeClass} mt-4`}>
            Generando con gpt-5.5 (~10 escenas, 2 imágenes c/u). Esto puede tardar hasta un minuto…
          </p>
        )}
        {error && <p className={`${errorClass} mt-4`}>{error}</p>}
      </header>

      {/* Escenas */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-sm font-medium text-gray-500">Escenas</h2>
          {comic.scenes.length > 0 && (
            <span className="text-xs text-gray-400">{comic.scenes.length} en total</span>
          )}
        </div>

        {comic.scenes.length === 0 ? (
          <p className="italic text-gray-400">Aún no hay escenas. Escribe un prompt y genera.</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button className={btnSecondary} onClick={generateAllVoices} disabled={!!batch}>
                {batch?.kind === "audios" ? `Generando audios… (${batch.current}/${batch.total})` : "Generar todos los audios"}
              </button>
              <button className={btnSecondary} onClick={generateAllImages} disabled={!!batch}>
                {batch?.kind === "imágenes" ? `Generando imágenes… (${batch.current}/${batch.total})` : "Generar todas las imágenes"}
              </button>
              <button className={btnSecondary} onClick={generateAllVideos} disabled={!!batch}>
                {batch?.kind === "animaciones" ? `Generando animaciones… (${batch.current}/${batch.total})` : "Generar todas las animaciones"}
              </button>
              {isComicComplete(comic) && (
                <button className={btnPrimary} onClick={mixComic} disabled={mixing}>
                  {mixing ? "Mezclando…" : comic.finalVideoUrl ? "Volver a mezclar" : "Mezclar"}
                </button>
              )}
            </div>
            {batch && (
              <p className={`${noticeClass} mb-4`}>
                Generando {batch.kind} una por una, saltando las que ya existen. Esto puede tardar bastante — no cierres esta página.
              </p>
            )}
            {mixing && (
              <p className={`${noticeClass} mb-4`}>
                Generando música y mezclando escenas, narración, música y títulos en un mp4 final. Puede tardar varios minutos…
              </p>
            )}
            {mixError && <p className={`${errorClass} mb-4`}>{mixError}</p>}
            {comic.finalVideoUrl && (
              <div className={`mb-6 ${comic.aspectRatio === "vertical" ? "max-w-xs" : "max-w-xl"}`}>
                <label className={labelClass}>Video final</label>
                {comic.finalVideoOutdated && (
                  <p className={`${noticeClass} mb-2`}>
                    Hubo cambios después de la última mezcla. Este video está desactualizado: vuelve a mezclar.
                  </p>
                )}
                <video controls preload="none" src={comic.finalVideoUrl} className="w-full rounded-md border border-gray-200" />
              </div>
            )}
            {batchErrors.length > 0 && (
              <div className={`${errorClass} mb-4 space-y-1`}>
                {batchErrors.map((e, i) => (
                  <p key={i}>
                    {e.sceneIndex !== null ? (
                      <button
                        className="underline hover:no-underline text-left"
                        onClick={() => setPage(e.sceneIndex!)}
                      >
                        {e.label}
                      </button>
                    ) : (
                      e.label
                    )}
                  </p>
                ))}
              </div>
            )}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(comic.scenes.length / SCENES_PER_PAGE));
              const safePage = Math.min(page, totalPages - 1);
              const start = safePage * SCENES_PER_PAGE;
              const pageScenes = comic.scenes.slice(start, start + SCENES_PER_PAGE);
              return (
                <>
                  <div className="flex flex-col gap-10">
                    {pageScenes.map((scene, i) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        index={start + i}
                        aspectRatio={comic.aspectRatio}
                        onChanged={() => load()}
                      />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center gap-4">
                      <button
                        className={btnSecondary}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                      >
                        ← Anterior
                      </button>
                      <span className="text-sm text-gray-500">Página {safePage + 1} de {totalPages}</span>
                      <button
                        className={btnSecondary}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage >= totalPages - 1}
                      >
                        Siguiente →
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </section>
    </main>
  );
}

function SceneCard({
  scene,
  index,
  aspectRatio,
  onChanged,
}: {
  scene: Scene;
  index: number;
  aspectRatio: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(scene.title ?? "");
  const [summary, setSummary] = useState(scene.summary ?? "");
  const [narration, setNarration] = useState(scene.narration ?? "");
  const [audioUrl, setAudioUrl] = useState(scene.audioUrl);
  useEffect(() => setAudioUrl(scene.audioUrl), [scene.audioUrl]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genVoice, setGenVoice] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, narration }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  }

  async function generateVoice() {
    setErr(null);
    setGenVoice(true);
    // guarda la narración actual antes de generar
    await fetch(`/api/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narration }),
    });
    const res = await fetch(`/api/scenes/${scene.id}/generate-voice`, { method: "POST" });
    const data = await res.json();
    setGenVoice(false);
    if (!res.ok) return setErr(data.error ?? "Error generando la voz");
    setAudioUrl(data.audioUrl);
    onChanged();
  }

  async function remove() {
    if (!confirm("¿Eliminar esta escena?")) return;
    await fetch(`/api/scenes/${scene.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs text-gray-400">{String(index + 1).padStart(2, "0")}</span>
        <input
          className="flex-1 border-0 px-0 text-lg font-semibold text-gray-900 focus:outline-none focus:ring-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título de la escena"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Qué sucede</label>
          <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Narración / locución (hasta 3 párrafos)</label>
          <textarea className={inputClass} rows={3} value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btnSecondary} onClick={save} disabled={saving}>
          {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar textos"}
        </button>
        <button className={btnPrimary} onClick={generateVoice} disabled={genVoice || !narration.trim()}>
          {genVoice ? "Generando voz…" : audioUrl ? "Regenerar voz" : "Generar voz"}
        </button>
        {audioUrl && <audio controls preload="none" src={audioUrl} className="h-10" />}
        <button className={`${btnGhost} ml-auto`} onClick={remove}>Eliminar escena</button>
      </div>

      {err && <p className={`${errorClass} mt-4`}>{err}</p>}

      {/* Los 2 paneles, lado a lado, mismo alto */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {scene.panels.map((panel) => (
          <PanelCard key={panel.id} panel={panel} aspectRatio={aspectRatio} onChanged={onChanged} />
        ))}
      </div>
    </article>
  );
}

function PanelCard({
  panel,
  aspectRatio,
  onChanged,
}: {
  panel: Panel;
  aspectRatio: string;
  onChanged: () => void;
}) {
  const [imagePrompt, setImagePrompt] = useState(panel.imagePrompt ?? "");
  const [imageUrl, setImageUrl] = useState(panel.imageUrl);
  const [videoPrompt, setVideoPrompt] = useState(panel.videoPrompt || DEFAULT_VIDEO_PROMPT);
  const [videoUrl, setVideoUrl] = useState(panel.videoUrl);
  useEffect(() => setImageUrl(panel.imageUrl), [panel.imageUrl]);
  useEffect(() => setVideoUrl(panel.videoUrl), [panel.videoUrl]);
  const [videoDuration, setVideoDuration] = useState(5);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genImg, setGenImg] = useState(false);
  const [genVideo, setGenVideo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/panels/${panel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePrompt, videoPrompt }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateImage() {
    setErr(null);
    setGenImg(true);
    await fetch(`/api/panels/${panel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePrompt }),
    });
    const res = await fetch(`/api/panels/${panel.id}/generate-image`, { method: "POST" });
    const data = await res.json();
    setGenImg(false);
    if (!res.ok) return setErr(data.error ?? "Error generando la imagen");
    setImageUrl(data.imageUrl);
    setVideoUrl(data.videoUrl);
    onChanged();
  }

  async function animate() {
    setErr(null);
    setGenVideo(true);
    await fetch(`/api/panels/${panel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPrompt }),
    });
    const res = await fetch(`/api/panels/${panel.id}/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: videoDuration }),
    });
    const data = await res.json();
    setGenVideo(false);
    if (!res.ok) return setErr(data.error ?? "Error generando la animación");
    setVideoUrl(data.videoUrl);
    onChanged();
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      {/* Marco de medio: aspect-ratio fijo, para que ambos paneles queden parejos */}
      <div
        className={`${aspectRatio === "vertical" ? "aspect-[9/16]" : "aspect-video"} relative bg-gray-100`}
      >
        {videoUrl ? (
          <video controls preload="none" src={videoUrl} poster={imageUrl ?? undefined} className="h-full w-full object-cover" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Panel ${panel.order}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-gray-400">Sin imagen todavía</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Panel {panel.order}</p>

        <label className={labelClass}>Prompt de ilustración (gpt-image-1)</label>
        <textarea
          className={`${inputClass} mb-3 font-mono text-xs`}
          rows={3}
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
        />

        <label className={labelClass}>Prompt de animación</label>
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={2}
          value={videoPrompt}
          onChange={(e) => setVideoPrompt(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={btnSecondary} onClick={save} disabled={saving}>
            {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
          </button>
          <button className={btnPrimary} onClick={generateImage} disabled={genImg || !imagePrompt.trim()}>
            {genImg ? "Generando…" : imageUrl ? "Regenerar imagen" : "Generar imagen"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            value={videoDuration}
            onChange={(e) => setVideoDuration(Number(e.target.value))}
          >
            {VIDEO_SECONDS_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>{o.label}</option>
            ))}
          </select>
          <button
            className={btnPrimary}
            onClick={animate}
            disabled={genVideo || !videoPrompt.trim() || !imageUrl}
            title={!imageUrl ? "Genera primero la imagen" : undefined}
          >
            {genVideo ? "Animando…" : videoUrl ? "Regenerar animación" : "Animar"}
          </button>
        </div>
        {genVideo && <p className={`${noticeClass} mt-3`}>Generando animación con p-video (puede tardar 1-2 minutos)…</p>}
        {err && <p className={`${errorClass} mt-3`}>{err}</p>}
      </div>
    </div>
  );
}
