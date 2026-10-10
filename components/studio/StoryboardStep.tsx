"use client";

import { sceneProgress, type Comic, type Scene } from "@/lib/comic";
import { Badge, Button, Sheet } from "@/components/ui";
import { SceneEditor } from "./SceneEditor";

export function StoryboardStep({
  comic,
  activeId,
  openSceneId,
  onOpenScene,
  onChanged,
  onGoToIdea,
}: {
  comic: Comic;
  activeId: string | null;
  openSceneId: string | null;
  onOpenScene: (id: string | null) => void;
  onChanged: () => void;
  onGoToIdea: () => void;
}) {
  const vertical = comic.aspectRatio === "vertical";
  const openIndex = comic.scenes.findIndex((s) => s.id === openSceneId);
  const openScene = openIndex >= 0 ? comic.scenes[openIndex] : null;

  if (comic.scenes.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent">✦</span>
        <h2 className="text-2xl font-semibold tracking-tight">Todavía no hay escenas</h2>
        <p className="text-ink-2">Escribe la historia y elige un estilo; el estudio crea el storyboard por ti.</p>
        <Button variant="primary" size="lg" onClick={onGoToIdea}>
          Ir a la idea
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`grid gap-6 ${
          vertical ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {comic.scenes.map((scene, i) => (
          <SceneTile
            key={scene.id}
            scene={scene}
            index={i}
            vertical={vertical}
            activeId={activeId}
            onClick={() => onOpenScene(scene.id)}
          />
        ))}
      </div>

      <Sheet
        open={!!openScene}
        onClose={() => onOpenScene(null)}
        header={
          openScene && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Escena anterior"
                disabled={openIndex <= 0}
                onClick={() => onOpenScene(comic.scenes[openIndex - 1].id)}
              >
                ‹
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Escena siguiente"
                disabled={openIndex >= comic.scenes.length - 1}
                onClick={() => onOpenScene(comic.scenes[openIndex + 1].id)}
              >
                ›
              </Button>
              <span className="ml-2 truncate text-[15px] font-semibold">
                Escena {openIndex + 1} <span className="font-normal text-ink-3">de {comic.scenes.length}</span>
              </span>
            </div>
          )
        }
      >
        {openScene && (
          <SceneEditor
            key={openScene.id}
            scene={openScene}
            aspectRatio={comic.aspectRatio}
            activeId={activeId}
            onChanged={onChanged}
            onDeleted={() => {
              onOpenScene(null);
              onChanged();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function SceneTile({
  scene,
  index,
  vertical,
  activeId,
  onClick,
}: {
  scene: Scene;
  index: number;
  vertical: boolean;
  activeId: string | null;
  onClick: () => void;
}) {
  const p = sceneProgress(scene);
  const working = activeId === scene.id || scene.panels.some((panel) => panel.id === activeId);
  const tone = (done: boolean, partial = false) => (done ? "done" : partial ? "working" : "pending") as "done" | "working" | "pending";

  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-3xl bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_28px_rgba(0,0,0,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_rgba(0,0,0,0.10)] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
    >
      <div className="relative grid grid-cols-2 gap-px bg-black/[0.06]">
        {[0, 1].map((k) => {
          const panel = scene.panels[k];
          return (
            <div key={k} className={`${vertical ? "aspect-[9/16]" : "aspect-video"} overflow-hidden bg-[#f0f0f3]`}>
              {panel?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panel.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-ink-3">Panel {k + 1}</div>
              )}
            </div>
          );
        })}
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold tabular-nums backdrop-blur-md">
          {String(index + 1).padStart(2, "0")}
        </span>
        {working && (
          <span className="absolute right-3 top-3">
            <Badge tone="working">Generando</Badge>
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="truncate text-[16px] font-semibold tracking-tight">{scene.title || `Escena ${index + 1}`}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] text-ink-2">
          {scene.narration || "Sin narración"}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone={tone(p.voice)}>Voz</Badge>
          <Badge tone={tone(p.images === p.panels && p.panels > 0, p.images > 0)}>
            Ilustración {p.images}/{p.panels}
          </Badge>
          <Badge tone={tone(p.videos === p.panels && p.panels > 0, p.videos > 0)}>
            Animación {p.videos}/{p.panels}
          </Badge>
        </div>
      </div>
    </button>
  );
}
