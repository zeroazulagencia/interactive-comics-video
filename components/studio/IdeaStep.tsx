"use client";

import { DEFAULT_AUTHOR } from "@/lib/comic";
import { Button, Card, Notice, Switch, inputClass, labelClass } from "@/components/ui";

export type IdeaForm = {
  title: string;
  prompt: string;
  artStyle: string;
  author: string;
  subtitlesEnabled: boolean;
};

const STYLE_PRESETS: { name: string; style: string; swatch: string }[] = [
  {
    name: "Acuarela",
    style: "Acuarela editorial desaturada, luz cálida y tenue, grano de papel, bordes suaves.",
    swatch: "from-[#f3e7d3] via-[#d9c6a5] to-[#9fb4b8]",
  },
  {
    name: "Novela gráfica",
    style: "Novela gráfica de tinta, alto contraste, sombras profundas, paleta limitada, trazos expresivos.",
    swatch: "from-[#111] via-[#444] to-[#c23b22]",
  },
  {
    name: "Cine realista",
    style:
      "Fotograma cinematográfico realista, lente anamórfica, iluminación dramática, profundidad de campo baja, gradación de color de película.",
    swatch: "from-[#0f2a3a] via-[#2e5363] to-[#e0a458]",
  },
  {
    name: "Óleo clásico",
    style: "Pintura al óleo clásica, pinceladas visibles, claroscuro, paleta terrosa, composición de museo.",
    swatch: "from-[#3b2414] via-[#8a5a2b] to-[#d9b26f]",
  },
  {
    name: "Animación 3D",
    style: "Animación 3D estilizada tipo película, iluminación global suave, colores ricos, texturas detalladas.",
    swatch: "from-[#7cc6fe] via-[#b892ff] to-[#ffc2e2]",
  },
  {
    name: "Grabado antiguo",
    style: "Grabado antiguo en blanco y negro, líneas de plumilla, sombreado cruzado, textura de papel envejecido.",
    swatch: "from-[#f4efe4] via-[#bdb6a6] to-[#3d3a35]",
  },
];

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
            className="mb-1 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight outline-none placeholder:text-ink-3"
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
          <h3 className="mb-1 text-[17px] font-semibold tracking-tight">Estilo visual</h3>
          <p className="mb-5 text-[13px] text-ink-2">Se aplica a todas las ilustraciones para mantener coherencia.</p>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STYLE_PRESETS.map((p) => {
              const active = form.artStyle.trim() === p.style;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onChange({ artStyle: p.style })}
                  className={`overflow-hidden rounded-2xl border-2 text-left transition ${
                    active ? "border-accent" : "border-transparent hover:border-black/10"
                  }`}
                >
                  <span className={`block h-16 bg-gradient-to-br ${p.swatch}`} />
                  <span className="block bg-black/[0.03] px-3 py-2 text-[13px] font-medium">{p.name}</span>
                </button>
              );
            })}
          </div>
          <label className={labelClass}>Descripción del estilo</label>
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            placeholder="Elige un estilo o descríbelo con tus palabras…"
            value={form.artStyle}
            onChange={(e) => onChange({ artStyle: e.target.value })}
          />
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h3 className="mb-4 text-[15px] font-semibold">Créditos y video</h3>
          <label className={labelClass}>Autor</label>
          <input
            className={`${inputClass} mb-5`}
            placeholder={DEFAULT_AUTHOR}
            value={form.author}
            onChange={(e) => onChange({ author: e.target.value })}
          />
          <Switch
            label="Subtítulos"
            checked={form.subtitlesEnabled}
            onChange={(v) => onChange({ subtitlesEnabled: v })}
          />
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <Button variant="primary" size="lg" onClick={onGenerate} loading={generating} disabled={!form.prompt.trim()}>
            {generating ? "Escribiendo escenas…" : sceneCount ? "Regenerar escenas" : "Generar escenas"}
          </Button>
          <Button variant="secondary" onClick={onSave} loading={saving}>
            Guardar cambios
          </Button>
          {sceneCount > 0 && !generating && (
            <p className="text-center text-[12px] text-ink-3">
              Regenerar reemplaza las {sceneCount} escenas actuales y su contenido.
            </p>
          )}
          {generating && <Notice>Esto puede tardar hasta un minuto.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </Card>

        <button onClick={onDelete} className="self-center text-[13px] text-red-600 hover:underline">
          Eliminar proyecto
        </button>
      </div>
    </div>
  );
}
