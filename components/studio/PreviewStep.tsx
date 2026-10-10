"use client";

import { useEffect, useRef, useState } from "react";
import { comicProgress, splitSentences, DEFAULT_AUTHOR, type Comic, type Scene } from "@/lib/comic";
import { Button, Card, Notice } from "@/components/ui";

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
}: {
  comic: Comic;
  mixing: boolean;
  mixError: string | null;
  onMix: () => void;
  onGoToProduction: () => void;
}) {
  const p = comicProgress(comic);

  if (comic.scenes.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-ink-2">Genera primero las escenas en el paso Idea.</div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PreviewPlayer comic={comic} />

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

        <div className="mt-5 flex flex-col gap-3">
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
