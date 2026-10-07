"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { STEPS } from "@/lib/onboarding/options";

/** Logo, the five-step progress line and "Skip for now". */
export function Header({ step, onSkip, skipping }: { step: number; onSkip: () => void; skipping: boolean }) {
  return (
    <header className="flex items-center gap-6 px-4 pt-6 sm:px-8">
      <span className="font-[Glitz,Poppins,sans-serif] text-[26px] leading-none text-app-ink">Zepply</span>
      <ol className="mx-auto hidden items-start md:flex" aria-label="Setup progress">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={s.label} className="flex items-start" aria-current={current ? "step" : undefined}>
              {i > 0 && <span className={`mt-[13px] h-px w-10 lg:w-16 ${step >= n ? "bg-app-ink" : "bg-app-line"}`} />}
              <div className="flex w-[92px] flex-col items-center text-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-electric text-white" : current ? "bg-app-ink text-white" : "border border-app-line bg-app-card text-app-muted"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                </span>
                <span className={`mt-2 text-xs leading-tight ${current ? "font-semibold text-app-ink" : "text-app-muted"}`}>
                  {s.label}
                  <br />
                  {s.sub}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <span className="ml-auto text-xs font-medium text-app-muted md:hidden">Step {Math.min(step, STEPS.length)} of {STEPS.length}</span>
      <button
        type="button"
        onClick={onSkip}
        disabled={skipping}
        className="shrink-0 rounded-full border border-app-line bg-app-card px-4 py-2 text-sm font-medium text-app-ink transition hover:border-app-ink/30 disabled:opacity-60 md:ml-0"
      >
        {skipping ? "Opening…" : "Skip for now"}
      </button>
    </header>
  );
}

export function Eyebrow({ step }: { step: number }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">Step {step} of {STEPS.length}</p>;
}

/** Page title: plain words plus an optional serif accent, as on the landing page */
export function Title({ children, accent, after }: { children: ReactNode; accent?: string; after?: string }) {
  return (
    <h1 className="mt-3 font-display text-[clamp(34px,4.4vw,56px)] font-semibold leading-[1.04] tracking-[-0.035em] text-app-ink">
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
  return <p className="mt-4 max-w-[560px] text-lg leading-relaxed text-app-muted">{children}</p>;
}

export function SectionLabel({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold text-app-ink">{children}</h2>
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
      className={`group flex h-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        selected ? "border-electric bg-electric-wash/40 ring-1 ring-electric" : "border-app-line bg-app-card hover:border-app-ink/25"
      }`}
    >
      {icon && <span className={`mt-0.5 shrink-0 ${selected ? "text-electric" : "text-app-ink"}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-app-ink">{title}</span>
        {hint && <span className="mt-1 block text-sm leading-snug text-app-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-[15px] font-semibold text-app-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "h-13 w-full rounded-xl border border-app-line bg-app-card px-4 text-[15px] text-app-ink outline-none transition placeholder:text-app-faint focus:border-electric focus:ring-2 focus:ring-electric/20";

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
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <div className="mt-10">
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
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
          className="inline-flex h-13 min-w-[220px] items-center justify-center gap-2 rounded-xl bg-app-ink px-8 text-[15px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(22,22,26,0.6)] transition hover:bg-black disabled:cursor-not-allowed disabled:bg-app-faint disabled:shadow-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** A handwritten note with a curved arrow, as on the landing page */
export function HandNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-hand text-[22px] leading-tight text-app-muted ${className}`}>{children}</p>;
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
