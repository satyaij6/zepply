"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, Clock, Loader2, Lock, Pause, Play, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import type { ReelFormat, ReelLength, ReelMusic, ReelVariables } from "@zepply/reels";
import { isDemo } from "@/components/layout/DashboardLayout";
import { BrandFields, EMPTY_BRAND, type Brand } from "@/components/create/BrandFields";
import { Field, OptionCard, RatioIcon, TextArea, TextInput } from "@/components/create/ui";
import { basicScript, type ReelScript } from "@/lib/reels/basic-script";
import {
  DESTINATIONS,
  FORMAT_LABELS,
  GOALS,
  LANGUAGES,
  LENGTH_OPTIONS,
  MUSIC_OPTIONS,
  TEMPLATE_PATH,
  formatsFor,
  type ReelDestination,
  type ReelGoal,
} from "@/lib/reels/options";
import { Generating } from "./Generating";
import { ReelPreview } from "./ReelPreview";

type Draft = {
  step: number;
  goal: ReelGoal;
  destinations: ReelDestination[];
  details: string;
  length: ReelLength;
  music: ReelMusic;
  script: ReelScript | null;
  /** The inputs the script was written from; a change means it's out of date */
  scriptKey: string | null;
};

const DRAFT_KEY = "zepply.promo.draft";
const DEMO_BRAND_KEY = "zepply.promo.demoBrand";

const NEW_DRAFT: Draft = {
  step: 0,
  goal: "promote",
  destinations: ["ig-reel"],
  details: "",
  length: "standard",
  music: "upbeat",
  script: null,
  scriptKey: null,
};

const STEPS = [
  { title: "What are you making?", sub: "This sets the story your reel tells." },
  { title: "Where will you post it?", sub: "Pick all that apply. We'll make the right size for each." },
  { title: "Your brand", sub: "Saved to your Brand kit, so next time this step is already done." },
  { title: "Tell us about it", sub: "A line or two is enough. We'll write the words for you." },
  { title: "Look and sound", sub: "You can change these any time before you generate." },
  { title: "Review your reel", sub: "Watch the preview and fix any words. Then generate." },
] as const;

const DETAIL_PROMPTS: Record<ReelGoal, { label: string; placeholder: string }> = {
  promote: { label: "What should people know?", placeholder: "Our cold brew is ₹220. Open 7am to 11pm, every day." },
  offer: { label: "What's the offer?", placeholder: "10% off all cold brews this week" },
  product: { label: "Which product, and what makes it special?", placeholder: "Our new hazelnut cold brew, ₹240, made fresh every morning" },
  event: { label: "What's happening, and when?", placeholder: "Live music night this Saturday, 7pm. Free entry." },
};

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function PromoWizard() {
  const [demo] = useState(isDemo);
  const [access, setAccess] = useState<"loading" | "ok" | "invite" | "error">("loading");
  const [brand, setBrand] = useState<Brand>(EMPTY_BRAND);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [busy, setBusy] = useState<null | "saving" | "generating">(null);
  const [error, setError] = useState<string | null>(null);
  const [scripting, setScripting] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<ReelFormat>("vertical");
  const [previewOpen, setPreviewOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // Load the brand kit and any saved draft
  useEffect(() => {
    const saved = readStorage<Draft>(DRAFT_KEY);
    if (saved) queueMicrotask(() => setDraft({ ...NEW_DRAFT, ...saved }));
    if (demo) {
      const b = readStorage<Brand>(DEMO_BRAND_KEY);
      queueMicrotask(() => {
        if (b) setBrand({ ...EMPTY_BRAND, ...b, logo: null, photos: [] });
        setAccess("ok");
      });
      return;
    }
    fetch("/api/brand-kit")
      .then(async (r) => {
        if (r.status === 401) return window.location.replace("/login");
        if (r.status === 403) return setAccess("invite");
        if (!r.ok) return setAccess("error");
        const { kit } = await r.json();
        if (kit) {
          setBrand({
            brandName: kit.brandName ?? "",
            handle: kit.handle ?? "",
            about: kit.about ?? "",
            location: kit.location ?? "",
            accent: kit.accent ?? EMPTY_BRAND.accent,
            language: kit.language ?? "en",
            logo: kit.logoPath && kit.logoUrl ? { path: kit.logoPath, url: kit.logoUrl } : null,
            photos: kit.photos ?? [],
          });
        }
        setAccess("ok");
      })
      .catch(() => setAccess("error"));
  }, [demo]);

  useEffect(() => {
    if (access === "ok") writeStorage(DRAFT_KEY, draft);
  }, [draft, access]);
  useEffect(() => {
    if (demo && access === "ok") writeStorage(DEMO_BRAND_KEY, { ...brand, logo: null, photos: [] });
  }, [brand, demo, access]);

  const formats = useMemo(() => formatsFor(draft.destinations), [draft.destinations]);
  useEffect(() => {
    if (formats.length && !formats.includes(previewFormat)) queueMicrotask(() => setPreviewFormat(formats[0]));
  }, [formats, previewFormat]);

  // Phones: the preview stays folded while answering, and opens for the review
  useEffect(() => {
    if (draft.step === STEPS.length - 1) queueMicrotask(() => setPreviewOpen(true));
  }, [draft.step]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const scriptInput = useMemo(
    () => ({
      brandName: brand.brandName.trim() || "Your business",
      handle: brand.handle,
      about: brand.about,
      location: brand.location,
      goal: draft.goal,
      details: draft.details,
      language: brand.language,
    }),
    [brand.brandName, brand.handle, brand.about, brand.location, brand.language, draft.goal, draft.details],
  );
  const scriptKey = JSON.stringify(scriptInput);
  const script = draft.script ?? basicScript(scriptInput);

  const writeWords = useCallback(async () => {
    setScripting(true);
    setError(null);
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 700));
        setDraft((d) => ({ ...d, script: basicScript(scriptInput), scriptKey }));
        return;
      }
      const res = await fetch("/api/reels/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scriptInput),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't write the script");
      setDraft((d) => ({ ...d, script: data.script, scriptKey }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write the script");
    } finally {
      setScripting(false);
    }
  }, [demo, scriptInput, scriptKey]);

  const variables = (forRender: boolean): Partial<ReelVariables> => ({
    ...script,
    accent: brand.accent,
    brandName: brand.brandName.trim() || "Your business",
    handle: brand.handle,
    logo: brand.logo ? (forRender ? brand.logo.path : brand.logo.url) : "",
    photos: brand.photos.map((p) => (forRender ? p.path : p.url)).join("\n"),
    ctaSub: script.ctaSub || brand.location || brand.handle,
  });

  async function saveBrand() {
    if (demo) return true;
    setBusy("saving");
    setError(null);
    try {
      const res = await fetch("/api/brand-kit", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: brand.brandName,
          handle: brand.handle,
          about: brand.about,
          location: brand.location,
          accent: brand.accent,
          language: brand.language,
          logoPath: brand.logo?.path ?? null,
          photoPaths: brand.photos.map((p) => p.path),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your brand");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your brand");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (demo) {
      setError("Demo mode: rendering is switched off. Sign in to generate.");
      return;
    }
    setBusy("generating");
    setError(null);
    try {
      const res = await fetch("/api/reels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ formats, length: draft.length, music: draft.music, variables: variables(true) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start your reel");
      setGroup(data.groupId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start your reel");
    } finally {
      setBusy(null);
    }
  }

  async function next() {
    if (draft.step === 2 && !(await saveBrand())) return;
    // Start writing as soon as we know enough; it's usually done by the review step
    if (draft.step === 3 && draft.scriptKey !== scriptKey) void writeWords();
    update({ step: Math.min(STEPS.length - 1, draft.step + 1) });
    setError(null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const back = () => {
    update({ step: Math.max(0, draft.step - 1) });
    setError(null);
  };

  const canNext = [true, formats.length > 0, brand.brandName.trim().length > 0, true, true, true][draft.step];

  if (access === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-app-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (access === "invite") return <InviteOnly />;
  if (access === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-display text-xl font-semibold">We couldn&apos;t load this page</p>
        <p className="mt-2 text-sm text-app-muted">Check your connection and try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 h-10 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }

  if (group) {
    return (
      <Generating
        groupId={group}
        onAnother={() => {
          setGroup(null);
          update({ step: 0, script: null, scriptKey: null, details: "" });
        }}
      />
    );
  }

  const step = STEPS[draft.step];
  const outdated = draft.script && draft.scriptKey !== scriptKey;

  const preview = (
    <div>
      {formats.length > 1 && (
        <div className="mb-3 flex justify-center gap-1 rounded-xl bg-white p-1 ring-1 ring-app-line" role="tablist" aria-label="Preview size">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={previewFormat === f}
              onClick={() => setPreviewFormat(f)}
              className={`h-8 flex-1 rounded-lg px-2 text-xs font-semibold transition ${previewFormat === f ? "bg-app-ink text-white" : "text-app-muted hover:text-app-ink"}`}
            >
              {FORMAT_LABELS[f].split(" (")[0]}
            </button>
          ))}
        </div>
      )}
      <div className={previewFormat === "wide" ? "w-full" : previewFormat === "portrait" ? "mx-auto w-full max-w-[340px]" : "mx-auto w-full max-w-[300px]"}>
        <ReelPreview format={previewFormat} length={draft.length} music={draft.music} variables={variables(false)} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-app-muted">
        {scripting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing your words…
          </>
        ) : (
          <>Live preview · {LENGTH_OPTIONS.find((o) => o.value === draft.length)?.label}</>
        )}
      </p>
    </div>
  );

  return (
    <div ref={top} className="scroll-mt-24 pb-28 pt-2 lg:pb-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/create" className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-line bg-white text-app-muted transition hover:text-app-ink" aria-label="Back to Create">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-app-faint">Promo reel</p>
          <p className="text-sm text-app-muted">
            Step {draft.step + 1} of {STEPS.length}
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 sm:flex" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === draft.step ? "w-6 bg-app-ink" : i < draft.step ? "w-1.5 bg-app-ink" : "w-1.5 bg-zinc-300"}`} />
          ))}
        </div>
      </div>

      {/* Phone: the preview sits above the questions and can be folded away */}
      {draft.step > 0 && (
        <div className="mb-6 lg:hidden">
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            className="mb-3 flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-app-line"
            aria-expanded={previewOpen}
          >
            {previewOpen ? "Hide preview" : "Show preview"}
            <ChevronDown className={`h-4 w-4 transition ${previewOpen ? "rotate-180" : ""}`} />
          </button>
          {previewOpen && <div className="mx-auto max-w-[240px]">{preview}</div>}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:gap-12">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(26px,3vw,36px)] font-semibold leading-tight tracking-[-0.03em]">{step.title}</h1>
          <p className="mt-2 text-[15px] text-app-muted">{step.sub}</p>

          <div className="mt-7">
            {draft.step === 0 && (
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="What are you making?">
                {GOALS.map((g) => (
                  <OptionCard key={g.value} selected={draft.goal === g.value} onClick={() => update({ goal: g.value })} title={g.label} hint={g.hint} />
                ))}
              </div>
            )}

            {draft.step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {DESTINATIONS.map((d) => {
                  const on = draft.destinations.includes(d.value);
                  return (
                    <OptionCard
                      key={d.value}
                      multi
                      selected={on}
                      onClick={() => update({ destinations: on ? draft.destinations.filter((x) => x !== d.value) : [...draft.destinations, d.value] })}
                      title={d.label}
                      hint={d.format === "vertical" ? "Tall, full screen" : d.format === "portrait" ? "Tall post in the feed" : "Wide, landscape"}
                      visual={<RatioIcon ratio={d.ratio} active={on} />}
                    />
                  );
                })}
                {formats.length > 1 && (
                  <p className="text-sm text-app-muted sm:col-span-2">
                    You&apos;ll get {formats.length} videos: {formats.map((f) => FORMAT_LABELS[f]).join(", ")}.
                  </p>
                )}
              </div>
            )}

            {draft.step === 2 && <BrandFields value={brand} onChange={setBrand} demo={demo} />}

            {draft.step === 3 && (
              <div className="space-y-6">
                <Field label={DETAIL_PROMPTS[draft.goal].label} hint="Prices, timings, dates: anything true you want people to know" htmlFor="details">
                  <TextArea id="details" value={draft.details} maxLength={300} placeholder={DETAIL_PROMPTS[draft.goal].placeholder} onChange={(e) => update({ details: e.target.value })} />
                </Field>
                <Field label="Language">
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Language">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={brand.language === l.value}
                        onClick={() => setBrand({ ...brand, language: l.value })}
                        className={`h-10 rounded-full border px-4 text-sm font-semibold transition ${
                          brand.language === l.value ? "border-app-ink bg-app-ink text-white" : "border-app-line bg-white text-app-ink hover:border-zinc-300"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <p className="flex items-start gap-2 rounded-xl bg-white p-3.5 text-sm text-app-muted ring-1 ring-app-line">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                  We only use what you tell us. Nothing made up: no fake ratings, prices or claims.
                </p>
              </div>
            )}

            {draft.step === 4 && <LookStep draft={draft} update={update} />}

            {draft.step === 5 && (
              <ReviewStep
                script={script}
                length={draft.length}
                scripting={scripting}
                outdated={!!outdated}
                onChange={(s) => update({ script: s, scriptKey: draft.scriptKey ?? scriptKey })}
                onRewrite={writeWords}
              />
            )}
          </div>

          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Desktop actions */}
          <div className="mt-8 hidden items-center gap-3 lg:flex">
            <Actions step={draft.step} canNext={canNext} busy={busy} onBack={back} onNext={next} onGenerate={generate} count={formats.length} />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{draft.step > 0 ? preview : <GoalTeaser />}</div>
        </aside>
      </div>

      {/* Phone actions: always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-app-line bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Actions step={draft.step} canNext={canNext} busy={busy} onBack={back} onNext={next} onGenerate={generate} count={formats.length} />
        </div>
      </div>
    </div>
  );
}

function Actions({
  step,
  canNext,
  busy,
  onBack,
  onNext,
  onGenerate,
  count,
}: {
  step: number;
  canNext: boolean;
  busy: null | "saving" | "generating";
  onBack: () => void;
  onNext: () => void;
  onGenerate: () => void;
  count: number;
}) {
  const last = step === STEPS.length - 1;
  return (
    <>
      {step > 0 && (
        <button type="button" onClick={onBack} className="h-12 rounded-xl border border-app-line bg-white px-5 text-sm font-semibold text-app-ink transition hover:border-zinc-300">
          Back
        </button>
      )}
      {last ? (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!!busy}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-electric px-6 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(61,126,255,0.8)] transition hover:bg-[#2F6BF0] disabled:opacity-60 lg:flex-none"
        >
          {busy === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Generate {count > 1 ? `${count} videos` : "my reel"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext || !!busy}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-app-ink px-6 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40 lg:flex-none"
        >
          {busy === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Next <ArrowRight className="h-4 w-4" />
        </button>
      )}
      {last && (
        <span className="hidden items-center gap-1.5 text-sm text-app-muted lg:inline-flex">
          <Clock className="h-4 w-4" /> About 2 minutes{count > 1 ? " per video" : ""}
        </span>
      )}
    </>
  );
}

/** Step 1 has no preview yet: show what they'll get instead. */
function GoalTeaser() {
  return (
    <div className="rounded-[22px] bg-app-side p-6 text-white">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">What you&apos;ll get</p>
      <ul className="mt-4 space-y-3 text-[15px] text-zinc-300">
        {["A finished promo video with music", "Your logo, colours and photos", "Words written for you, in your language", "Ready for Reels, posts, YouTube or WhatsApp"].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electric" />
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-zinc-500">The preview appears on the next step.</p>
    </div>
  );
}

function LookStep({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  const [playing, setPlaying] = useState<ReelMusic | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (m: ReelMusic) => {
    audio.current?.pause();
    if (playing === m) return setPlaying(null);
    const a = new Audio(`${TEMPLATE_PATH}music/${m}-${draft.length}.mp3`);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    audio.current = a;
    setPlaying(m);
  };

  return (
    <div className="space-y-8">
      <Field label="Style">
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard selected onClick={() => {}} title="Spotlight" hint="Dark, bold and smooth. One shape moves through the whole story." visual={<span className="block h-11 w-11 rounded-xl bg-app-side" style={{ boxShadow: "inset 0 0 0 14px #0E0E11, inset 0 0 0 40px #3D7EFF" }} />} />
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted sm:p-5">
            <Lock className="h-4 w-4 shrink-0" /> More styles are coming soon
          </div>
        </div>
      </Field>

      <Field label="Length">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Length">
          {LENGTH_OPTIONS.map((o) => (
            <OptionCard key={o.value} selected={draft.length === o.value} onClick={() => update({ length: o.value })} title={o.label} hint={o.value === "short" ? `${o.hint}: skips the photos and highlights` : o.hint} />
          ))}
        </div>
      </Field>

      <Field label="Music" hint="Tap play to listen">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Music">
          {MUSIC_OPTIONS.map((o) => (
            <div key={o.value} className="relative">
              <OptionCard
                selected={draft.music === o.value}
                onClick={() => update({ music: o.value })}
                title={o.label}
                hint={o.hint}
                visual={<span className="block h-10 w-10" aria-hidden />}
              />
              {/* Sits over the card's visual slot: a sibling, so it isn't a button inside a button */}
              <button
                type="button"
                onClick={() => toggle(o.value)}
                aria-label={playing === o.value ? `Stop ${o.label}` : `Play ${o.label}`}
                className={`absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition sm:left-5 ${
                  playing === o.value ? "bg-electric text-white" : "bg-app-bg text-app-ink hover:bg-zinc-200"
                }`}
              >
                {playing === o.value ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
              </button>
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}

function ReviewStep({
  script,
  length,
  scripting,
  outdated,
  onChange,
  onRewrite,
}: {
  script: ReelScript;
  length: ReelLength;
  scripting: boolean;
  outdated: boolean;
  onChange: (s: ReelScript) => void;
  onRewrite: () => void;
}) {
  const set = (patch: Partial<ReelScript>) => onChange({ ...script, ...patch });
  const lines = (s: string, n: number) => {
    const l = s.split("\n");
    while (l.length < n) l.push("");
    return l.slice(0, n);
  };
  const setLine = (key: "comments" | "tagline", i: number, v: string, n: number) => {
    const l = lines(script[key], n);
    l[i] = v;
    set({ [key]: l.join("\n") } as Partial<ReelScript>);
  };
  const highlights = lines(script.highlights, 3).map((row) => {
    const [value = "", ...rest] = row.split("|");
    return { value: value.trim(), label: rest.join("|").trim() };
  });
  const setHighlight = (i: number, patch: Partial<{ value: string; label: string }>) => {
    const next = highlights.map((h, j) => (j === i ? { ...h, ...patch } : h));
    set({ highlights: next.map((h) => `${h.value} | ${h.label}`).join("\n") });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-app-line">
        <p className="min-w-0 flex-1 text-sm text-app-muted">
          {scripting ? "Writing your words…" : outdated ? "You changed your details. Rewrite the words to match?" : "Tip: wrap a word in *stars* to make it stand out."}
        </p>
        <button
          type="button"
          onClick={onRewrite}
          disabled={scripting}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-app-line px-3 text-sm font-semibold text-app-ink transition hover:border-zinc-300 disabled:opacity-50"
        >
          {scripting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Rewrite with AI
        </button>
      </div>

      <Section title="Opening" note="Customers' comments pile up on a phone">
        <Field label="Headline" htmlFor="hook">
          <TextInput id="hook" value={script.hookLine} maxLength={60} onChange={(e) => set({ hookLine: e.target.value })} />
        </Field>
        <Field label="Comments">
          <div className="grid gap-2 sm:grid-cols-2">
            {lines(script.comments, 5).map((c, i) => (
              <TextInput key={i} aria-label={`Comment ${i + 1}`} value={c} maxLength={26} onChange={(e) => setLine("comments", i, e.target.value, 5)} />
            ))}
          </div>
        </Field>
      </Section>

      <Section title="The DM" note="A customer asks, you reply">
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Customer" htmlFor="cust">
            <TextInput id="cust" value={script.customerName} maxLength={20} onChange={(e) => set({ customerName: e.target.value })} />
          </Field>
          <Field label="Their question" htmlFor="q">
            <TextInput id="q" value={script.question} maxLength={70} onChange={(e) => set({ question: e.target.value })} />
          </Field>
        </div>
        <Field label="Your reply" htmlFor="reply">
          <TextArea id="reply" value={script.reply} maxLength={170} onChange={(e) => set({ reply: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Headline" htmlFor="ah">
            <TextInput id="ah" value={script.answerHeadline} maxLength={44} onChange={(e) => set({ answerHeadline: e.target.value })} />
          </Field>
          <Field label="Badge" htmlFor="chip">
            <TextInput id="chip" value={script.replyChip} maxLength={26} onChange={(e) => set({ replyChip: e.target.value })} />
          </Field>
        </div>
      </Section>

      {length === "standard" && (
        <>
          <Section title="Photos" note="Your photos fill a grid">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" htmlFor="gh">
                <TextInput id="gh" value={script.galleryHeadline} maxLength={44} onChange={(e) => set({ galleryHeadline: e.target.value })} />
              </Field>
              <Field label="Title above photos" htmlFor="gt">
                <TextInput id="gt" value={script.galleryTitle} maxLength={28} onChange={(e) => set({ galleryTitle: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section title="Highlights" note="Three things worth knowing">
            <Field label="Headline" htmlFor="hh">
              <TextInput id="hh" value={script.highlightsHeadline} maxLength={44} onChange={(e) => set({ highlightsHeadline: e.target.value })} />
            </Field>
            {highlights.map((h, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                <TextInput aria-label={`Highlight ${i + 1}`} placeholder="7am – 11pm" value={h.value} maxLength={18} onChange={(e) => setHighlight(i, { value: e.target.value })} />
                <TextInput aria-label={`Highlight ${i + 1} detail`} placeholder="Open every day" value={h.label} maxLength={34} onChange={(e) => setHighlight(i, { label: e.target.value })} />
              </div>
            ))}
          </Section>
        </>
      )}

      <Section title="Ending" note="Three words on the beat, then your name and button">
        <Field label="Three words">
          <div className="grid grid-cols-3 gap-2">
            {lines(script.tagline, 3).map((w, i) => (
              <TextInput key={i} aria-label={`Word ${i + 1}`} value={w} maxLength={14} onChange={(e) => setLine("tagline", i, e.target.value, 3)} />
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button" htmlFor="cta">
            <TextInput id="cta" value={script.ctaLabel} maxLength={24} onChange={(e) => set({ ctaLabel: e.target.value })} />
          </Field>
          <Field label="Line under your name" htmlFor="ctasub">
            <TextInput id="ctasub" value={script.ctaSub} maxLength={40} onChange={(e) => set({ ctaSub: e.target.value })} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-app-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-[13px] text-app-muted">{note}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-app-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-4 border-t border-app-line px-4 py-4 sm:px-5">{children}</div>}
    </section>
  );
}

function InviteOnly() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-side text-white">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">Promo reels are invite-only for now</p>
      <p className="mt-2 text-[15px] leading-relaxed text-app-muted">We&apos;re opening video creation to a few businesses at a time. Write to us and we&apos;ll add you to the next group.</p>
      <a href="mailto:contact@buybloc.com?subject=Zepply%20promo%20reels" className="mt-6 inline-flex h-11 items-center rounded-xl bg-app-ink px-5 text-sm font-semibold text-white">
        Ask for access
      </a>
    </div>
  );
}
