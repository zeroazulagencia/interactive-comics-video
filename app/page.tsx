"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type ComicSummary } from "@/lib/comic";
import { Badge, Button, Dialog, Notice, ProgressBar, inputClass, labelClass } from "@/components/ui";

function statusOf(c: ComicSummary): { tone: "done" | "working" | "warn" | "pending"; label: string } {
  if (c.finalVideoUrl && c.finalVideoOutdated) return { tone: "warn", label: "Video desactualizado" };
  if (c.finalVideoUrl) return { tone: "done", label: "Video listo" };
  if (c.sceneCount === 0) return { tone: "pending", label: "Borrador" };
  if (c.total > 0 && c.done === c.total) return { tone: "working", label: "Listo para mezclar" };
  return { tone: "working", label: "En producción" };
}

export default function Home() {
  const router = useRouter();
  const [comics, setComics] = useState<ComicSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setComics(await api<ComicSummary[]>("/api/comics"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos");
      setComics([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(c: ComicSummary) {
    if (!confirm(`¿Eliminar "${c.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api(`/api/comics/${c.id}`, { method: "DELETE" });
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
    load();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Estudio</p>
          <h1 className="text-5xl font-semibold tracking-tight">Interactive Comics</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-2">
            De una idea a un video narrado: escenas, ilustraciones, voz y animación.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
          Nuevo proyecto
        </Button>
      </header>

      {loadError && (
        <div className="mb-8">
          <Notice tone="error">{loadError}</Notice>
        </div>
      )}

      {comics === null ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-3xl bg-black/[0.04]" />
          ))}
        </div>
      ) : comics.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-black/10 py-24 text-center transition hover:border-accent/40 hover:bg-white"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-3xl text-accent">+</span>
          <span className="text-lg font-medium">Crea tu primer proyecto</span>
          <span className="text-ink-2">Escribe una idea y el estudio la convierte en escenas.</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {comics.map((c) => {
            const status = statusOf(c);
            return (
              <div key={c.id} className="group relative">
                <Link
                  href={`/comics/${c.id}`}
                  className="block overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_28px_rgba(0,0,0,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_rgba(0,0,0,0.10)]"
                >
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#e8ecf5] to-[#f5f0ea]">
                    {c.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverImage}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[13px] text-ink-3">Sin portada aún</div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur-md">
                      {c.aspectRatio === "vertical" ? "9:16" : "16:9"}
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="truncate text-[17px] font-semibold tracking-tight">{c.title}</h2>
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {c.sceneCount} {c.sceneCount === 1 ? "escena" : "escenas"} · editado{" "}
                      {new Date(c.updatedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {c.total > 0 && <ProgressBar value={c.done} total={c.total} className="flex-1" />}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => remove(c)}
                  aria-label={`Eliminar ${c.title}`}
                  className="absolute right-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-red-600 opacity-0 backdrop-blur-md transition group-hover:opacity-100 focus:opacity-100"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => router.push(`/comics/${id}`)}
      />
    </main>
  );
}

function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"horizontal" | "vertical">("horizontal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const comic = await api<{ id: string }>("/api/comics", {
        method: "POST",
        body: { title: title.trim(), aspectRatio },
      });
      onCreated(comic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proyecto");
      setSaving(false);
    }
  }

  const formats = [
    { value: "horizontal" as const, label: "Horizontal", hint: "YouTube · 16:9", box: "h-9 w-16" },
    { value: "vertical" as const, label: "Vertical", hint: "Reels · 9:16", box: "h-14 w-8" },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Nuevo proyecto">
      <form onSubmit={submit}>
        <label className={labelClass}>Título</label>
        <input
          autoFocus
          className={`${inputClass} mb-5`}
          placeholder="Ej. La última carta del faro"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className={labelClass}>Formato</label>
        <div className="mb-6 grid grid-cols-2 gap-3">
          {formats.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setAspectRatio(f.value)}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 px-3 py-4 transition ${
                aspectRatio === f.value ? "border-accent bg-accent/[0.04]" : "border-black/[0.08] hover:border-black/20"
              }`}
            >
              <span className="flex h-14 items-center">
                <span className={`rounded-md border-2 ${aspectRatio === f.value ? "border-accent" : "border-ink-3"} ${f.box}`} />
              </span>
              <span className="text-center">
                <span className="block text-[15px] font-medium">{f.label}</span>
                <span className="block text-[12px] text-ink-2">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mb-6 text-[12px] text-ink-3">El formato no se puede cambiar después.</p>

        {error && (
          <div className="mb-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!title.trim()}>
            Crear proyecto
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
