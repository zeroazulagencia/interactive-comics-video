"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, comicProgress, DEFAULT_VIDEO_PROMPT, type Comic, type Panel } from "@/lib/comic";
import { Badge, SegmentedControl } from "@/components/ui";
import { IdeaStep, type IdeaForm } from "@/components/studio/IdeaStep";
import { StoryboardStep } from "@/components/studio/StoryboardStep";
import { ProductionStep, type Batch, type BatchError, type TaskKind } from "@/components/studio/ProductionStep";
import { PreviewStep } from "@/components/studio/PreviewStep";

type Step = "idea" | "storyboard" | "production" | "preview";

function initialStep(c: Comic): Step {
  if (c.scenes.length === 0) return "idea";
  return comicProgress(c).complete ? "preview" : "storyboard";
}

function formFrom(c: Comic): IdeaForm {
  return {
    title: c.title,
    prompt: c.prompt ?? "",
    artStyle: c.artStyle ?? "",
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

  // Aviso al cerrar la pestaña mientras hay trabajo en curso.
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
      const data = await api<Comic>(`/api/comics/${id}/generate`, { method: "POST" });
      setComic(data);
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
            await api(`/api/scenes/${s.id}/generate-voice`, { method: "POST" });
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
            await api(`/api/panels/${panel.id}/generate-image`, { method: "POST" });
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
          await api(`/api/panels/${panel.id}/generate-video`, { method: "POST", body: { duration: 5 } });
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
      const data = await api<Comic>(`/api/comics/${id}/mix`, { method: "POST" });
      setComic(data);
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
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/" className="shrink-0 text-[13px] text-accent hover:underline">
              ‹ Proyectos
            </Link>
            <span className="truncate text-[15px] font-semibold">{comic.title}</span>
          </div>

          <SegmentedControl<Step>
            value={step}
            onChange={setStep}
            options={[
              { value: "idea", label: "Idea" },
              { value: "storyboard", label: "Storyboard", disabled: !hasScenes },
              { value: "production", label: "Producción", disabled: !hasScenes },
              { value: "preview", label: "Vista previa", disabled: !hasScenes },
            ]}
          />

          <div className="flex flex-1 items-center justify-end gap-3">
            {hasScenes && (
              <span className="hidden text-[12px] tabular-nums text-ink-2 md:inline">
                {progress.done}/{progress.total} listos
              </span>
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
            mixing={mixing}
            mixError={mixError}
            onMix={mix}
            onGoToProduction={() => setStep("production")}
            onChanged={() => load()}
          />
        )}
      </main>
    </div>
  );
}
