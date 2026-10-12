"use client";

import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "plain" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-[0_8px_24px_-10px_rgba(255,178,36,0.7)] font-semibold",
  secondary: "bg-white/[0.06] text-ink ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1]",
  plain: "text-accent hover:bg-accent/10",
  danger: "text-red-400 hover:bg-red-500/10",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-[15px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl bg-surface ring-1 ring-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_60px_-30px_rgba(0,0,0,0.8)] ${className}`}
    >
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-4 focus:ring-accent/15";
export const labelClass = "mb-1.5 block text-[13px] font-medium text-ink-2";

type Tone = "done" | "pending" | "working" | "warn";
const TONES: Record<Tone, string> = {
  done: "bg-emerald-400/10 text-emerald-300",
  pending: "bg-white/[0.06] text-ink-2",
  working: "bg-accent/10 text-accent",
  warn: "bg-orange-400/10 text-orange-300",
};
const DOTS: Record<Tone, string> = {
  done: "bg-emerald-400",
  pending: "bg-ink-3",
  working: "bg-accent animate-pulse",
  warn: "bg-orange-400",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONES[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

export function ProgressBar({ value, total, className = "" }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/[0.08] ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-accent to-[#ff5e3a]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/[0.06]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 disabled:opacity-40 ${
            value === o.value ? "bg-white/[0.12] text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-[15px] text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-white/[0.15]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </label>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

// Panel lateral deslizable (derecha).
export function Sheet({
  open,
  onClose,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="animate-sheet-in absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/[0.08] bg-canvas shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-surface/80 px-6 py-3 backdrop-blur-xl">
          <div className="min-w-0 flex-1">{header}</div>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}

// Diálogo centrado.
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-md rounded-2xl bg-surface p-7 shadow-2xl ring-1 ring-white/[0.08]">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "bg-red-500/10 text-red-300 ring-red-500/20"
      : tone === "warn"
        ? "bg-orange-400/10 text-orange-200 ring-orange-400/20"
        : "bg-accent/[0.07] text-[#ffd894] ring-accent/20";
  return <div className={`rounded-xl px-4 py-3 text-[14px] leading-relaxed ring-1 ${cls}`}>{children}</div>;
}

export const APP_NAME = "Narra";

// Marca de la app: un haz de luz que sale de un punto, en el degradado de la marca.
export function Logo({ size = "md", withName = true }: { size?: "sm" | "md"; withName?: boolean }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${box} relative flex items-center justify-center bg-gradient-to-br from-[#ffd27a] via-accent to-[#ff5e3a] shadow-[0_6px_20px_-6px_rgba(255,140,40,0.8)]`}
      >
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden>
          <path d="M5 5.5v13l7.5-6.5z" fill="#1a1204" />
          <path d="M13 8.5l6-3v13l-6-3z" fill="#1a1204" opacity="0.55" />
        </svg>
      </span>
      {withName && (
        <span className={`font-semibold tracking-tight ${size === "sm" ? "text-[15px]" : "text-[19px]"}`}>{APP_NAME}</span>
      )}
    </span>
  );
}
