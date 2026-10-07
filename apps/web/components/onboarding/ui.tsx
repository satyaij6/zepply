"use client";

import { ArrowLeft, ArrowRight, Loader2, Plus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { STEPS } from "@/lib/onboarding/options";

/** Logo and "Skip for now". Progress is the "Step N of 5" line above each title. */
export function Header({ onSkip, skipping }: { onSkip: () => void; skipping: boolean }) {
  return (
    <header className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-8">
      <span className="font-[Glitz,Poppins,sans-serif] text-[24px] leading-none text-app-ink">Zepply</span>
      <button
        type="button"
        onClick={onSkip}
        disabled={skipping}
        className="shrink-0 rounded-full border border-app-line bg-app-card px-4 py-1.5 text-sm font-medium text-app-ink transition hover:border-app-ink/30 disabled:opacity-60"
      >
        {skipping ? "Opening…" : "Skip for now"}
      </button>
    </header>
  );
}

/** Below this, shrinking would make text too small: the step scrolls instead */
const MIN_SCALE = 0.72;

/**
 * Fits a step into the screen on desktop (no page scrolling): if it's taller than the space
 * under the header, it's scaled down to fit. Phones keep normal scrolling.
 */
export function FitFrame({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      if (window.innerWidth < 1024) return setFit(null);
      // offsetHeight ignores the transform, so this is always the natural height
      const natural = i.offsetHeight;
      const scale = Math.max(MIN_SCALE, Math.min(1, o.clientHeight / natural));
      setFit((f) => (f && Math.abs(f.scale - scale) < 0.005 && f.height === natural ? f : { scale, height: natural }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    observer.observe(i);
    measure();
    return () => observer.disconnect();
  }, []);

  const scaled = fit && fit.scale < 1;
  return (
    <div ref={outer} className="min-h-0 flex-1 lg:overflow-y-auto">
      <div style={scaled ? { height: fit.height * fit.scale, overflow: "hidden" } : undefined}>
        <div ref={inner} style={scaled ? { transform: `scale(${fit.scale})`, transformOrigin: "top center" } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Eyebrow({ step }: { step: number }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">Step {step} of {STEPS.length}</p>;
}

/** Page title: plain words plus an optional serif accent, as on the landing page */
export function Title({ children, accent, after }: { children: ReactNode; accent?: string; after?: string }) {
  return (
    <h1 className="mt-2 font-display text-[clamp(30px,3.2vw,46px)] font-semibold leading-[1.05] tracking-[-0.035em] text-app-ink">
      {children}
      {accent && (
        <>
          {" "}
          <em className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em]">{accent}</em>
        </>
      )}
      {after}
    </h1>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 max-w-[660px] text-base leading-relaxed text-app-muted">{children}</p>;
}

export function SectionLabel({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-4">
      <h2 className="text-[14px] font-semibold text-app-ink">{children}</h2>
      {note && <span className="text-xs text-app-faint">{note}</span>}
    </div>
  );
}

/** A choice tile with a title, a hint and an optional icon; radio or checkbox semantics. */
export function Choice({
  selected,
  onClick,
  title,
  hint,
  icon,
  multi = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  icon?: ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={`group flex h-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition ${
        selected ? "border-electric bg-electric-wash/40 ring-1 ring-electric" : "border-app-line bg-app-card hover:border-app-ink/25"
      }`}
    >
      {icon && <span className={`mt-px shrink-0 ${selected ? "text-electric" : "text-app-ink"}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-snug text-app-ink">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-app-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-semibold text-app-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-app-line bg-app-card px-4 text-[15px] text-app-ink outline-none transition placeholder:text-app-faint focus:border-electric focus:ring-2 focus:ring-electric/20";

/** Editable list of short tags: remove with ×, add by typing and pressing Enter. */
export function TagEditor({ tags, onChange, max, placeholder }: { tags: string[]; onChange: (next: string[]) => void; max: number; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()) && tags.length < max) onChange([...tags, t.slice(0, 40)]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-bg px-3 py-1.5 text-sm text-app-ink">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-app-faint hover:text-app-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {tags.length < max && (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-app-line px-3 py-1 text-sm">
          <Plus className="h-3.5 w-3.5 text-app-faint" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={placeholder}
            className="w-28 bg-transparent py-0.5 text-app-ink outline-none placeholder:text-app-faint"
            aria-label={placeholder}
          />
        </span>
      )}
    </div>
  );
}

/** Back and Continue, with a busy state and an inline error line. */
export function Nav({
  onBack,
  onNext,
  nextLabel = "Continue",
  disabled,
  busy,
  error,
  extra,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  /** A secondary action shown after the main button */
  extra?: ReactNode;
}) {
  return (
    <div className="mt-7">
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-6">
        {onBack && (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-[15px] font-medium text-app-ink hover:opacity-70">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || busy}
          className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-app-ink px-7 text-[15px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(22,22,26,0.6)] transition hover:bg-black disabled:cursor-not-allowed disabled:bg-app-faint disabled:shadow-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
        {extra}
      </div>
    </div>
  );
}

/** A handwritten note with a curved arrow, as on the landing page */
export function HandNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-hand text-[20px] leading-tight text-app-muted ${className}`}>{children}</p>;
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}
