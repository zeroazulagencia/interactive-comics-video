"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/comic";
import { Button, Card, Notice, SegmentedControl, Spinner, Switch, inputClass, labelClass } from "@/components/ui";
import { VIDEO_STYLES, type VideoStyle } from "@/lib/styles";
import { DEFAULT_VOICE_SPEED, VOICES } from "@/lib/voices";

export type IdeaForm = {
  title: string;
  prompt: string;
  artStyle: string;
  motionStyle: string;
  voiceId: string;
  voiceSpeed: number;
  videoDuration: number;
  videoTransition: boolean;
  animateCharacters: boolean;
};

const DURATIONS = [0, 3, 4, 5, 6, 8] as const;

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
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

        <div className="mt-8 flex flex-col gap-5 border-t border-white/[0.06] pt-6">
          <div>
            <label className={labelClass}>Duración de cada clip</label>
            <SegmentedControl
              options={DURATIONS.map((d) => ({ value: String(d), label: d === 0 ? "Automática" : `${d} s` }))}
              value={String(form.videoDuration)}
              onChange={(v) => onChange({ videoDuration: Number(v) })}
            />
            <p className="mt-2 text-[12px] text-ink-3">
              Automática: la mitad de la narración de cada escena (entre 3 y 8 s), así el clip no se ralentiza en la
              mezcla. Cada segundo de animación cuesta US$ 0.02.
            </p>
          </div>
          <div>
            <Switch
              label="Transición entre los 2 paneles de cada escena"
              checked={form.videoTransition}
              onChange={(v) => onChange({ videoTransition: v })}
            />
            <p className="mt-1 text-[12px] text-ink-3">
              La animación del panel 1 termina en la ilustración del panel 2. Sin costo extra.
            </p>
          </div>
          <div>
            <Switch
              label="Animar personajes (movimiento sutil)"
              checked={form.animateCharacters}
              onChange={(v) => onChange({ animateCharacters: v })}
            />
            <p className="mt-1 text-[12px] text-ink-3">
              Respiración, parpadeo y gestos pequeños. Puede deformar rostros; por defecto solo se mueven la cámara y el
              ambiente.
            </p>
          </div>
        </div>
      </Card>

      <VoiceCard voiceId={form.voiceId} speed={form.voiceSpeed} onChange={(patch) => onChange(patch)} />

      <div className="sticky bottom-4 z-30 flex flex-col gap-3">
        {generating && <Notice>Escribiendo las escenas; puede tardar hasta un minuto.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2/90 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.1] backdrop-blur-xl">
          <p className="min-w-0 flex-1 text-[12px] text-ink-3">
            {sceneCount > 0
              ? "Los cambios en la historia o el estilo gráfico solo se aplican al regenerar las escenas. La voz y las opciones de animación, a lo próximo que generes."
              : "Escribe la historia, elige un estilo y genera las escenas."}
          </p>
          <Button variant="secondary" onClick={onSave} loading={saving}>
            Guardar cambios
          </Button>
          <Button variant="primary" onClick={onGenerate} loading={generating} disabled={!form.prompt.trim()}>
            {generating ? "Escribiendo escenas…" : sceneCount ? "Regenerar escenas" : "Generar escenas"}
          </Button>
        </div>
      </div>

      <button onClick={onDelete} className="self-center text-[13px] text-red-400 hover:underline">
        Eliminar proyecto
      </button>
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

// Voz del narrador: una por proyecto, con muestra para escucharla.
function VoiceCard({
  voiceId,
  speed,
  onChange,
}: {
  voiceId: string;
  speed: number;
  onChange: (patch: { voiceId?: string; voiceSpeed?: number }) => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function preview(id: string) {
    audio.current?.pause();
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    setErr(null);
    setLoadingId(id);
    try {
      const { url } = await api<{ url: string }>(`/api/voices/${id}/sample`);
      const a = new Audio(url);
      a.playbackRate = speed / DEFAULT_VOICE_SPEED;
      a.onended = () => setPlayingId(null);
      audio.current = a;
      await a.play();
      setPlayingId(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo reproducir la muestra");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="p-8">
      <h3 className="mb-1 text-[17px] font-semibold tracking-tight">Voz del narrador</h3>
      <p className="mb-5 text-[13px] text-ink-2">
        Una sola voz para todo el proyecto. Pulsa ▶ para escucharla. Si la cambias, el estudio te ofrece rehacer las voces
        ya generadas.
      </p>
      {(["Hombre", "Mujer"] as const).map((group) => (
        <div key={group} className="mb-5">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{group}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VOICES.filter((v) => v.group === group).map((v) => {
              const active = v.id === voiceId;
              return (
                <div
                  key={v.id}
                  className={`flex items-center gap-1 rounded-xl p-1 ring-1 transition ${
                    active ? "bg-accent/10 ring-accent" : "bg-white/[0.03] ring-white/[0.08] hover:ring-white/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => preview(v.id)}
                    aria-label={`Escuchar ${v.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] text-ink-2 hover:bg-white/[0.08] hover:text-ink"
                  >
                    {loadingId === v.id ? <Spinner /> : playingId === v.id ? "■" : "▶"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ voiceId: v.id })}
                    className={`min-w-0 flex-1 truncate py-1.5 pr-2 text-left text-[13px] font-medium ${
                      active ? "text-ink" : "text-ink-2"
                    }`}
                  >
                    {active && "✓ "}
                    {v.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <label className={labelClass}>Velocidad · {speed.toFixed(2)}×</label>
      <input
        type="range"
        min={0.8}
        max={1.4}
        step={0.05}
        value={speed}
        onChange={(e) => onChange({ voiceSpeed: Number(e.target.value) })}
        className="w-full max-w-sm accent-[#ffb224]"
      />
      {err && (
        <div className="mt-4">
          <Notice tone="error">{err}</Notice>
        </div>
      )}
    </Card>
  );
}
