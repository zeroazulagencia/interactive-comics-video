"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  apiGenerate,
  comicProgress,
  DEFAULT_VIDEO_PROMPT,
  findPanel,
  findScene,
  type Comic,
  type JobKind,
  type Panel,
} from "@/lib/comic";
import { Badge, Logo, ProgressBar } from "@/components/ui";
import { IdeaStep, type IdeaForm } from "@/components/studio/IdeaStep";
import { StoryboardStep } from "@/components/studio/StoryboardStep";
import { ProductionStep, type Batch, type BatchError, type TaskKind } from "@/components/studio/ProductionStep";
import { PreviewStep } from "@/components/studio/PreviewStep";
import type { Jobs } from "@/components/studio/SceneEditor";

type Step = "idea" | "storyboard" | "production" | "preview";

const STEPS: { value: Step; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "storyboard", label: "Storyboard" },
  { value: "production", label: "Producción" },
  { value: "preview", label: "Vista previa" },
];

function initialStep(c: Comic): Step {
  if (c.scenes.length === 0) return "idea";
  return comicProgress(c).complete ? "preview" : "storyboard";
}

function formFrom(c: Comic): IdeaForm {
  return {
    title: c.title,
    prompt: c.prompt ?? "",
    artStyle: c.artStyle ?? "",
    motionStyle: c.motionStyle ?? "",
  };
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export default function ComicStudio() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [comic, setComic] = useState<Comic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("idea");
  const [openSceneId, setOpenSceneId] = useState<string | null>(null);

  const [form, setForm] = useState<IdeaForm | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  const [batch, setBatch] = useState<Batch | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([]);
  const stopRef = useRef(false);
  const [stopping, setStopping] = useState(false);

  const [running, setRunning] = useState<Jobs["running"]>({});
  const runningRef = useRef<Jobs["running"]>({});
  const [jobErrors, setJobErrors] = useState<Jobs["errors"]>({});

  const [mixing, setMixing] = useState(false);
  const [mixError, setMixError] = useState<string | null>(null);

  // Recarga el comic sin tocar el formulario de la idea (conserva ediciones).
  async function load(): Promise<Comic | null> {
    const res = await fetch(`/api/comics/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return null;
    }
    const data: Comic = await res.json();
    setComic(data);
    return data;
  }

  useEffect(() => {
    load().then((c) => {
      if (!c) return;
      setForm(formFrom(c));
      setStep(initialStep(c));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Generaciones que el servidor tiene en curso pero esta pestaña no lanzó (p. ej.
  // tras recargar): se consulta el comic hasta que terminen.
  const serverJobs = comic?.jobs ?? { running: {}, errors: {} };
  const allRunning = { ...serverJobs.running, ...running };
  const jobCount = Object.keys(allRunning).length;
  const orphanJobs = Object.keys(serverJobs.running).filter((k) => !running[k]).length;
  useEffect(() => {
    if (!orphanJobs || batch) return;
    const timer = setInterval(() => load(), 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orphanJobs, batch]);

  // Aviso al cerrar la pestaña mientras hay trabajo que depende de ella.
  useEffect(() => {
    if (!batch && !mixing && !generating) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [batch, mixing, generating]);

  function metaBody(f: IdeaForm) {
    return { ...f, title: f.title.trim() || "Sin título" };
  }

  async function saveMeta() {
    if (!form) return;
    setSavingMeta(true);
    setIdeaError(null);
    try {
      await api(`/api/comics/${id}`, { method: "PATCH", body: metaBody(form) });
      await load();
    } catch (e) {
      setIdeaError(errMsg(e, "No se pudo guardar"));
    } finally {
      setSavingMeta(false);
    }
  }

  async function generate() {
    if (!form || !comic) return;
    if (comic.scenes.length > 0 && !confirm("Se reemplazarán todas las escenas, voces, ilustraciones y animaciones. ¿Continuar?")) {
      return;
    }
    setIdeaError(null);
    setGenerating(true);
    try {
      await api(`/api/comics/${id}`, { method: "PATCH", body: metaBody(form) });
      const before = comic.scenes.map((s) => s.id).join();
      const data = await apiGenerate<Comic>(
        `/api/comics/${id}/generate`,
        { method: "POST" },
        { comicId: id, done: (c) => c.scenes.length > 0 && c.scenes.map((s) => s.id).join() !== before }
      );
      if (data) setComic(data);
      else await load();
      setStep("storyboard");
    } catch (e) {
      setIdeaError(
        errMsg(e, "La petición no llegó a completarse (posible timeout o conexión bloqueada hacia OpenAI).")
      );
    } finally {
      setGenerating(false);
    }
  }

  async function removeComic() {
    if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    try {
      await api(`/api/comics/${id}`, { method: "DELETE" });
      router.push("/");
    } catch (e) {
      setIdeaError(errMsg(e, "No se pudo eliminar"));
    }
  }

  // ---- Generaciones individuales (desde el editor de escena) ----

  function setRunningJobs(next: Jobs["running"]) {
    runningRef.current = next;
    setRunning(next);
  }

  async function runJob(targetId: string, kind: JobKind, fn: () => Promise<void>) {
    if (runningRef.current[targetId] || comic?.jobs?.running[targetId]) return;
    setRunningJobs({ ...runningRef.current, [targetId]: kind });
    setJobErrors((prev) => {
      const { [targetId]: _, ...rest } = prev;
      return rest;
    });
    try {
      await fn();
    } catch (e) {
      setJobErrors((prev) => ({ ...prev, [targetId]: errMsg(e, "Error generando") }));
    } finally {
      const { [targetId]: _, ...rest } = runningRef.current;
      setRunningJobs(rest);
      await load();
    }
  }

  const allErrors = Object.fromEntries(
    Object.entries({ ...serverJobs.errors, ...jobErrors }).filter(([k]) => !allRunning[k])
  );
  const jobs: Jobs = { running: allRunning, errors: allErrors, run: runJob };

  // ---- Producción por lotes (una tarea a la vez, desde el navegador) ----

  type Task = { id: string; sceneId: string; label: string; run: () => Promise<void> };

  function tasksFor(kind: TaskKind, c: Comic): Task[] {
    const panelsOf = () =>
      c.scenes.flatMap((s, si) => s.panels.map((panel) => ({ s, si, panel })));
    const panelLabel = (si: number, panel: Panel) => `Escena ${si + 1} · panel ${panel.order}`;

    if (kind === "voces") {
      return c.scenes
        .map((s, si) => ({ s, si }))
        .filter(({ s }) => !s.audioUrl && !!s.narration?.trim())
        .map(({ s, si }) => ({
          id: s.id,
          sceneId: s.id,
          label: `Escena ${si + 1} · voz`,
          run: async () => {
            await apiGenerate(
              `/api/scenes/${s.id}/generate-voice`,
              { method: "POST" },
              { comicId: c.id, targetId: s.id, done: (fresh) => !!findScene(fresh, s.id)?.audioUrl }
            );
          },
        }));
    }
    if (kind === "ilustraciones") {
      return panelsOf()
        .filter(({ panel }) => !panel.imageUrl && !!panel.imagePrompt?.trim())
        .map(({ s, si, panel }) => ({
          id: panel.id,
          sceneId: s.id,
          label: `${panelLabel(si, panel)} · ilustración`,
          run: async () => {
            await apiGenerate(
              `/api/panels/${panel.id}/generate-image`,
              { method: "POST" },
              { comicId: c.id, targetId: panel.id, done: (fresh) => !!findPanel(fresh, panel.id)?.imageUrl }
            );
          },
        }));
    }
    return panelsOf()
      .filter(({ panel }) => !panel.videoUrl && !!panel.imageUrl)
      .map(({ s, si, panel }) => ({
        id: panel.id,
        sceneId: s.id,
        label: `${panelLabel(si, panel)} · animación`,
        run: async () => {
          if (!panel.videoPrompt?.trim()) {
            await api(`/api/panels/${panel.id}`, { method: "PATCH", body: { videoPrompt: DEFAULT_VIDEO_PROMPT } });
          }
          await apiGenerate(
            `/api/panels/${panel.id}/generate-video`,
            { method: "POST", body: { duration: 5 } },
            {
              comicId: c.id,
              targetId: panel.id,
              done: (fresh) => !!findPanel(fresh, panel.id)?.videoUrl,
              timeoutMs: 8 * 60_000,
            }
          );
        },
      }));
  }

  // Ejecuta las tareas de un tipo usando el estado más reciente del comic.
  // Devuelve false si el usuario pidió detener.
  async function runKind(kind: TaskKind): Promise<boolean> {
    const fresh = await load();
    if (!fresh) return false;
    const tasks = tasksFor(kind, fresh);
    for (let i = 0; i < tasks.length; i++) {
      if (stopRef.current) return false;
      const task = tasks[i];
      if (runningRef.current[task.id] || fresh.jobs?.running[task.id]) continue;
      setBatch({ kind, label: `Generando ${task.label.toLowerCase()}`, current: i + 1, total: tasks.length });
      setActiveId(task.id);
      try {
        await task.run();
      } catch (e) {
        const msg = errMsg(e, "error desconocido");
        setBatchErrors((prev) => [
          ...prev,
          { label: `${task.label}: ${msg.length > 140 ? msg.slice(0, 140) + "…" : msg}`, sceneId: task.sceneId },
        ]);
      }
      await load();
    }
    return true;
  }

  async function runBatch(kinds: TaskKind[]) {
    stopRef.current = false;
    setStopping(false);
    setBatchErrors([]);
    try {
      for (const kind of kinds) {
        if (!(await runKind(kind))) break;
      }
    } finally {
      setBatch(null);
      setActiveId(null);
      setStopping(false);
    }
  }

  function stopBatch() {
    stopRef.current = true;
    setStopping(true);
  }

  async function mix() {
    setMixError(null);
    setMixing(true);
    try {
      const before = comic?.finalVideoUrl ?? null;
      const data = await apiGenerate<Comic>(
        `/api/comics/${id}/mix`,
        { method: "POST" },
        {
          comicId: id,
          targetId: id,
          done: (c) => !!c.finalVideoUrl && c.finalVideoUrl !== before,
          timeoutMs: 10 * 60_000,
        }
      );
      if (data) setComic(data);
      else await load();
    } catch (e) {
      setMixError(errMsg(e, "Error mezclando el video"));
    } finally {
      setMixing(false);
    }
  }

  function openScene(sceneId: string | null) {
    setOpenSceneId(sceneId);
    if (sceneId) setStep("storyboard");
  }

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="text-2xl font-semibold">Proyecto no encontrado</h1>
        <Link href="/" className="text-accent hover:underline">
          Volver a los proyectos
        </Link>
      </main>
    );
  }
  if (!comic || !form) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-3 border-r-transparent" />
      </main>
    );
  }

  const progress = comicProgress(comic);
  const hasScenes = comic.scenes.length > 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/" className="shrink-0" aria-label="Volver a los proyectos">
              <Logo size="sm" withName={false} />
            </Link>
            <span className="text-ink-3">/</span>
            <Link href="/" className="shrink-0 text-[13px] text-ink-2 hover:text-ink">
              Proyectos
            </Link>
            <span className="text-ink-3">/</span>
            <span className="truncate text-[14px] font-semibold">{comic.title}</span>
          </div>

          <nav className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]">
            {STEPS.map((st, i) => {
              const disabled = st.value !== "idea" && !hasScenes;
              const active = step === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setStep(st.value)}
                  className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium transition disabled:opacity-35 ${
                    active ? "bg-white/[0.1] text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                      active ? "bg-accent text-on-accent" : "bg-white/[0.08] text-ink-2"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {st.label}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-3">
            {hasScenes && (
              <span className="hidden items-center gap-2.5 md:flex">
                <ProgressBar value={progress.done} total={progress.total} className="w-20" />
                <span className="text-[12px] tabular-nums text-ink-2">
                  {progress.done}/{progress.total}
                </span>
              </span>
            )}
            {jobCount > 0 && !batch && (
              <Badge tone="working">Generando {jobCount}</Badge>
            )}
            {batch && step !== "production" && (
              <button onClick={() => setStep("production")}>
                <Badge tone="working">
                  Produciendo {batch.current}/{batch.total}
                </Badge>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        {step === "idea" && (
          <IdeaStep
            form={form}
            onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
            aspectRatio={comic.aspectRatio}
            sceneCount={comic.scenes.length}
            generating={generating}
            saving={savingMeta}
            error={ideaError}
            onSave={saveMeta}
            onGenerate={generate}
            onDelete={removeComic}
          />
        )}
        {step === "storyboard" && (
          <StoryboardStep
            comic={comic}
            activeId={activeId}
            openSceneId={openSceneId}
            onOpenScene={openScene}
            onChanged={() => load()}
            onGoToIdea={() => setStep("idea")}
            batch={batch}
            stopping={stopping}
            errorCount={batchErrors.length}
            onRun={(kind) => runBatch([kind])}
            onStop={stopBatch}
            onGoToProduction={() => setStep("production")}
            jobs={jobs}
          />
        )}
        {step === "production" && (
          <ProductionStep
            comic={comic}
            batch={batch}
            stopping={stopping}
            errors={batchErrors}
            onRun={(kind) => runBatch([kind])}
            onRunAll={() => runBatch(["voces", "ilustraciones", "animaciones"])}
            onStop={stopBatch}
            onOpenScene={openScene}
          />
        )}
        {step === "preview" && (
          <PreviewStep
            comic={comic}
            mixing={mixing || serverJobs.running[comic.id] === "mezcla"}
            mixError={mixError ?? serverJobs.errors[comic.id] ?? null}
            onMix={mix}
            onGoToProduction={() => setStep("production")}
            onChanged={() => load()}
          />
        )}
      </main>
    </div>
  );
}
