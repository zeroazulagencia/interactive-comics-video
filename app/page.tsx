"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatUsd, type ComicSummary, type CostSummary, type ProviderBalance } from "@/lib/comic";
import { Badge, Button, Card, Dialog, Logo, Notice, ProgressBar, inputClass, labelClass } from "@/components/ui";

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
  const [costs, setCosts] = useState<CostSummary | null>(null);

  async function load() {
    try {
      setComics(await api<ComicSummary[]>("/api/comics"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos");
      setComics([]);
    }
    api<CostSummary>("/api/costs")
      .then(setCosts)
      .catch(() => setCosts(null));
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

  const finished = comics?.filter((c) => c.finalVideoUrl).length ?? 0;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo />
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            + Nuevo proyecto
          </Button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        <header className="animate-rise-in mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1 text-[12px] font-medium text-ink-2 ring-1 ring-inset ring-white/[0.08]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Estudio de video narrado
            </p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.03em] md:text-6xl">
              De una idea a una
              <br />
              <span className="text-brand">historia en video.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-2">
              Guion, ilustraciones, voz, animación y música en un solo lugar.
            </p>
          </div>
          {comics && comics.length > 0 && (
            <div className="flex gap-8 text-right">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{comics.length}</p>
                <p className="text-[12px] text-ink-3">{comics.length === 1 ? "proyecto" : "proyectos"}</p>
              </div>
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{finished}</p>
                <p className="text-[12px] text-ink-3">{finished === 1 ? "video terminado" : "videos terminados"}</p>
              </div>
            </div>
          )}
        </header>

        {loadError && (
          <div className="mb-8">
            <Notice tone="error">{loadError}</Notice>
          </div>
        )}

        {costs && <CostsPanel costs={costs} onChanged={load} />}

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Proyectos</h2>
        </div>

        {comics === null ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : comics.length === 0 ? (
          <button
            onClick={() => setCreating(true)}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 py-24 text-center transition hover:border-accent/40 hover:bg-surface"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-3xl text-accent ring-1 ring-accent/20">+</span>
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
                    className="block overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.07] transition duration-300 hover:-translate-y-1 hover:ring-white/[0.16] hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]"
                  >
                    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-surface-2 to-surface">
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
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />
                      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/10 backdrop-blur-md">
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
                        {c.costUsd > 0 && (
                          <span className="ml-auto text-[12px] tabular-nums text-ink-2" title="Gasto en APIs">
                            {formatUsd(c.costUsd)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => remove(c)}
                    aria-label={`Eliminar ${c.title}`}
                    className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-red-300 ring-1 ring-white/10 opacity-0 backdrop-blur-md transition group-hover:opacity-100 focus:opacity-100"
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
    </div>
  );
}

const PROVIDER_LABELS: Record<ProviderBalance["provider"], string> = {
  openai: "OpenAI",
  replicate: "Replicate",
};

// Costo promedio por video y saldo estimado de cada API.
function CostsPanel({ costs, onChanged }: { costs: CostSummary; onChanged: () => void }) {
  return (
    <Card className="mb-12 grid grid-cols-1 divide-y divide-white/[0.06] md:grid-cols-3 md:divide-x md:divide-y-0">
      <div className="p-6">
        <p className="text-[13px] font-medium text-ink-2">Costo promedio por video</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          {costs.avgPerVideoUsd !== null ? formatUsd(costs.avgPerVideoUsd) : "—"}
        </p>
        <p className="mt-1 text-[12px] text-ink-3">
          {costs.videoCount
            ? `Promedio de ${costs.videoCount} ${costs.videoCount === 1 ? "video terminado" : "videos terminados"}, con reintentos.`
            : "Aparece al terminar el primer video con costos registrados."}
        </p>
        {costs.videosLeft !== null && (
          <p className="mt-3 text-[13px] font-medium">
            El saldo alcanza para ~{costs.videosLeft} {costs.videosLeft === 1 ? "video" : "videos"}
          </p>
        )}
      </div>
      {costs.providers.map((p) => (
        <ProviderBalanceCell key={p.provider} balance={p} onChanged={onChanged} />
      ))}
    </Card>
  );
}

function ProviderBalanceCell({ balance, onChanged }: { balance: ProviderBalance; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = PROVIDER_LABELS[balance.provider];
  const low = balance.remainingUsd !== null && balance.avgPerVideoUsd !== null && balance.remainingUsd < balance.avgPerVideoUsd;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/costs", { method: "PUT", body: { provider: balance.provider, amountUsd: Number(value) } });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-2">Saldo {label}</p>
        {!editing && (
          <button
            className="text-[12px] text-accent hover:underline"
            onClick={() => {
              setValue(balance.remainingUsd !== null ? balance.remainingUsd.toFixed(2) : "");
              setEditing(true);
            }}
          >
            {balance.amountUsd === null ? "Ingresar saldo" : "Actualizar"}
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            className={`${inputClass} h-9`}
            placeholder="Saldo actual en USD"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" loading={saving} disabled={value === ""}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
            ✕
          </Button>
        </form>
      ) : (
        <p className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${low ? "text-red-400" : ""}`}>
          {balance.remainingUsd !== null ? formatUsd(balance.remainingUsd) : "—"}
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      <p className="mt-1 text-[12px] text-ink-3">
        {balance.amountUsd !== null && balance.setAt
          ? `Estimado: ${formatUsd(balance.amountUsd)} el ${new Date(balance.setAt).toLocaleDateString("es", {
              day: "numeric",
              month: "short",
            })} menos ${formatUsd(balance.spentSinceUsd)} gastados aquí.`
          : `La API de ${label} no informa el saldo; ingrésalo desde su panel de facturación.`}
        {balance.avgPerVideoUsd !== null && ` Promedio por video: ${formatUsd(balance.avgPerVideoUsd)}.`}
      </p>
    </div>
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
                aspectRatio === f.value ? "border-accent bg-accent/[0.04]" : "border-white/[0.08] hover:border-white/20"
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
