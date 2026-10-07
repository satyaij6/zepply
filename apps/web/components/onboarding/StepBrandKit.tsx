"use client";

import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw, Sparkles, Target, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImage } from "@/components/create/BrandFields";
import type { BrandKitView } from "@/lib/brand-kit";
import { FONTS, MAX_COLORS, MAX_TAGS, type Path } from "@/lib/onboarding/options";
import { paletteFromImages } from "./palette";
import { Eyebrow, Lede, Nav, TagEditor, Title, api } from "./ui";

/** CSS for each headline face (app/start/layout.tsx loads them) */
export const FONT_CSS: Record<string, string> = {
  "inter-tight": "var(--font-landing-display)",
  "plus-jakarta": "'Plus Jakarta Sans', sans-serif",
  poppins: "Poppins, sans-serif",
  playfair: "'Playfair Display', serif",
  "instrument-serif": "var(--font-landing-serif)",
};

const ANALYSIS_STEPS = {
  business: ["Fetching your visual identity", "Understanding your tone of voice", "Identifying your audience", "Finding what you offer"],
  creator: ["Finding your look", "Learning your voice", "Seeing what your audience loves", "Spotting your topics"],
};

/** Creators aren't "a brand": the same kit, in their words */
const WORDS = {
  business: { title: "your brand.", lede: "We built a brand kit from what you shared.", logo: "Logo", colours: "Brand colours", voice: "Brand voice", offer: "What you offer", offerLine: "One line about what you do", addOffer: "Add an offer", analysing: "Analysing your brand…" },
  creator: { title: "your style.", lede: "We built your creator kit from what you shared.", logo: "Profile photo", colours: "Your colours", voice: "Your voice", offer: "What you talk about", offerLine: "One line about you and your content", addOffer: "Add a topic", analysing: "Learning your style…" },
};

export function StepBrandKit({
  path,
  analyse,
  onAnalysed,
  onBack,
  onNext,
}: {
  /** Run the analysis on arrival (first visit, or after connecting something new) */
  path: Path;
  analyse: boolean;
  onAnalysed: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [kit, setKit] = useState<BrandKitView | null>(null);
  const [working, setWorking] = useState(analyse);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State only changes after the request returns, so this can start from an effect
  const request = useCallback(
    () =>
      api<{ kit: BrandKitView; source: "ai" | "basic" }>("/api/onboarding/analyze", { method: "POST" })
        .then(async ({ kit, source }) => {
          // Without Claude the server can't look at images: read the colours here instead
          const images = [kit.logoUrl, ...kit.photos.map((p) => p.url)].filter((u): u is string => !!u);
          if (source === "basic" && images.length) kit.colors = await paletteFromImages(images);
          setKit(kit);
          onAnalysed();
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setWorking(false)),
    [onAnalysed],
  );

  const run = () => {
    setWorking(true);
    setError(null);
    request();
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (analyse) {
      request();
      return;
    }
    api<{ kit: BrandKitView | null }>("/api/brand-kit")
      .then(({ kit }) => {
        if (kit?.colors.length) return setKit(kit);
        setWorking(true);
        request();
      })
      .catch((e) => setError(e.message));
  }, [analyse, request]);

  const update = (patch: Partial<BrandKitView>) => setKit((k) => (k ? { ...k, ...patch } : k));

  const next = async () => {
    if (!kit) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/brand-kit", {
        method: "PUT",
        json: {
          brandName: kit.brandName,
          handle: kit.handle,
          about: kit.about,
          location: kit.location,
          accent: kit.colors[0] ?? kit.accent,
          logoPath: kit.logoPath,
          photoPaths: kit.photoPaths,
          language: kit.language,
          colors: kit.colors,
          font: kit.font,
          voice: kit.voice,
          audience: kit.audience,
          offerings: kit.offerings,
          themes: kit.themes,
        },
      });
      onNext();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const words = WORDS[path];
  if (working || !kit) return <Analysing path={path} failed={!working && !kit ? error : null} onRetry={run} />;

  return (
    <div className="mx-auto grid max-w-[1320px] gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <Eyebrow step={4} />
        <Title accent={words.title}>Here&apos;s what we learned about</Title>
        <Lede>{words.lede} Change anything here now, or later in Brand Kit.</Lede>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <LogoCard kit={kit} onChange={update} title={words.logo} />
          <Card title={words.colours}>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: MAX_COLORS }, (_, i) => kit.colors[i] ?? "#FFFFFF").map((c, i) => (
                <label key={i} className="group cursor-pointer text-center">
                  <span className="block aspect-square rounded-xl ring-1 ring-black/10 transition group-hover:scale-105" style={{ background: c }} />
                  <span className="mt-1.5 block text-[10px] uppercase tracking-wide text-app-muted">{c.slice(1)}</span>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => {
                      const colors = [...kit.colors];
                      colors[i] = e.target.value.toUpperCase();
                      update({ colors });
                    }}
                    className="sr-only"
                    aria-label={`Brand colour ${i + 1}`}
                  />
                </label>
              ))}
            </div>
          </Card>
          <FontCard value={kit.font} onChange={(font) => update({ font })} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Card title={words.voice}>
            <TagEditor tags={kit.voice} onChange={(voice) => update({ voice })} max={MAX_TAGS} placeholder="Add a word" />
          </Card>
          <Card title="Audience" icon={<Target className="h-4 w-4" />}>
            <textarea
              value={kit.audience ?? ""}
              onChange={(e) => update({ audience: e.target.value })}
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-xl border border-transparent bg-app-bg px-3 py-2 text-sm leading-relaxed text-app-ink outline-none focus:border-electric"
            />
          </Card>
          <Card title={words.offer}>
            <textarea
              value={kit.about ?? ""}
              onChange={(e) => update({ about: e.target.value })}
              rows={2}
              maxLength={200}
              placeholder={words.offerLine}
              className="mb-3 w-full resize-none rounded-xl border border-transparent bg-app-bg px-3 py-2 text-sm leading-relaxed text-app-ink outline-none focus:border-electric"
            />
            <TagEditor tags={kit.offerings} onChange={(offerings) => update({ offerings })} max={MAX_TAGS} placeholder={words.addOffer} />
          </Card>
          <Card title="Content themes" icon={<Sparkles className="h-4 w-4" />}>
            <TagEditor tags={kit.themes} onChange={(themes) => update({ themes })} max={MAX_TAGS} placeholder="Add a theme" />
          </Card>
        </div>

        <Nav
          onBack={onBack}
          onNext={next}
          busy={saving}
          error={error}
          nextLabel="Looks good, continue"
          extra={
            <button type="button" onClick={run} className="inline-flex items-center gap-1.5 text-sm font-medium text-electric hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Analyse again
            </button>
          }
        />
      </div>

      <aside>
        <Preview kit={kit} />
      </aside>
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-app-line bg-app-card px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-app-ink">
          {icon && <span className="text-electric">{icon}</span>}
          {title}
        </h3>
        {action ?? <Pencil className="h-3.5 w-3.5 text-app-faint" aria-hidden />}
      </div>
      {children}
    </section>
  );
}

function LogoCard({ kit, onChange, title }: { kit: BrandKitView; onChange: (p: Partial<BrandKitView>) => void; title: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card
      title={title}
      action={
        <button type="button" onClick={() => input.current?.click()} className="text-xs font-medium text-electric hover:underline">
          Change
        </button>
      }
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative flex aspect-square w-full max-w-[104px] items-center justify-center overflow-hidden rounded-2xl bg-app-bg text-app-muted"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : kit.logoUrl ? <Image src={kit.logoUrl} alt="Your logo" fill sizes="150px" className="object-cover" unoptimized /> : <Upload className="h-5 w-5" />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const { media } = await uploadImage("logo", file);
            onChange({ logoPath: media.path, logoUrl: media.url });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}

function FontCard({ value, onChange }: { value: string | null; onChange: (font: string) => void }) {
  const [open, setOpen] = useState(false);
  const font = FONTS.find((f) => f.value === value) ?? FONTS[0];
  return (
    <Card
      title="Font"
      action={
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-electric hover:underline" aria-expanded={open}>
          {open ? "Done" : "Change"}
        </button>
      }
    >
      {open ? (
        <ul role="radiogroup" className="space-y-1">
          {FONTS.map((f) => (
            <li key={f.value}>
              <button
                type="button"
                role="radio"
                aria-checked={f.value === font.value}
                onClick={() => onChange(f.value)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[15px] ${f.value === font.value ? "bg-electric-wash/60" : "hover:bg-app-bg"}`}
                style={{ fontFamily: FONT_CSS[f.value] }}
              >
                {f.label}
                {f.value === font.value && <Check className="h-4 w-4 text-electric" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-4">
          <span className="text-4xl leading-none text-app-ink" style={{ fontFamily: FONT_CSS[font.value] }}>
            Aa
          </span>
          <span>
            <span className="block font-semibold text-app-ink">{font.label}</span>
            <span className="block text-xs text-app-muted">{font.note}</span>
          </span>
        </div>
      )}
    </Card>
  );
}

/** How the brand will look: three post previews from their photos, and their content style */
function Preview({ kit }: { kit: BrandKitView }) {
  const [index, setIndex] = useState(0);
  const photos = kit.photos.length ? kit.photos : [];
  const headlines = [kit.about?.split(/[.,]/)[0] || kit.brandName, ...kit.themes].filter(Boolean).slice(0, 3);
  const [primary = "#16161A", second = "#3D7EFF"] = kit.colors;
  const font = FONT_CSS[kit.font ?? "inter-tight"];

  return (
    <div className="rounded-3xl border border-app-line bg-app-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-app-ink">Preview</h2>
          <p className="text-sm text-app-muted">How Zepply will design for {kit.brandName}.</p>
        </div>
        <div className="flex gap-2">
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setIndex((i) => (i + d + headlines.length) % headlines.length)}
              aria-label={d < 0 ? "Previous preview" : "Next preview"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-app-line text-app-ink hover:bg-app-bg"
            >
              {d < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-3 aspect-[4/5] w-full max-w-[236px] overflow-hidden rounded-2xl shadow-[0_24px_50px_-24px_rgba(0,0,0,0.55)]" style={{ background: primary }}>
        {photos.length > 0 && <Image src={photos[index % photos.length].url} alt="" fill sizes="340px" className="object-cover" unoptimized />}
        <div className="absolute inset-0 bg-linear-to-b from-black/35 via-transparent to-black/75" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {kit.logoUrl && <Image src={kit.logoUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover ring-2 ring-white/80" unoptimized />}
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{kit.brandName}</span>
        </div>
        <div className="absolute bottom-5 left-5 right-5">
          <span className="block h-1.5 w-12 rounded-full" style={{ background: second }} />
          <p className="mt-2 text-[23px] leading-[1.02] text-white" style={{ fontFamily: font }}>
            {headlines[index % headlines.length]}
          </p>
          {kit.handle && <p className="mt-2 text-xs text-white/80">@{kit.handle}</p>}
        </div>
      </div>

      {photos.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-app-ink">Content style</h3>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {photos.slice(0, 5).map((p) => (
              <div key={p.path} className="relative aspect-square overflow-hidden rounded-lg">
                <Image src={p.url} alt="" fill sizes="80px" loading="eager" className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-4 rounded-2xl bg-app-bg px-4 py-2.5 text-sm text-app-muted">
        {kit.handle ? `Built from @${kit.handle}'s profile${photos.length ? ` and ${photos.length} of your photos` : ""}.` : photos.length ? `Built from your answers and ${photos.length} photos.` : "Built from your answers. Add photos any time for richer designs."}
      </p>
    </div>
  );
}

function Analysing({ path, failed, onRetry }: { path: Path; failed: string | null; onRetry: () => void }) {
  const steps = ANALYSIS_STEPS[path];
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (failed) return;
    const last = steps.length - 1;
    const t = setInterval(() => setDone((d) => Math.min(d + 1, last)), 2600);
    return () => clearInterval(t);
  }, [failed, steps.length]);
  return (
    <div className="mx-auto max-w-[520px] py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-electric-wash">
        {failed ? <RefreshCw className="h-7 w-7 text-electric" /> : <Loader2 className="h-7 w-7 animate-spin text-electric" />}
      </span>
      <h1 className="mt-6 font-display text-[34px] font-semibold tracking-[-0.03em] text-app-ink">{failed ? "That didn't work" : WORDS[path].analysing}</h1>
      {failed ? (
        <>
          <p className="mt-3 text-app-muted">{failed}</p>
          <button type="button" onClick={onRetry} className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-app-ink px-6 font-semibold text-white">
            Try again
          </button>
        </>
      ) : (
        <ul className="mx-auto mt-8 max-w-[320px] space-y-4 text-left">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 ${i <= done ? "text-app-ink" : "text-app-faint"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i < done ? "bg-electric text-white" : i === done ? "border-2 border-electric/30 border-t-electric animate-spin" : "border-2 border-app-line"}`}>
                {i < done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-sm text-app-faint">This usually takes under a minute.</p>
    </div>
  );
}
