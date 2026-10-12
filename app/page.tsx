"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatUsd, type ComicSummary, type CostSummary, type ProviderBalance } from "@/lib/comic";
import { Badge, Button, Card, Dialog, Logo, Notice, ProgressBar, Spinner, inputClass, labelClass } from "@/components/ui";
import type { DesktopRelease } from "@/app/api/desktop-release/route";

type Settings = { desktop: boolean; openai: boolean; replicate: boolean };

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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function loadSettings() {
    api<Settings>("/api/settings")
      .then(setSettings)
      .catch(() => setSettings(null));
  }

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
    loadSettings();
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
          <div className="flex items-center gap-2">
            {settings?.desktop ? (
              <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
                Ajustes
              </Button>
            ) : (
              settings && (
                <Button variant="secondary" size="sm" onClick={() => setDownloadOpen(true)}>
                  <AppleIcon /> Descargar app
                </Button>
              )
            )}
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              + Nuevo proyecto
            </Button>
          </div>
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

        {settings?.desktop && (!settings.openai || !settings.replicate) && (
          <div className="mb-8">
            <Notice tone="warn">
              Para generar contenido, agrega tus claves de OpenAI y Replicate.{" "}
              <button type="button" className="font-semibold underline" onClick={() => setSettingsOpen(true)}>
                Abrir Ajustes
              </button>
            </Notice>
          </div>
        )}

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
        <DownloadAppDialog open={downloadOpen} onClose={() => setDownloadOpen(false)} />
        {settings?.desktop && (
          <SettingsDialog
            open={settingsOpen}
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onSaved={() => {
              setSettingsOpen(false);
              loadSettings();
            }}
          />
        )}
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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor" aria-hidden>
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.54zM14.18 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z" />
    </svg>
  );
}

const ARCH_LABELS: Record<DesktopRelease["downloads"][number]["arch"], { title: string; hint: string }> = {
  arm64: { title: "Mac con Apple Silicon", hint: "Chips M1, M2, M3, M4 o posteriores" },
  x64: { title: "Mac con Intel", hint: "Modelos anteriores a 2021" },
};

// Descarga de la app para Mac desde la última versión publicada en GitHub Releases.
function DownloadAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [release, setRelease] = useState<DesktopRelease | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api<{ release: DesktopRelease | null }>("/api/desktop-release")
      .then((r) => setRelease(r.release))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo consultar la versión"));
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Narra para Mac">
      <p className="mb-5 text-[14px] text-ink-2">
        La misma app, instalada en tu Mac. Tus proyectos y archivos se guardan en tu equipo; solo necesitas tus claves de
        OpenAI y Replicate.
      </p>

      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : release === undefined ? (
        <div className="flex items-center gap-2 py-6 text-[14px] text-ink-2">
          <Spinner /> Buscando la última versión…
        </div>
      ) : release === null ? (
        <Notice>La primera versión para Mac se está preparando. Vuelve a intentarlo en unos minutos.</Notice>
      ) : (
        <>
          <div className="mb-2 flex flex-col gap-2">
            {release.downloads.map((d) => (
              <a
                key={d.arch}
                href={d.url}
                className="flex items-center gap-4 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.08] hover:ring-accent/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-ink">
                  <AppleIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{ARCH_LABELS[d.arch].title}</span>
                  <span className="block text-[12px] text-ink-3">
                    {ARCH_LABELS[d.arch].hint} · {d.sizeMb} MB
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-accent">Descargar</span>
              </a>
            ))}
          </div>
          <p className="mb-5 text-[12px] text-ink-3">
            Versión {release.version}. ¿No sabes cuál es tu Mac? Menú  → Acerca de este Mac → Chip o Procesador.
          </p>
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
            <p className="mb-1 font-medium text-ink">Cómo instalarla</p>
            <ol className="list-decimal pl-4">
              <li>Abre el archivo .dmg y arrastra Narra a Aplicaciones.</li>
              <li>
                La app aún no está firmada por Apple: la primera vez, haz clic derecho sobre Narra → Abrir. Si macOS indica
                que está dañada, ejecuta en Terminal:{" "}
                <code className="rounded bg-black/40 px-1 py-0.5 text-[12px]">xattr -cr /Applications/Narra.app</code>
              </li>
            </ol>
          </div>
        </>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialog>
  );
}

// Claves de API de la app de escritorio. Nunca se muestran: solo se indica si están guardadas.
function SettingsDialog({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [openai, setOpenai] = useState("");
  const [replicate, setReplicate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/settings", { method: "PUT", body: { openai, replicate } });
      setOpenai("");
      setReplicate("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { label: "Clave de OpenAI", value: openai, set: setOpenai, saved: settings.openai, placeholder: "sk-…" },
    { label: "Clave de Replicate", value: replicate, set: setReplicate, saved: settings.replicate, placeholder: "r8_…" },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Ajustes">
      <form onSubmit={submit}>
        {fields.map((f) => (
          <div key={f.label} className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-medium text-ink-2">{f.label}</label>
              <Badge tone={f.saved ? "done" : "warn"}>{f.saved ? "Guardada" : "Falta"}</Badge>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputClass}
              placeholder={f.saved ? "Deja vacío para conservar la actual" : f.placeholder}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
            />
          </div>
        ))}
        <p className="mb-6 text-[12px] text-ink-3">Las claves se guardan solo en este Mac.</p>

        {error && (
          <div className="mb-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!openai.trim() && !replicate.trim()}>
            Guardar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
