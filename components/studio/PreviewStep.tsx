"use client";

import { useEffect, useRef, useState } from "react";
import {
  api,
  comicProgress,
  musicPromptFor,
  splitSentences,
  DEFAULT_AUTHOR,
  DEFAULT_VIDEO_PROMPT,
  type Comic,
  type Scene,
} from "@/lib/comic";
import { Button, Card, Notice, Switch, inputClass, labelClass } from "@/components/ui";

const TITLE_SECONDS = 3;

// Duración estimada de una escena sin audio (~2.5 palabras por segundo).
function estimateSeconds(scene: Scene): number {
  const words = (scene.narration ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, words / 2.5);
}

export function PreviewStep({
  comic,
  mixing,
  mixError,
  onMix,
  onGoToProduction,
  onChanged,
}: {
  comic: Comic;
  mixing: boolean;
  mixError: string | null;
  onMix: () => void;
  onGoToProduction: () => void;
  onChanged: () => void;
}) {
  const p = comicProgress(comic);
  const finalUpToDate = !!comic.finalVideoUrl && !comic.finalVideoOutdated;
  const [author, setAuthor] = useState(comic.author ?? "");
  const [settingsErr, setSettingsErr] = useState<string | null>(null);

  useEffect(() => setAuthor(comic.author ?? ""), [comic.author]);

  async function saveSettings(body: { author?: string; subtitlesEnabled?: boolean }) {
    setSettingsErr(null);
    try {
      await api(`/api/comics/${comic.id}`, { method: "PATCH", body });
      onChanged();
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  if (comic.scenes.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-ink-2">Genera primero las escenas en el paso Idea.</div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {!finalUpToDate && <PreviewPlayer comic={comic} />}

      <Card className="p-8">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">Video final</h2>
            <p className="mt-1 text-[15px] text-ink-2">
              Une escenas, narración, música de fondo, subtítulos y títulos en un solo mp4.
            </p>
          </div>
          {p.complete ? (
            <Button variant="primary" size="lg" onClick={onMix} loading={mixing}>
              {mixing ? "Mezclando…" : comic.finalVideoUrl ? "Volver a mezclar" : "Mezclar video"}
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={onGoToProduction}>
              Completar producción ({p.done}/{p.total})
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 items-end gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={labelClass}>Autor (tarjetas de inicio y cierre)</label>
            <input
              className={inputClass}
              placeholder={DEFAULT_AUTHOR}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onBlur={() => author !== (comic.author ?? "") && saveSettings({ author })}
            />
          </div>
          <div className="pb-1.5 sm:w-48">
            <Switch
              label="Subtítulos"
              checked={comic.subtitlesEnabled}
              onChange={(v) => saveSettings({ subtitlesEnabled: v })}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {settingsErr && <Notice tone="error">{settingsErr}</Notice>}
          {mixing && <Notice>Generando música y mezclando. Puede tardar varios minutos; no cierres la pestaña.</Notice>}
          {mixError && <Notice tone="error">{mixError}</Notice>}
          {comic.finalVideoUrl && comic.finalVideoOutdated && !mixing && (
            <Notice tone="warn">Hubo cambios después de la última mezcla. Este video está desactualizado.</Notice>
          )}
        </div>

        {comic.finalVideoUrl && (
          <div className="mt-6">
            <video
              controls
              preload="metadata"
              src={comic.finalVideoUrl}
              className={`w-full rounded-2xl bg-black ${comic.aspectRatio === "vertical" ? "mx-auto max-w-sm" : ""}`}
            />
            <div className="mt-4 flex justify-end">
              <a
                href={comic.finalVideoUrl}
                download={`${comic.title}.mp4`}
                className="inline-flex h-9 items-center rounded-full bg-black/[0.05] px-4 text-sm font-medium hover:bg-black/[0.08]"
              >
                Descargar mp4
              </a>
            </div>
          </div>
        )}
      </Card>

      <YoutubeCard comic={comic} onChanged={onChanged} />
      <PromptsCard comic={comic} onChanged={onChanged} />
    </div>
  );
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={!text.trim()}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copiado" : label}
    </Button>
  );
}

// Título, descripción y etiquetas para publicar en YouTube (generados y editables).
function YoutubeCard({ comic, onChanged }: { comic: Comic; onChanged: () => void }) {
  const [title, setTitle] = useState(comic.youtubeTitle ?? "");
  const [description, setDescription] = useState(comic.youtubeDescription ?? "");
  const [tags, setTags] = useState(comic.youtubeTags ?? "");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(comic.youtubeTitle ?? "");
    setDescription(comic.youtubeDescription ?? "");
    setTags(comic.youtubeTags ?? "");
  }, [comic.youtubeTitle, comic.youtubeDescription, comic.youtubeTags]);

  const hasText = !!(comic.youtubeTitle || comic.youtubeDescription);

  async function generate() {
    if (hasText && !confirm("Se reemplazará el texto actual para YouTube. ¿Continuar?")) return;
    setErr(null);
    setGenerating(true);
    try {
      await api(`/api/comics/${comic.id}/youtube`, { method: "POST" });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error generando el texto para YouTube");
    } finally {
      setGenerating(false);
    }
  }

  async function save(field: "youtubeTitle" | "youtubeDescription" | "youtubeTags", value: string) {
    if (value === (comic[field] ?? "")) return;
    try {
      await api(`/api/comics/${comic.id}`, { method: "PATCH", body: { [field]: value } });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  return (
    <Card className="p-8">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Texto para YouTube</h2>
          <p className="mt-1 text-[15px] text-ink-2">Título, descripción y etiquetas basados en la historia. Puedes editarlos.</p>
        </div>
        <Button variant={hasText ? "secondary" : "primary"} size="lg" onClick={generate} loading={generating}>
          {generating ? "Escribiendo…" : hasText ? "Regenerar texto" : "Generar texto"}
        </Button>
      </div>

      {err && (
        <div className="mt-5">
          <Notice tone="error">{err}</Notice>
        </div>
      )}

      {hasText && (
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className={labelClass}>Título ({title.length}/100)</label>
              <CopyButton text={title} />
            </div>
            <input
              className={`${inputClass} mt-2`}
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => save("youtubeTitle", title)}
            />
          </div>
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className={labelClass}>Descripción</label>
              <CopyButton text={description} />
            </div>
            <textarea
              className={`${inputClass} mt-2 resize-y leading-relaxed`}
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save("youtubeDescription", description)}
            />
          </div>
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className={labelClass}>Etiquetas ({tags.length}/500)</label>
              <CopyButton text={tags} />
            </div>
            <textarea
              className={`${inputClass} mt-2 resize-y`}
              rows={2}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onBlur={() => save("youtubeTags", tags)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

// Todos los prompts usados para producir el video, listos para copiar.
function PromptsCard({ comic, onChanged }: { comic: Comic; onChanged: () => void }) {
  const savedMusic = musicPromptFor(comic);
  const [music, setMusic] = useState(savedMusic);
  const [musicErr, setMusicErr] = useState<string | null>(null);

  useEffect(() => setMusic(savedMusic), [savedMusic]);

  async function saveMusic() {
    if (!music.trim() || music === savedMusic) return;
    setMusicErr(null);
    try {
      await api(`/api/comics/${comic.id}`, { method: "PATCH", body: { musicPrompt: music } });
      onChanged();
    } catch (e) {
      setMusicErr(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  const scenes = comic.scenes.map((s, i) => ({
    id: s.id,
    name: `Escena ${i + 1}${s.title ? ` · ${s.title}` : ""}`,
    items: [
      { label: "Narración", text: s.narration ?? "" },
      ...s.panels.flatMap((p) => [
        { label: `Ilustración panel ${p.order}`, text: p.imagePrompt ?? "" },
        { label: `Animación panel ${p.order}`, text: p.videoPrompt || DEFAULT_VIDEO_PROMPT },
      ]),
    ],
  }));
  const general = [
    { label: "Historia", text: comic.prompt ?? "" },
    { label: "Estilo visual", text: comic.artStyle ?? "" },
    { label: "Música de fondo", text: music },
  ];
  const all = [
    ...general.map((g) => `## ${g.label}\n${g.text}`),
    ...scenes.map((s) => `## ${s.name}\n${s.items.map((it) => `${it.label}:\n${it.text}`).join("\n\n")}`),
  ].join("\n\n");

  return (
    <Card className="p-8">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Prompts</h2>
          <p className="mt-1 text-[15px] text-ink-2">Historia, estilo, música y los prompts de cada escena.</p>
        </div>
        <CopyButton text={all} label="Copiar todos" />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {general.slice(0, 2).map((g) => (
          <PromptItem key={g.label} label={g.label} text={g.text} />
        ))}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink-2">Música de fondo · editable, se usa al mezclar</span>
            <CopyButton text={music} />
          </div>
          <textarea
            className={`${inputClass} resize-y font-mono text-[12px] leading-relaxed`}
            rows={3}
            value={music}
            onChange={(e) => setMusic(e.target.value)}
            onBlur={saveMusic}
          />
          {musicErr && (
            <div className="mt-3">
              <Notice tone="error">{musicErr}</Notice>
            </div>
          )}
        </div>
        {scenes.map((s) => (
          <details key={s.id} className="group rounded-2xl bg-canvas px-4 py-3">
            <summary className="cursor-pointer list-none text-[14px] font-semibold">
              <span className="mr-2 inline-block text-ink-3 transition group-open:rotate-90">›</span>
              {s.name}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {s.items.map((it) => (
                <PromptItem key={it.label} label={it.label} text={it.text} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}

function PromptItem({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink">{text || "—"}</p>
    </div>
  );
}

// Reproduce el comic en el navegador (escena por escena, con su voz y subtítulos)
// antes de mezclar. No incluye música.
function PreviewPlayer({ comic }: { comic: Comic }) {
  const scenes = comic.scenes;
  const vertical = comic.aspectRatio === "vertical";
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1); // -1 = tarjeta de título
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(TITLE_SECONDS);

  const scene = index >= 0 ? scenes[index] : null;
  const hasAudio = !!scene?.audioUrl;

  function next() {
    if (index < scenes.length - 1) {
      setIndex((i) => i + 1);
    } else {
      setPlaying(false);
      setIndex(-1);
    }
  }

  // Cambio de escena: reinicia el reloj y carga el audio correspondiente.
  useEffect(() => {
    setT(0);
    const a = audioRef.current;
    if (!a) return;
    if (scene?.audioUrl) {
      a.src = scene.audioUrl;
      setDur(estimateSeconds(scene));
      if (playing) a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
      a.removeAttribute("src");
      setDur(scene ? estimateSeconds(scene) : TITLE_SECONDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, scene?.audioUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !hasAudio) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, hasAudio]);

  // Reloj: usa el tiempo del audio si existe; si no, avanza por tiempo estimado.
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      const a = audioRef.current;
      setT((prev) => (hasAudio && a ? a.currentTime : prev + 0.1));
    }, 100);
    return () => clearInterval(iv);
  }, [playing, hasAudio, index]);

  useEffect(() => {
    if (playing && !hasAudio && t >= dur) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, dur, playing, hasAudio]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const half = dur / 2;
  const panelIdx = t < half ? 0 : 1;
  const sentences = scene ? splitSentences(scene.narration ?? "") : [];
  const subtitle =
    comic.subtitlesEnabled && sentences.length > 0
      ? sentences[Math.min(sentences.length - 1, Math.floor(t / (dur / sentences.length)))]
      : null;

  return (
    <div>
      <div
        className={`relative mx-auto overflow-hidden rounded-3xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.18)] ${
          vertical ? "aspect-[9/16] max-w-sm" : "aspect-video"
        }`}
      >
        {scene ? (
          scene.panels.slice(0, 2).map((panel, k) => (
            <div
              key={`${scene.id}-${k}`}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: panelIdx === k ? 1 : 0 }}
            >
              {panel.videoUrl ? (
                <video src={panel.videoUrl} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              ) : panel.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panel.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ animation: playing && panelIdx === k ? `kenburns ${half}s ease-out forwards` : undefined }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-white/40">
                  Panel {k + 1} sin ilustración
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
            <h3 className={`font-semibold tracking-tight ${vertical ? "text-3xl" : "text-5xl"}`}>{comic.title}</h3>
            <p className="mt-3 text-[15px] text-white/60">By {comic.author || DEFAULT_AUTHOR}</p>
          </div>
        )}

        {subtitle && (
          <div className="absolute inset-x-0 bottom-8 flex justify-center px-[5%]">
            <p className="animate-fade-in rounded-xl bg-black/55 px-4 py-2 text-center font-serif text-[clamp(13px,2.2vw,22px)] leading-snug text-white">
              {subtitle}
            </p>
          </div>
        )}

        {!playing && (
          <button
            onClick={() => setPlaying(true)}
            aria-label="Reproducir vista previa"
            className="absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/20"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/85 pl-1 text-3xl text-ink shadow-xl backdrop-blur-md">
              ▶
            </span>
          </button>
        )}
      </div>

      <audio ref={audioRef} preload="auto" onLoadedMetadata={(e) => setDur(e.currentTarget.duration || dur)} onEnded={next} />

      <div className={`mx-auto mt-5 flex items-center gap-4 ${vertical ? "max-w-sm" : ""}`}>
        <Button variant="secondary" size="sm" onClick={() => setPlaying((v) => !v)} className="w-24">
          {playing ? "Pausa" : "Reproducir"}
        </Button>
        <div className="flex flex-1 gap-1">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              title={s.title ?? `Escena ${i + 1}`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.08]"
            >
              <span
                className="block h-full rounded-full bg-ink"
                style={{ width: i < index ? "100%" : i === index ? `${Math.min(100, (t / dur) * 100)}%` : "0%" }}
              />
            </button>
          ))}
        </div>
        <span className="w-24 text-right text-[12px] tabular-nums text-ink-2">
          {index < 0 ? "Portada" : `Escena ${index + 1}/${scenes.length}`}
        </span>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-3">
        Vista previa sin música. La música y las transiciones finales se agregan al mezclar.
      </p>
    </div>
  );
}
