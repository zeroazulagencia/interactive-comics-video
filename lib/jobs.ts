// Generaciones en curso (y fallos recientes) por escena, panel o comic. Viven en
// la memoria del servidor: la interfaz las recupera al recargar la página.

import type { ComicJobs, JobKind } from "@/lib/comic";

type Job = { comicId: string; kind: JobKind };
type Failure = { comicId: string; message: string; at: number };

const FAILURE_TTL_MS = 15 * 60_000;

const store = globalThis as unknown as { narraJobs?: Map<string, Job>; narraFailures?: Map<string, Failure> };
const running = (store.narraJobs ??= new Map());
const failures = (store.narraFailures ??= new Map());

// Devuelve false si ya hay una generación en curso para ese elemento.
export function startJob(targetId: string, comicId: string, kind: JobKind): boolean {
  if (running.has(targetId)) return false;
  running.set(targetId, { comicId, kind });
  failures.delete(targetId);
  return true;
}

export function finishJob(targetId: string, error?: string) {
  const job = running.get(targetId);
  running.delete(targetId);
  if (error && job) failures.set(targetId, { comicId: job.comicId, message: error, at: Date.now() });
}

export function comicJobs(comicId: string): ComicJobs {
  const result: ComicJobs = { running: {}, errors: {} };
  running.forEach((job, id) => {
    if (job.comicId === comicId) result.running[id] = job.kind;
  });
  failures.forEach((f, id) => {
    if (Date.now() - f.at > FAILURE_TTL_MS) failures.delete(id);
    else if (f.comicId === comicId) result.errors[id] = f.message;
  });
  return result;
}

export const JOB_BUSY = { error: "Ya se está generando." };
