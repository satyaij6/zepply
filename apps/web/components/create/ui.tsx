"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** A big tappable choice. `multi` shows a checkbox corner instead of a radio dot. */
export function OptionCard({
  selected,
  onClick,
  title,
  hint,
  visual,
  multi = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  visual?: ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={`group relative flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition sm:p-5 ${
        selected ? "border-app-ink shadow-[0_0_0_1px_var(--color-app-ink)]" : "border-app-line hover:border-zinc-300"
      }`}
    >
      {visual && <span className="shrink-0">{visual}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-app-ink">{title}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-app-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center border transition ${multi ? "rounded-md" : "rounded-full"} ${
          selected ? "border-app-ink bg-app-ink text-white" : "border-zinc-300 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </button>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-app-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[13px] text-app-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-app-line bg-white px-3.5 text-[15px] text-app-ink placeholder:text-app-faint outline-none transition focus:border-app-ink focus:shadow-[0_0_0_1px_var(--color-app-ink)]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} h-11 ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-[88px] resize-y py-2.5 leading-relaxed ${props.className ?? ""}`} />;
}

/** The little shape icon for a video size. */
export function RatioIcon({ ratio, active = false }: { ratio: string; active?: boolean }) {
  const [w, h] = ratio.split(":").map(Number);
  const scale = 30 / Math.max(w, h);
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-app-ink" : "bg-app-bg"}`}>
      <span
        className={`block rounded-[4px] border-2 ${active ? "border-white" : "border-app-ink"}`}
        style={{ width: Math.round(w * scale * 0.8), height: Math.round(h * scale * 0.8) }}
      />
    </span>
  );
}
