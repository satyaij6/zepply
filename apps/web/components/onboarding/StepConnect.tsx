"use client";

import Image from "next/image";
import { Check, ImagePlus, LayoutGrid, Link2, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/components/create/BrandFields";
import type { BrandKitView } from "@/lib/brand-kit";
import type { OnboardingState } from "@/lib/onboarding/state";
import { MAX_PHOTOS } from "@/lib/reels/options";
import { Eyebrow, HandNote, Lede, Nav, Title, api } from "./ui";

type Tab = "accounts" | "upload" | "link";

const CONNECT_ERRORS: Record<string, string> = {
  instagram_in_use:
    "That Instagram account is already connected to a different Zepply account. Log in to that account, or connect a different Instagram.",
  callback_failed: "We couldn't reach Instagram just now. Please try again.",
};

export function StepConnect({
  instagram,
  connectError,
  onBack,
  onNext,
  busy,
  error,
}: {
  instagram: OnboardingState["instagram"];
  /** Error code Instagram's callback sent back (?error=…) */
  connectError: string | null;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>("accounts");
  // Loaded once for the whole step, so earlier uploads count even before the Upload tab is opened
  const [kit, setKit] = useState<BrandKitView | null | undefined>(undefined);
  useEffect(() => {
    api<{ kit: BrandKitView | null }>("/api/brand-kit")
      .then(({ kit }) => setKit(kit))
      .catch(() => setKit(null));
  }, []);
  const hasSomething = !!instagram || !!kit?.logoPath || (kit?.photoPaths.length ?? 0) > 0;

  return (
    <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[minmax(0,1fr)_480px]">
      <div>
        <Eyebrow step={3} />
        <Title accent="learn your brand from?">Where should Zepply</Title>
        <Lede>Connect your Instagram and we&apos;ll do the digging: your logo, colours, tone of voice, audience and content style.</Lede>

        <div role="tablist" className="mt-10 grid gap-3 sm:grid-cols-3">
          <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")} icon={<LayoutGrid className="h-5 w-5" />} label="Connect accounts" />
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")} icon={<ImagePlus className="h-5 w-5" />} label="Upload assets" />
          <TabButton active={tab === "link"} onClick={() => setTab("link")} icon={<Link2 className="h-5 w-5" />} label="Website link" soon />
        </div>

        <div className="mt-6">
          {tab === "accounts" && <Accounts instagram={instagram} connectError={connectError} />}
          {tab === "upload" && <Uploads kit={kit} setKit={setKit} />}
          {tab === "link" && (
            <div className="rounded-2xl border border-app-line bg-app-card p-6">
              <p className="font-semibold text-app-ink">Learning from a website link is coming soon.</p>
              <p className="mt-1 text-sm text-app-muted">For now, connect Instagram or upload your logo and a few photos.</p>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          We use Instagram&apos;s official API. We never see your password, and your access is stored encrypted.
        </p>

        <Nav onBack={onBack} onNext={onNext} disabled={!hasSomething} busy={busy} error={error} />
        {!hasSomething && (
          <button type="button" onClick={onNext} className="mt-4 text-sm font-medium text-app-muted underline-offset-4 hover:text-app-ink hover:underline">
            Continue without connecting
          </button>
        )}
      </div>

      <aside className="hidden lg:block">
        <AnalysisIllustration />
      </aside>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, soon }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; soon?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-14 items-center justify-center gap-2.5 rounded-xl border px-4 text-[15px] font-semibold transition ${
        active ? "border-electric bg-electric-wash/40 text-app-ink ring-1 ring-electric" : "border-app-line bg-app-card text-app-ink hover:border-app-ink/25"
      }`}
    >
      {icon} {label}
      {soon && <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">Soon</span>}
    </button>
  );
}

function Accounts({ instagram, connectError }: { instagram: OnboardingState["instagram"]; connectError: string | null }) {
  const [leaving, setLeaving] = useState(false);
  const message = connectError ? CONNECT_ERRORS[connectError] ?? CONNECT_ERRORS.callback_failed : null;
  return (
    <div className="space-y-3">
      {message && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {message}
        </p>
      )}
      <div className={`flex items-center gap-4 rounded-2xl border p-5 ${instagram ? "border-emerald-300 bg-emerald-50/50" : "border-app-line bg-app-card"}`}>
        <InstagramGlyph />
        <div className="min-w-0 flex-1">
          {instagram ? (
            <>
              <p className="truncate font-semibold text-app-ink">@{instagram.username}</p>
              <p className="text-sm text-app-muted">{instagram.followers.toLocaleString("en-IN")} followers</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-app-ink">Instagram</p>
              <p className="text-sm text-app-muted">A Business or Creator account linked to a Facebook Page</p>
            </>
          )}
        </div>
        {instagram ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" strokeWidth={3} /> Connected
          </span>
        ) : (
          <a
            href="/api/instagram/connect?next=/start"
            onClick={() => setLeaving(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white transition hover:bg-black"
          >
            {leaving && <Loader2 className="h-4 w-4 animate-spin" />} Connect
          </a>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["YouTube", "TikTok", "Facebook"].map((p) => (
          <div key={p} className="flex items-center justify-between rounded-2xl border border-app-line bg-app-card px-4 py-4 text-app-faint">
            <span className="font-medium">{p}</span>
            <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Logo and photos, saved straight into the brand kit */
function Uploads({ kit, setKit }: { kit: BrandKitView | null | undefined; setKit: (k: BrandKitView) => void }) {
  const [busy, setBusy] = useState<"logo" | "photo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const save = async (patch: { logoPath?: string | null; photoPaths?: string[] }) => {
    if (!kit) return;
    const body = {
      brandName: kit.brandName,
      handle: kit.handle,
      about: kit.about,
      location: kit.location,
      accent: kit.accent,
      language: kit.language,
      logoPath: patch.logoPath !== undefined ? patch.logoPath : kit.logoPath,
      photoPaths: patch.photoPaths ?? kit.photoPaths,
    };
    const { kit: next } = await api<{ kit: BrandKitView }>("/api/brand-kit", { method: "PUT", json: body });
    setKit(next);
  };

  const add = async (kind: "logo" | "photo", files: FileList | null) => {
    if (!files?.length || !kit) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "logo") {
        const { media } = await uploadImage("logo", files[0]);
        await save({ logoPath: media.path });
      } else {
        const room = MAX_PHOTOS - kit.photoPaths.length;
        const paths = [...kit.photoPaths];
        for (const file of Array.from(files).slice(0, room)) paths.push((await uploadImage("photo", file)).media.path);
        await save({ photoPaths: paths });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (kit === undefined) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-app-line bg-app-card text-app-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (kit === null) {
    return <p className="rounded-2xl border border-app-line bg-app-card p-5 text-sm text-app-muted">Go back one step and save your details first.</p>;
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-app-line bg-app-card p-5 sm:grid-cols-[160px_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-sm font-semibold text-app-ink">Logo</p>
        <button
          type="button"
          onClick={() => logoInput.current?.click()}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-app-line bg-app-bg text-app-muted hover:border-app-ink/30"
        >
          {kit.logoUrl ? <Image src={kit.logoUrl} alt="Your logo" fill sizes="160px" className="object-contain p-3" unoptimized /> : busy === "logo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </button>
        <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => add("logo", e.target.files)} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-app-ink">
          Photos <span className="font-normal text-app-faint">({kit.photos.length}/{MAX_PHOTOS})</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {kit.photos.map((p) => (
            <div key={p.path} className="group relative aspect-square overflow-hidden rounded-xl">
              <Image src={p.url} alt="" fill sizes="120px" className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => save({ photoPaths: kit.photoPaths.filter((x) => x !== p.path) }).catch((e) => setError(e.message))}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {kit.photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-app-line bg-app-bg text-app-muted hover:border-app-ink/30"
            >
              {busy === "photo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          )}
        </div>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add("photo", e.target.files)} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function InstagramGlyph() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_110%,#FFDB73_0%,#FD5949_45%,#D6249F_65%,#285AEB_100%)] text-white">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

/** What step 4 will do, drawn from the landing page's café photos */
function AnalysisIllustration() {
  const rows = ["Fetching your visual identity", "Understanding your tone of voice", "Identifying your audience", "Finding what you offer"];
  return (
    <div className="relative pt-6">
      <HandNote className="ml-auto max-w-[200px] rotate-3 text-right">One connection. We&apos;ll find the rest.</HandNote>
      <div className="mt-4 rounded-3xl border border-app-line bg-app-card p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]">
        <p className="font-semibold text-app-ink">Analysing your brand…</p>
        <ul className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <li key={r} className="flex items-center gap-3 text-sm text-app-ink">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${i < 3 ? "bg-electric text-white" : "border-2 border-electric/40 border-t-electric"}`}>
                {i < 3 && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mt-6 grid grid-cols-[1.1fr_1fr] gap-4">
        <div className="relative aspect-[4/5] -rotate-3 overflow-hidden rounded-3xl shadow-lg">
          <Image src="/landing/space.jpg" alt="" fill sizes="240px" className="object-cover" />
        </div>
        <div className="space-y-4 pt-6">
          <div className="rounded-2xl border border-app-line bg-app-card p-4">
            <p className="text-sm font-semibold text-app-ink">Tone of voice</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Warm", "Modern", "Conversational"].map((t) => (
                <span key={t} className="rounded-full bg-app-bg px-2.5 py-1 text-xs text-app-ink">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {["#3A2416", "#8B5E3C", "#D4B996", "#F5EFE6"].map((c) => (
              <span key={c} className="h-9 flex-1 rounded-lg ring-1 ring-black/5" style={{ background: c }} />
            ))}
          </div>
          <div className="relative aspect-square rotate-3 overflow-hidden rounded-2xl shadow-md">
            <Image src="/landing/latte.jpg" alt="" fill sizes="200px" className="object-cover" />
          </div>
        </div>
      </div>
      <HandNote className="mt-4 max-w-[220px] -rotate-2">Editable later in your brand kit.</HandNote>
    </div>
  );
}
