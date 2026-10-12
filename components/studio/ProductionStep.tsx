"use client";

import { BUDGET_USD, comicProgress, estimatePending, formatUsd, missingPortraits, type Comic } from "@/lib/comic";
import { Badge, Button, Card, Notice, ProgressBar, Spinner } from "@/components/ui";

// "revoces" rehace las voces generadas con una voz anterior del proyecto.
export type TaskKind = "voces" | "revoces" | "retratos" | "ilustraciones" | "animaciones";

export type Batch = {
  kind: TaskKind;
  label: string;
  current: number;
  total: number;
};

export type BatchError = { label: string; sceneId: string | null };

export function ProductionStep({
  comic,
  batch,
  stopping,
  errors,
  onRun,
  onRunAll,
  onStop,
  onOpenScene,
}: {
  comic: Comic;
  batch: Batch | null;
  stopping: boolean;
  errors: BatchError[];
  onRun: (kind: TaskKind) => void;
  onRunAll: () => void;
  onStop: () => void;
  onOpenScene: (sceneId: string) => void;
}) {
  const p = comicProgress(comic);
  const pending = p.total - p.done;
  const missing = missingPortraits(comic).length;
  const portraits = comic.characters.filter((c) => c.imageUrl).length;
  const spent = comic.costUsd ?? 0;
  const est = estimatePending(comic);
  const projected = spent + est.voces + est.retratos + est.ilustraciones + est.animaciones + est.mezcla;

  const rows: { kind: TaskKind; title: string; detail: string; done: number; total: number; note?: string }[] = [
    { kind: "voces", title: "Voces", detail: "Narración de cada escena", done: p.voices, total: p.scenes },
    ...(comic.characters.length > 0
      ? [
          {
            kind: "retratos" as const,
            title: "Retratos",
            detail: "Referencia de cada personaje",
            done: portraits,
            total: portraits + missing,
          },
        ]
      : []),
    {
      kind: "ilustraciones",
      title: "Ilustraciones",
      detail: "Una imagen por panel",
      done: p.images,
      total: p.panels,
      note: missing > 0 ? "Antes se generan los retratos que falten." : undefined,
    },
    {
      kind: "animaciones",
      title: "Animaciones",
      detail: "Movimiento de cada ilustración",
      done: p.videos,
      total: p.panels,
      note: p.images < p.panels ? "Solo se animan los paneles que ya tienen ilustración." : undefined,
    },
  ];

  if (comic.scenes.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-ink-2">Genera primero las escenas en el paso Idea.</div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card className="p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {p.complete ? "Todo listo para mezclar" : batch ? "Produciendo…" : "Producir todo"}
            </h2>
            <p className="mt-1 text-[15px] text-ink-2">
              {p.complete
                ? "Ve a la vista previa para revisar y mezclar el video final."
                : batch
                  ? batch.label
                  : `Genera voces, ilustraciones y animaciones faltantes (${pending} pendientes), en ese orden.`}
            </p>
          </div>
          {batch ? (
            <Button variant="secondary" size="lg" onClick={onStop} loading={stopping}>
              {stopping ? "Deteniendo…" : "Detener"}
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={onRunAll} disabled={p.complete}>
              Producir todo
            </Button>
          )}
        </div>
        <div className="mt-6 flex items-center gap-4">
          <ProgressBar value={p.done} total={p.total} className="flex-1" />
          <span className="text-[13px] tabular-nums text-ink-2">
            {p.done}/{p.total}
          </span>
        </div>
        <p className={`mt-4 text-[13px] tabular-nums ${projected > BUDGET_USD ? "text-red-300" : "text-ink-2"}`}>
          Gastado {formatUsd(spent)} · falta generar ~{formatUsd(projected - spent)} · total estimado ~
          {formatUsd(projected)} de un límite de {formatUsd(BUDGET_USD)}
        </p>
        {batch && (
          <div className="mt-5">
            <Notice>
              Las tareas se ejecutan desde esta pestaña, una por una. Mantenla abierta hasta que termine.
            </Notice>
          </div>
        )}
      </Card>

      <Card className="divide-y divide-white/[0.06]">
        {rows.map((r) => {
          const running = batch?.kind === r.kind;
          const complete = r.total > 0 && r.done === r.total;
          return (
            <div key={r.kind} className="flex flex-wrap items-center gap-4 px-6 py-5">
              <div className="w-44 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{r.title}</span>
                  {running && <Spinner className="h-3 w-3 text-accent" />}
                </div>
                <p className="text-[12px] text-ink-3">{r.detail}</p>
              </div>
              <div className="min-w-[140px] flex-1">
                <ProgressBar value={r.done} total={r.total} />
                <p className="mt-1.5 text-[12px] tabular-nums text-ink-2">
                  {running && batch ? `Generando ${batch.current} de ${batch.total}` : `${r.done} de ${r.total}`}
                  {r.note && !complete && !running && <span className="text-ink-3"> · {r.note}</span>}
                </p>
              </div>
              {complete ? (
                <Badge tone="done">Completo</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => onRun(r.kind)} disabled={!!batch}>
                  Generar faltantes
                </Button>
              )}
            </div>
          );
        })}
      </Card>

      {errors.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 text-[15px] font-semibold text-red-400">
            {errors.length} {errors.length === 1 ? "tarea falló" : "tareas fallaron"}
          </h3>
          <ul className="flex flex-col gap-2">
            {errors.map((e, i) => (
              <li key={i} className="text-[13px] text-ink-2">
                {e.sceneId ? (
                  <button className="text-left hover:text-accent hover:underline" onClick={() => onOpenScene(e.sceneId!)}>
                    {e.label}
                  </button>
                ) : (
                  e.label
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-ink-3">Vuelve a ejecutar &quot;Generar faltantes&quot; para reintentar.</p>
        </Card>
      )}
    </div>
  );
}
