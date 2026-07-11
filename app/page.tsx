"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Comic = {
  id: string;
  title: string;
  description: string | null;
};

export default function Home() {
  const [comics, setComics] = useState<Comic[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"horizontal" | "vertical">("horizontal");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/comics");
    const data = await res.json();
    setComics(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createComic(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), aspectRatio }),
    });
    setTitle("");
    setAspectRatio("horizontal");
    setCreating(false);
    setSaving(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este proyecto?")) return;
    await fetch(`/api/comics/${id}`, { method: "DELETE" });
    load();
  }

  const isEmpty = comics !== null && comics.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Interactive Comics</h1>

        {comics !== null && comics.length > 0 && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo proyecto
          </button>
        )}
      </header>

      {creating && (
        <form onSubmit={createComic} className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-gray-700">Nuevo proyecto</h2>

          <label className="mb-1 block text-sm font-medium text-gray-700">Título</label>
          <input
            autoFocus
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Título del proyecto…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Proporción</label>
          <div className="mb-5 flex gap-3">
            <button
              type="button"
              onClick={() => setAspectRatio("horizontal")}
              className={`rounded-md border px-3 py-2 text-sm ${
                aspectRatio === "horizontal"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Horizontal (YouTube, 16:9)
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio("vertical")}
              className={`rounded-md border px-3 py-2 text-sm ${
                aspectRatio === "vertical"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Vertical (Instagram/Reels, 9:16)
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setTitle("");
              }}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isEmpty && !creating && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-500">Todavía no tenés proyectos.</p>
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear primer proyecto
          </button>
        </div>
      )}

      {comics !== null && comics.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {comics.map((comic, i) => (
            <li key={comic.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <Link href={`/comics/${comic.id}`} className="flex flex-1 items-baseline gap-3">
                <span className="text-xs text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-medium text-gray-900 hover:text-blue-600">{comic.title}</span>
              </Link>
              <button
                onClick={() => remove(comic.id)}
                aria-label={`Eliminar ${comic.title}`}
                className="text-sm text-gray-400 hover:text-red-600"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
