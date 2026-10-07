"use client";

import Image from "next/image";
import { Check, Plus, SlidersHorizontal, Sparkles, Store, TrendingUp, User, Zap } from "lucide-react";
import { useState } from "react";
import { LANGUAGES, PATHS, type Path } from "@/lib/onboarding/options";
import { Lede, Nav, Title } from "./ui";

/** Shown first; the others sit behind "Add language" */
const MAIN_LANGUAGES = ["en", "te", "hi"];

export function StepPath({
  path,
  languages,
  onChange,
  onNext,
  busy,
  error,
}: {
  path: Path | null;
  languages: string[];
  onChange: (next: { path?: Path; languages?: string[] }) => void;
  onNext: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [showAll, setShowAll] = useState(() => languages.some((l) => !MAIN_LANGUAGES.includes(l)));
  const shown = LANGUAGES.filter((l) => showAll || MAIN_LANGUAGES.includes(l.value));
  const toggle = (value: string) =>
    onChange({ languages: languages.includes(value) ? languages.filter((l) => l !== value) : [...languages, value] });

  return (
    <div className="mx-auto max-w-[1160px] text-center">
      <Title accent="Zepply?">What brings you to</Title>
      <div className="flex justify-center">
        <Lede>Choose the option that fits you best. You can always switch later.</Lede>
      </div>

      <div role="radiogroup" aria-label="Your path" className="mt-7 grid gap-5 text-left lg:grid-cols-2">
        {PATHS.map((p) => (
          <PathCard key={p.value} option={p} selected={path === p.value} onSelect={() => onChange({ path: p.value })} />
        ))}
      </div>

      <h2 className="mt-6 font-display text-xl font-semibold tracking-[-0.02em] text-app-ink">What language should Zepply create in?</h2>
      <p className="mt-1 text-sm text-app-muted">You can pick more than one.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {shown.map((l) => {
          const on = languages.includes(l.value);
          return (
            <button
              key={l.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(l.value)}
              className={`inline-flex h-11 min-w-[140px] items-center justify-center gap-2.5 rounded-xl border px-4 text-[15px] font-medium transition ${
                on ? "border-electric bg-electric-wash/40 text-app-ink ring-1 ring-electric" : "border-app-line bg-app-card text-app-ink hover:border-app-ink/25"
              }`}
            >
              <Flag language={l.value} />
              {NATIVE[l.value] ?? l.label}
              {on && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-electric text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-app-line px-5 text-[15px] font-medium text-app-ink hover:border-app-ink/30"
          >
            <Plus className="h-4 w-4" /> Add language
          </button>
        )}
      </div>

      <div className="flex justify-center">
        <Nav onNext={onNext} disabled={!path || !languages.length} busy={busy} error={error} />
      </div>

      <ul className="mx-auto mt-6 grid max-w-[900px] gap-6 border-t border-app-line pt-4 text-left sm:grid-cols-3">
        {[
          { icon: <Zap className="h-5 w-5" />, title: "Set up in minutes", sub: "No credit card required" },
          { icon: <Sparkles className="h-5 w-5" />, title: "3 free sample posts", sub: "See Zepply in action" },
          { icon: <SlidersHorizontal className="h-5 w-5" />, title: "Change it any time", sub: "Switch between Creator and Business" },
        ].map((a) => (
          <li key={a.title} className="flex items-start gap-3">
            <span className="mt-0.5 text-app-ink">{a.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-app-ink">{a.title}</span>
              <span className="block text-sm text-app-muted">{a.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Each language in its own script */
const NATIVE: Record<string, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी", hinglish: "Hinglish", tenglish: "Tenglish" };

/** Small round flags: US for English (as in the design), India for the rest */
function Flag({ language }: { language: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
      <defs>
        <clipPath id={`flag-${language}`}>
          <circle cx="10" cy="10" r="10" />
        </clipPath>
      </defs>
      {language === "en" ? (
        <g clipPath={`url(#flag-${language})`}>
          <rect width="20" height="20" fill="#fff" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={i * 1.54} width="20" height="1.54" fill="#B22234" />
          ))}
          <rect width="9" height="10.8" fill="#3C3B6E" />
        </g>
      ) : (
        <g clipPath={`url(#flag-${language})`}>
          <rect width="20" height="6.67" fill="#FF9933" />
          <rect y="6.67" width="20" height="6.67" fill="#fff" />
          <rect y="13.33" width="20" height="6.67" fill="#138808" />
          <circle cx="10" cy="10" r="2.2" fill="none" stroke="#000080" strokeWidth="0.7" />
        </g>
      )}
    </svg>
  );
}

function PathCard({ option, selected, onSelect }: { option: (typeof PATHS)[number]; selected: boolean; onSelect: () => void }) {
  const creator = option.value === "creator";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative grid min-h-[260px] overflow-hidden rounded-[24px] border p-6 text-left transition sm:grid-cols-[minmax(0,1fr)_200px] ${
        selected ? "border-app-ink bg-linear-to-br from-electric-wash/60 to-app-card ring-1 ring-app-ink" : "border-app-line bg-app-card hover:border-app-ink/25"
      }`}
    >
      <span
        aria-hidden
        className={`absolute right-6 top-6 flex h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? "border-electric" : "border-app-line"}`}
      >
        {selected && <span className="h-3 w-3 rounded-full bg-electric" />}
      </span>
      <div className="relative z-10 flex flex-col">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected ? "bg-electric text-white" : "bg-app-bg text-app-ink"}`}>
          {creator ? <User className="h-6 w-6" /> : <Store className="h-6 w-6" />}
        </span>
        <span className="mt-5 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] text-app-ink">{option.label}</span>
        <span className="mt-2.5 max-w-[300px] text-base leading-snug text-app-muted">{option.lede}</span>
        <span className="mt-5 flex flex-wrap gap-2">
          {option.tags.map((t) => (
            <span key={t} className="rounded-full border border-app-line bg-app-card/80 px-3 py-1 text-[13px] text-app-ink">
              {t}
            </span>
          ))}
        </span>
      </div>
      <span aria-hidden className="relative hidden sm:block">
        {creator ? <CreatorVisual /> : <BusinessVisual />}
      </span>
    </button>
  );
}

/** A phone-style Reel with a view count and a growth chip */
function CreatorVisual() {
  return (
    <span className="absolute right-2 top-10 block h-[200px] w-[145px] rotate-[5deg]">
      <span className="absolute inset-0 overflow-hidden rounded-[26px] bg-app-side shadow-[0_24px_50px_-20px_rgba(0,0,0,0.5)]">
        <Image src="/landing/latte-pour.jpg" alt="" fill sizes="190px" className="object-cover opacity-90" />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">▶ 1.2M</span>
        <span className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-black/55 px-2.5 py-2">
          <Image src="/landing/avatar-owner.jpg" alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
          <span className="h-1.5 flex-1 rounded-full bg-white/30">
            <span className="block h-full w-2/3 rounded-full bg-white" />
          </span>
          <span className="text-[11px] text-white">0:32</span>
        </span>
      </span>
      <span className="absolute -left-5 bottom-12 flex h-11 w-11 -rotate-[5deg] items-center justify-center rounded-2xl bg-electric text-white shadow-lg">
        <TrendingUp className="h-6 w-6" />
      </span>
    </span>
  );
}

/** The café photo with a leads card and a new-DM bubble */
function BusinessVisual() {
  return (
    <span className="absolute right-0 top-10 block h-[200px] w-[185px]">
      <span className="absolute inset-x-2 top-4 bottom-6 -rotate-[4deg] overflow-hidden rounded-[22px] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.5)]">
        <Image src="/landing/cafe-day.jpg" alt="" fill sizes="210px" className="object-cover" />
      </span>
      <span className="absolute -right-2 top-0 rounded-2xl bg-app-card px-3.5 py-3 shadow-lg ring-1 ring-app-line">
        <span className="block text-[11px] font-medium text-app-muted">Leads</span>
        <span className="block font-display text-2xl font-semibold leading-tight text-app-ink">320</span>
        <span className="block text-[11px] font-semibold text-emerald-600">↑ 45%</span>
      </span>
      <span className="absolute -left-2 bottom-0 flex max-w-[180px] items-start gap-2 rounded-2xl bg-app-card px-3 py-2.5 shadow-lg ring-1 ring-app-line">
        <Image src="/landing/avatar-customer.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
        <span>
          <span className="block text-xs font-semibold text-app-ink">New DM</span>
          <span className="block text-[11px] leading-snug text-app-muted">Hi! Is this available? 😊</span>
        </span>
      </span>
    </span>
  );
}
