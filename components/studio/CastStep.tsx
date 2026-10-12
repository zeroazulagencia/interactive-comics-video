"use client";

import { useEffect, useState } from "react";
import { api, apiGenerate, missingPortraits, type Character, type Comic } from "@/lib/comic";
import { Badge, Button, Card, Notice, Spinner, inputClass, labelClass } from "@/components/ui";
import type { Jobs } from "./SceneEditor";
import type { Batch } from "./ProductionStep";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

// Elenco del proyecto: personajes con su aspecto fijo y su retrato de referencia,
// que se usa al ilustrar cada panel donde aparecen.
export function CastStep({
  comic,
  jobs,
  batch,
  activeId,
  stopping,
  onRunPortraits,
  onStop,
  onChanged,
  onReplace,
  onContinue,
}: {
  comic: Comic;
  jobs: Jobs;
  batch: Batch | null;
  activeId: string | null;
  stopping: boolean;
  onRunPortraits: () => void;
  onStop: () => void;
  onChanged: () => void;
  onReplace: (c: Comic) => void;
  onContinue: () => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const missing = missingPortraits(comic);
  const appearances = new Map<string, number>();
  for (const s of comic.scenes) {
    for (const p of s.panels) {
      for (const c of p.characters ?? []) appearances.set(c.id, (appearances.get(c.id) ?? 0) + 1);
    }
  }

  async function detect() {
    setErr(null);
    setDetecting(true);
    try {
      const before = comic.characters.length;
      const data = await apiGenerate<Comic>(
        `/api/comics/${comic.id}/characters/detect`,
        { method: "POST" },
        { comicId: comic.id, done: (c) => c.characters.length > before }
      );
      if (data) onReplace(data);
      else onChanged();
    } catch (e) {
      setErr(errMsg(e, "No se pudo detectar el elenco"));
    } finally {
      setDetecting(false);
    }
  }

  async function add() {
    setErr(null);
    setAdding(true);
    try {
      await api(`/api/comics/${comic.id}/characters`, { method: "POST", body: {} });
      onChanged();
    } catch (e) {
      setErr(errMsg(e, "No se pudo agregar el personaje"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card className="p-8">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">Elenco</h2>
            <p className="mt-1 max-w-2xl text-[15px] text-ink-2">
              Cada personaje tiene un aspecto fijo y un retrato de referencia. Al ilustrar, se envían los retratos de
              quienes aparecen en el panel para que se vean iguales en todas las escenas. Genera los retratos antes que las
              ilustraciones.
            </p>
          </div>
          {batch?.kind === "retratos" ? (
            <Button variant="secondary" onClick={onStop} loading={stopping}>
              {stopping ? "Deteniendo…" : "Detener"}
            </Button>
          ) : (
            <Button variant="primary" onClick={onRunPortraits} disabled={missing.length === 0 || !!batch}>
              {missing.length > 0 ? `Generar retratos faltantes (${missing.length})` : "✓ Retratos listos"}
            </Button>
          )}
        </div>
        {batch?.kind === "retratos" && (
          <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-2">
            <Spinner className="h-3.5 w-3.5 text-accent" />
            {batch.label} · {batch.current} de {batch.total}
          </p>
        )}
        {err && (
          <div className="mt-4">
            <Notice tone="error">{err}</Notice>
          </div>
        )}
      </Card>

      {comic.characters.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-ink-2">
            Este proyecto no tiene elenco todavía. Detéctalo a partir de las escenas ya escritas o agrega los personajes a
            mano.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={detect} loading={detecting}>
              {detecting ? "Leyendo las escenas…" : "Detectar personajes"}
            </Button>
            <Button variant="secondary" onClick={add} loading={adding}>
              Agregar personaje
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {comic.characters.map((c) => (
              <CharacterCard
                key={c.id}
                comicId={comic.id}
                character={c}
                appearances={appearances.get(c.id) ?? 0}
                jobs={jobs}
                busy={activeId === c.id}
                onChanged={onChanged}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" onClick={add} loading={adding}>
              Agregar personaje
            </Button>
            <Button variant="secondary" onClick={detect} loading={detecting}>
              {detecting ? "Leyendo las escenas…" : "Volver a detectar en las escenas"}
            </Button>
            <Button variant="primary" onClick={onContinue}>
              Continuar al storyboard
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CharacterCard({
  comicId,
  character,
  appearances,
  jobs,
  busy,
  onChanged,
}: {
  comicId: string;
  character: Character;
  appearances: number;
  jobs: Jobs;
  busy: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);
  const [err, setErr] = useState<string | null>(null);
  const generating = jobs.running[character.id] === "retrato" || busy;

  useEffect(() => setName(character.name), [character.name]);
  useEffect(() => setDescription(character.description), [character.description]);

  async function save(body: { name?: string; description?: string }) {
    try {
      await api(`/api/characters/${character.id}`, { method: "PATCH", body });
      onChanged();
    } catch (e) {
      setErr(errMsg(e, "No se pudo guardar"));
    }
  }

  function portrait() {
    const before = character.imageUrl;
    const text = description;
    setErr(null);
    jobs.run(character.id, "retrato", async () => {
      if (text !== character.description) {
        await api(`/api/characters/${character.id}`, { method: "PATCH", body: { description: text } });
      }
      await apiGenerate(
        `/api/characters/${character.id}/generate-portrait`,
        { method: "POST" },
        {
          comicId,
          targetId: character.id,
          done: (c) => {
            const url = c.characters.find((x) => x.id === character.id)?.imageUrl;
            return !!url && url !== before;
          },
        }
      );
    });
  }

  async function remove() {
    if (!confirm(`¿Quitar a ${character.name} del elenco? Se quita también de los paneles donde aparece.`)) return;
    try {
      await api(`/api/characters/${character.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setErr(errMsg(e, "No se pudo eliminar"));
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-white/[0.04]">
        {character.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={character.imageUrl} alt={`Retrato de ${character.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-3">Sin retrato todavía</div>
        )}
        {generating && (
          <div className="animate-fade-in absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[13px] font-medium shadow-sm">
              <Spinner />
              Dibujando retrato…
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3">
          <Badge tone={appearances > 0 ? "pending" : "warn"}>
            {appearances > 0 ? `En ${appearances} ${appearances === 1 ? "panel" : "paneles"}` : "Sin paneles"}
          </Badge>
        </span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <input
          className="w-full border-0 bg-transparent p-0 text-[18px] font-semibold tracking-tight outline-none placeholder:text-ink-3"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== character.name && save({ name: name.trim() })}
        />
        <div>
          <label className={labelClass}>Aspecto (en inglés)</label>
          <textarea
            className={`${inputClass} resize-y text-[13px] leading-relaxed`}
            rows={4}
            placeholder="Edad, rostro, pelo, ropa, rasgos que no cambian…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== character.description && save({ description })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={character.imageUrl ? "secondary" : "primary"}
            size="sm"
            onClick={portrait}
            loading={generating}
            disabled={!description.trim()}
          >
            {character.imageUrl ? "Regenerar retrato" : "Generar retrato"}
          </Button>
          <Button variant="danger" size="sm" onClick={remove}>
            Quitar
          </Button>
        </div>
        {character.imageUrl && appearances > 0 && (
          <p className="text-[12px] text-ink-3">
            Si regeneras el retrato, vuelve a ilustrar sus paneles para que coincidan.
          </p>
        )}
        {(err || jobs.errors[character.id]) && <Notice tone="error">{err ?? jobs.errors[character.id]}</Notice>}
      </div>
    </Card>
  );
}
