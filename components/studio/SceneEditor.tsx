"use client";

import { useEffect, useState } from "react";
import {
  api,
  apiGenerate,
  clipSeconds,
  DEFAULT_VIDEO_PROMPT,
  findPanel,
  findScene,
  formatUsd,
  isVoiceOutdated,
  type Comic,
  type JobKind,
  type Panel,
  type Scene,
} from "@/lib/comic";
import { voiceName } from "@/lib/voices";
import { Badge, Button, Notice, Spinner, inputClass, labelClass } from "@/components/ui";

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

// Movimientos de cámara que se añaden al prompt de animación.
const CAMERA_MOVES: { label: string; text: string }[] = [
  { label: "Acercamiento", text: "slow push-in camera" },
  { label: "Alejamiento", text: "slow pull-out camera" },
  { label: "Paneo lateral", text: "slow lateral pan" },
  { label: "Inclinación", text: "slow upward tilt" },
  { label: "Órbita", text: "slow orbit around the subject" },
  { label: "Cámara en mano", text: "subtle handheld camera sway" },
  { label: "Cámara fija", text: "static locked-off camera, only ambient motion" },
];

const PANEL_DURATIONS = [0, 3, 4, 5, 6, 8];

export function SceneEditor({
  comic,
  scene,
  activeId,
  jobs,
  onChanged,
  onDeleted,
}: {
  comic: Comic;
  scene: Scene;
  activeId: string | null;
  jobs: Jobs;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const comicId = comic.id;
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
  const oldVoice = isVoiceOutdated(comic, scene);

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
        <p className={`mt-2 text-[12px] ${oldVoice ? "text-orange-300" : "text-ink-3"}`}>
          {oldVoice
            ? `Esta voz se generó con otra voz o velocidad. Regenérala para usar la del proyecto: ${voiceName(comic.voiceId)}.`
            : `Voz del proyecto: ${voiceName(comic.voiceId)}, ${comic.voiceSpeed.toFixed(2)}×. Se cambia en el paso Idea.`}
        </p>
        {(err || voiceError) && (
          <div className="mt-4">
            <Notice tone="error">{err ?? voiceError}</Notice>
          </div>
        )}
      </section>

      {scene.panels.map((panel) => (
        <PanelEditor
          key={panel.id}
          comic={comic}
          scene={scene}
          jobs={jobs}
          panel={panel}
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
  comic,
  scene,
  jobs,
  panel,
  busy,
  onChanged,
}: {
  comic: Comic;
  scene: Scene;
  jobs: Jobs;
  panel: Panel;
  busy: boolean;
  onChanged: () => void;
}) {
  const comicId = comic.id;
  const aspectRatio = comic.aspectRatio;
  const inPanel = new Set((panel.characters ?? []).map((c) => c.id));
  const missingPortrait = comic.characters.filter((c) => inPanel.has(c.id) && !c.imageUrl);
  const seconds = clipSeconds(comic, scene, panel);
  const [imagePrompt, setImagePrompt] = useState(panel.imagePrompt ?? "");
  const [videoPrompt, setVideoPrompt] = useState(panel.videoPrompt || DEFAULT_VIDEO_PROMPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const genImg = jobs.running[panel.id] === "ilustracion";
  const genVideo = jobs.running[panel.id] === "animacion";
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setImagePrompt(panel.imagePrompt ?? ""), [panel.imagePrompt]);

  async function savePrompts(body: { imagePrompt?: string; videoPrompt?: string; duration?: number; characterIds?: string[] }) {
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

  function toggleCharacter(id: string) {
    const next = new Set(inPanel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    savePrompts({ characterIds: [...next] });
  }

  function toggleCamera(text: string) {
    const next = videoPrompt.includes(text)
      ? videoPrompt.replace(new RegExp(`(,\\s*)?${text}`), "").replace(/^,\s*/, "")
      : `${videoPrompt.trim().replace(/[.,]\s*$/, "")}${videoPrompt.trim() ? ", " : ""}${text}`;
    setVideoPrompt(next);
    savePrompts({ videoPrompt: next });
  }

  function animate(draft = false) {
    const prompt = videoPrompt;
    const before = panel.videoUrl;
    setErr(null);
    jobs.run(panel.id, "animacion", async () => {
      await api(`/api/panels/${panel.id}`, { method: "PATCH", body: { videoPrompt: prompt } });
      await apiGenerate(
        `/api/panels/${panel.id}/generate-video`,
        { method: "POST", body: { draft } },
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
        {panel.videoUrl && panel.videoDraft && (
          <span className="absolute left-3 top-3">
            <Badge tone="warn">Borrador</Badge>
          </span>
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
            disabled={working || !imagePrompt.trim() || missingPortrait.length > 0}
            title={missingPortrait.length > 0 ? "Genera primero los retratos del elenco" : undefined}
          >
            {panel.imageUrl ? "Regenerar ilustración" : "Generar ilustración"}
          </Button>
          <Button
            variant={panel.imageUrl && (!panel.videoUrl || panel.videoDraft) ? "primary" : "secondary"}
            size="sm"
            onClick={() => animate(false)}
            loading={genVideo}
            disabled={working || !panel.imageUrl || !videoPrompt.trim()}
            title={!panel.imageUrl ? "Genera primero la ilustración" : undefined}
          >
            {panel.videoUrl && !panel.videoDraft ? "Regenerar animación" : "Animar"} · {formatUsd(seconds * 0.02)}
          </Button>
          <Button
            variant="plain"
            size="sm"
            onClick={() => animate(true)}
            disabled={working || !panel.imageUrl || !videoPrompt.trim()}
            title="Vista previa de menor calidad, 4 veces más barata"
          >
            Probar en borrador · {formatUsd(seconds * 0.005)}
          </Button>
        </div>
        {missingPortrait.length > 0 && (
          <p className="mt-2 text-[12px] text-orange-300">
            Falta el retrato de {missingPortrait.map((c) => c.name).join(", ")}. Genéralo en el Elenco antes de ilustrar.
          </p>
        )}
        {panel.imageUrl && panel.videoUrl && (
          <p className="mt-2 text-[12px] text-ink-3">Regenerar la ilustración descarta la animación actual.</p>
        )}

        {comic.characters.length > 0 && (
          <div className="mt-5">
            <span className={labelClass}>Quién aparece</span>
            <div className="flex flex-wrap gap-1.5">
              {comic.characters.map((c) => {
                const on = inPanel.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCharacter(c.id)}
                    disabled={working}
                    className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12px] font-medium ring-1 transition disabled:opacity-40 ${
                      on ? "bg-accent/10 text-ink ring-accent" : "bg-white/[0.03] text-ink-3 ring-white/[0.08] hover:text-ink-2"
                    }`}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-[10px]">
                        {c.name.slice(0, 1)}
                      </span>
                    )}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink-2">Duración del clip</span>
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[13px] text-ink outline-none"
            value={panel.duration ?? 0}
            onChange={(e) => savePrompts({ duration: Number(e.target.value) })}
            disabled={working}
          >
            {PANEL_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? `Del proyecto (${comic.videoDuration ? `${comic.videoDuration} s` : "automática"})` : `${d} s`}
              </option>
            ))}
          </select>
          <span className="text-[12px] tabular-nums text-ink-3">{seconds} s</span>
        </div>

        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-accent">
            <span className="group-open:hidden">Mostrar prompts y movimiento de cámara</span>
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
              <label className={labelClass}>Movimiento de cámara</label>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {CAMERA_MOVES.map((m) => {
                  const on = videoPrompt.includes(m.text);
                  return (
                    <button
                      key={m.text}
                      type="button"
                      onClick={() => toggleCamera(m.text)}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 transition ${
                        on ? "bg-accent/10 text-ink ring-accent" : "bg-white/[0.03] text-ink-2 ring-white/[0.08] hover:text-ink"
                      }`}
                    >
                      {on && "✓ "}
                      {m.label}
                    </button>
                  );
                })}
              </div>
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
