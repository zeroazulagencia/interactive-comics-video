"use client";

import { useRef } from "react";
import { Button, Card, Notice, inputClass, labelClass } from "@/components/ui";
import { VIDEO_STYLES, type VideoStyle } from "@/lib/styles";

export type IdeaForm = {
  title: string;
  prompt: string;
  artStyle: string;
  motionStyle: string;
};

export function IdeaStep({
  form,
  onChange,
  aspectRatio,
  sceneCount,
  generating,
  saving,
  error,
  onSave,
  onGenerate,
  onDelete,
}: {
  form: IdeaForm;
  onChange: (patch: Partial<IdeaForm>) => void;
  aspectRatio: string;
  sceneCount: number;
  generating: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Card className="p-8">
          <input
            className="mb-1 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-[-0.02em] outline-none placeholder:text-ink-3"
            placeholder="Título del proyecto"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <p className="mb-8 text-[13px] text-ink-3">
            {aspectRatio === "vertical" ? "Vertical · 9:16" : "Horizontal · 16:9"}
          </p>

          <label className={labelClass}>La historia</label>
          <textarea
            className={`${inputClass} min-h-[160px] resize-y leading-relaxed`}
            placeholder="Describe la idea: quién, dónde, qué pasa y el tono que buscas…"
            value={form.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
          />
          <p className="mt-2 text-[12px] text-ink-3">El estudio la divide en unas 10 escenas con narración e ilustraciones.</p>
        </Card>

        <Card className="p-8">
          <h3 className="mb-1 text-[17px] font-semibold tracking-tight">Estilo del video</h3>
          <p className="mb-5 text-[13px] text-ink-2">
            Define cómo se ven las ilustraciones y cómo se animan. Pasa el mouse sobre un estilo para ver su animación.
          </p>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {VIDEO_STYLES.map((p) => (
              <StyleCard
                key={p.id}
                style={p}
                active={form.artStyle.trim() === p.artStyle && form.motionStyle.trim() === p.motionStyle}
                onSelect={() => onChange({ artStyle: p.artStyle, motionStyle: p.motionStyle })}
              />
            ))}
          </div>
          <label className={labelClass}>Estilo gráfico</label>
          <textarea
            className={`${inputClass} mb-4 resize-y`}
            rows={2}
            placeholder="Elige un estilo o descríbelo con tus palabras…"
            value={form.artStyle}
            onChange={(e) => onChange({ artStyle: e.target.value })}
          />
          <label className={labelClass}>Tipo de animación</label>
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            placeholder="Cómo se mueve la cámara y la escena (en inglés)…"
            value={form.motionStyle}
            onChange={(e) => onChange({ motionStyle: e.target.value })}
          />
          <p className="mt-2 text-[12px] text-ink-3">Se aplica a cada animación, también a las que vuelvas a generar.</p>
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="flex flex-col gap-3 p-6">
          <Button variant="primary" size="lg" onClick={onGenerate} loading={generating} disabled={!form.prompt.trim()}>
            {generating ? "Escribiendo escenas…" : sceneCount ? "Regenerar escenas" : "Generar escenas"}
          </Button>
          <Button variant="secondary" onClick={onSave} loading={saving}>
            Guardar cambios
          </Button>
          {sceneCount > 0 && !generating && (
            <p className="text-center text-[12px] text-ink-3">
              Los cambios en la historia o el estilo gráfico solo se aplican al regenerar las escenas.
            </p>
          )}
          {generating && <Notice>Esto puede tardar hasta un minuto.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </Card>

        <button onClick={onDelete} className="self-center text-[13px] text-red-400 hover:underline">
          Eliminar proyecto
        </button>
      </div>
    </div>
  );
}

// Tarjeta de estilo: imagen de referencia que reproduce su clip al pasar el mouse.
function StyleCard({ style, active, onSelect }: { style: VideoStyle; active: boolean; onSelect: () => void }) {
  const video = useRef<HTMLVideoElement>(null);

  function play() {
    video.current?.play().catch(() => {});
  }
  function stop() {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className={`group relative overflow-hidden rounded-xl text-left ring-2 transition duration-200 ${
        active ? "ring-accent shadow-[0_12px_40px_-12px_rgba(255,178,36,0.6)]" : "ring-white/[0.06] hover:ring-white/25"
      }`}
    >
      <div className="relative aspect-[3/2] bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={style.image} alt={`Referencia del estilo ${style.name}`} className="absolute inset-0 h-full w-full object-cover" />
        <video
          ref={video}
          src={style.clip}
          muted
          loop
          playsInline
          preload="none"
          poster={style.image}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 ring-1 ring-white/10 backdrop-blur-md">
          ▶ {style.animation}
        </span>
        {active && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
            ✓
          </span>
        )}
        <span className="absolute inset-x-3 bottom-2.5 text-[14px] font-semibold text-white">{style.name}</span>
      </div>
    </button>
  );
}
