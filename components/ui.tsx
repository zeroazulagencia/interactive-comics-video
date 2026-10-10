"use client";

import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "plain" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  secondary: "bg-black/[0.05] text-ink hover:bg-black/[0.08]",
  plain: "text-accent hover:bg-accent/[0.08]",
  danger: "text-red-600 hover:bg-red-50",
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
      className={`rounded-3xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_28px_rgba(0,0,0,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";
export const labelClass = "mb-1.5 block text-[13px] font-medium text-ink-2";

type Tone = "done" | "pending" | "working" | "warn";
const TONES: Record<Tone, string> = {
  done: "bg-emerald-50 text-emerald-700",
  pending: "bg-black/[0.04] text-ink-2",
  working: "bg-accent/10 text-accent",
  warn: "bg-amber-50 text-amber-700",
};
const DOTS: Record<Tone, string> = {
  done: "bg-emerald-500",
  pending: "bg-ink-3/50",
  working: "bg-accent animate-pulse",
  warn: "bg-amber-500",
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
    <div className={`h-1.5 overflow-hidden rounded-full bg-black/[0.06] ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-accent"}`}
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
    <div className="inline-flex rounded-full bg-black/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 disabled:opacity-40 ${
            value === o.value ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink"
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
          checked ? "bg-emerald-500" : "bg-black/[0.12]"
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
      <div className="animate-fade-in absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="animate-sheet-in absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-canvas shadow-2xl">
        <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white/80 px-6 py-3 backdrop-blur-xl">
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
      <div className="animate-fade-in absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : "bg-accent/[0.07] text-[#0058b0]";
  return <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${cls}`}>{children}</div>;
}
