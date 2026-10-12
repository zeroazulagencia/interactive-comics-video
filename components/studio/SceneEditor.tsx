"use client";

import { useEffect, useState } from "react";
import { api, apiGenerate, DEFAULT_VIDEO_PROMPT, findPanel, findScene, type JobKind, type Panel, type Scene } from "@/lib/comic";
import { Button, Notice, Spinner, inputClass, labelClass } from "@/components/ui";

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className="text-[12px] text-ink-3">
      {state === "saving" ? "Guardando…" : state === "saved" ? "Guardado" : "No se pudo guardar"}
    </span>
  );
}

// Generaciones en curso por escena (voz) o panel (ilustración/animación): las del
// servidor más las lanzadas desde esta pestaña.
export type Jobs = {
  running: Record<string, JobKind>;
  errors: Record<string, string>;
  run: (targetId: string, kind: JobKind, fn: () => Promise<void>) => void;
};

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function SceneEditor({
  comicId,
  scene,
  aspectRatio,
  activeId,
  jobs,
  onChanged,
  onDeleted,
}: {
  comicId: string;
  scene: Scene;
  aspectRatio: string;
  activeId: string | null;
  jobs: Jobs;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(scene.title ?? "");
  const [narration, setNarration] = useState(scene.narration ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Partial<Record<"title" | "narration", string>>) {
    setSaveState("saving");
    try {
      await api(`/api/scenes/${scene.id}`, { method: "PATCH", body });
      setSaveState("saved");
      onChanged();
    } catch (e) {
      setSaveState("error");
      setErr(errMsg(e, "No se pudo guardar"));
    }
  }

  function saveIfChanged(field: "title" | "narration", value: string) {
    if (value !== (scene[field] ?? "")) patch({ [field]: value });
  }

  function generateVoice() {
    const text = narration;
    const before = scene.audioUrl;
    jobs.run(scene.id, "voz", async () => {
      if (text !== (scene.narration ?? "")) {
        await api(`/api/scenes/${scene.id}`, { method: "PATCH", body: { narration: text } });
      }
      await apiGenerate(
        `/api/scenes/${scene.id}/generate-voice`,
        { method: "POST" },
        {
          comicId,
          targetId: scene.id,
          done: (c) => { const url = findScene(c, scene.id)?.audioUrl; return !!url && url !== before; },
        }
      );
    });
  }

  async function remove() {
    if (!confirm("¿Eliminar esta escena y sus paneles?")) return;
    try {
      await api(`/api/scenes/${scene.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setErr(errMsg(e, "No se pudo eliminar la escena"));
    }
  }

  const voiceBusy = jobs.running[scene.id] === "voz" || activeId === scene.id;
  const voiceError = jobs.errors[scene.id];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-white/[0.07]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Texto</span>
          <SaveIndicator state={saveState} />
        </div>
        <input
          className="mb-5 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-ink-3"
          placeholder="Título de la escena"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveIfChanged("title", title)}
        />
        <label className={labelClass}>Narración</label>
        <textarea
          className={`${inputClass} resize-y leading-relaxed`}
          rows={4}
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          onBlur={() => saveIfChanged("narration", narration)}
        />
        {scene.audioUrl && narration !== (scene.narration ?? "") && (
          <p className="mt-2 text-[12px] text-orange-300">Al guardar el nuevo texto, la voz actual se descarta.</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <Button
            variant={scene.audioUrl ? "secondary" : "primary"}
            size="sm"
            onClick={generateVoice}
            loading={voiceBusy}
            disabled={!narration.trim()}
          >
            {voiceBusy ? "Generando voz…" : scene.audioUrl ? "Regenerar voz" : "Generar voz"}
          </Button>
          {scene.audioUrl ? (
            <audio controls preload="none" src={scene.audioUrl} className="h-9 min-w-0 flex-1" />
          ) : (
            <span className="text-[13px] text-ink-3">Sin voz todavía</span>
          )}
        </div>
        {(err || voiceError) && (
          <div className="mt-4">
            <Notice tone="error">{err ?? voiceError}</Notice>
          </div>
        )}
      </section>

      {scene.panels.map((panel) => (
        <PanelEditor
          key={panel.id}
          comicId={comicId}
          jobs={jobs}
          panel={panel}
          aspectRatio={aspectRatio}
          busy={activeId === panel.id}
          onChanged={onChanged}
        />
      ))}

      <button onClick={remove} className="self-center pb-4 text-[13px] text-red-400 hover:underline">
        Eliminar escena
      </button>
    </div>
  );
}

function PanelEditor({
  comicId,
  jobs,
  panel,
  aspectRatio,
  busy,
  onChanged,
}: {
  comicId: string;
  jobs: Jobs;
  panel: Panel;
  aspectRatio: string;
  busy: boolean;
  onChanged: () => void;
}) {
  const [imagePrompt, setImagePrompt] = useState(panel.imagePrompt ?? "");
  const [videoPrompt, setVideoPrompt] = useState(panel.videoPrompt || DEFAULT_VIDEO_PROMPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const genImg = jobs.running[panel.id] === "ilustracion";
  const genVideo = jobs.running[panel.id] === "animacion";
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setImagePrompt(panel.imagePrompt ?? ""), [panel.imagePrompt]);

  async function savePrompts(body: { imagePrompt?: string; videoPrompt?: string }) {
    setSaveState("saving");
    try {
      await api(`/api/panels/${panel.id}`, { method: "PATCH", body });
      setSaveState("saved");
      onChanged();
    } catch (e) {
      setSaveState("error");
      setErr(errMsg(e, "No se pudo guardar"));
    }
  }

  function generateImage() {
    const prompt = imagePrompt;
    const before = panel.imageUrl;
    setErr(null);
    jobs.run(panel.id, "ilustracion", async () => {
      await api(`/api/panels/${panel.id}`, { method: "PATCH", body: { imagePrompt: prompt } });
      await apiGenerate(
        `/api/panels/${panel.id}/generate-image`,
        { method: "POST" },
        {
          comicId,
          targetId: panel.id,
          done: (c) => { const url = findPanel(c, panel.id)?.imageUrl; return !!url && url !== before; },
        }
      );
    });
  }

  function animate() {
    const prompt = videoPrompt;
    const before = panel.videoUrl;
    setErr(null);
    jobs.run(panel.id, "animacion", async () => {
      await api(`/api/panels/${panel.id}`, { method: "PATCH", body: { videoPrompt: prompt } });
      await apiGenerate(
        `/api/panels/${panel.id}/generate-video`,
        { method: "POST", body: { duration: 5 } },
        {
          comicId,
          targetId: panel.id,
          done: (c) => { const url = findPanel(c, panel.id)?.videoUrl; return !!url && url !== before; },
          timeoutMs: 8 * 60_000,
        }
      );
    });
  }

  const working = genImg || genVideo || busy;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.07]">
      <div className={`${aspectRatio === "vertical" ? "mx-auto aspect-[9/16] max-h-[520px]" : "aspect-video"} relative bg-white/[0.04]`}>
        {panel.videoUrl ? (
          <video
            controls
            preload="metadata"
            src={panel.videoUrl}
            poster={panel.imageUrl ?? undefined}
            className="h-full w-full object-cover"
          />
        ) : panel.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panel.imageUrl} alt={`Panel ${panel.order}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-3">Sin ilustración todavía</div>
        )}
        {working && (
          <div className="animate-fade-in absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[13px] font-medium shadow-sm">
              <Spinner />
              {genVideo ? "Animando (1–2 min)…" : genImg ? "Ilustrando…" : "En cola de producción…"}
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Panel {panel.order}</span>
          <SaveIndicator state={saveState} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={panel.imageUrl ? "secondary" : "primary"}
            size="sm"
            onClick={generateImage}
            loading={genImg}
            disabled={working || !imagePrompt.trim()}
          >
            {panel.imageUrl ? "Regenerar ilustración" : "Generar ilustración"}
          </Button>
          <Button
            variant={panel.imageUrl && !panel.videoUrl ? "primary" : "secondary"}
            size="sm"
            onClick={animate}
            loading={genVideo}
            disabled={working || !panel.imageUrl || !videoPrompt.trim()}
            title={!panel.imageUrl ? "Genera primero la ilustración" : undefined}
          >
            {panel.videoUrl ? "Regenerar animación" : "Animar"}
          </Button>
        </div>
        {panel.imageUrl && panel.videoUrl && (
          <p className="mt-2 text-[12px] text-ink-3">Regenerar la ilustración descarta la animación actual.</p>
        )}

        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-accent">
            <span className="group-open:hidden">Mostrar prompts</span>
            <span className="hidden group-open:inline">Ocultar prompts</span>
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className={labelClass}>Prompt de ilustración</label>
              <textarea
                className={`${inputClass} resize-y font-mono text-[12px] leading-relaxed`}
                rows={4}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onBlur={() => imagePrompt !== (panel.imagePrompt ?? "") && savePrompts({ imagePrompt })}
              />
            </div>
            <div>
              <label className={labelClass}>Prompt de animación</label>
              <textarea
                className={`${inputClass} resize-y font-mono text-[12px] leading-relaxed`}
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                onBlur={() => videoPrompt !== (panel.videoPrompt ?? "") && savePrompts({ videoPrompt })}
              />
            </div>
          </div>
        </details>

        {(err || jobs.errors[panel.id]) && (
          <div className="mt-4">
            <Notice tone="error">{err ?? jobs.errors[panel.id]}</Notice>
          </div>
        )}
      </div>
    </section>
  );
}
