"use client";

import type { Draft } from "@prisma/client";
import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Lightbulb, Loader2, MessageCircle, Pencil, RefreshCw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/onboarding/options";
import { Eyebrow, Lede, Nav, Title, api } from "./ui";

/** Drafts arrive from JSON, so dates are strings */
type DraftJson = Omit<Draft, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

const KIND_LABEL: Record<Draft["kind"], string> = { POST: "Instagram post", CAROUSEL: "Carousel post", REEL: "Reel cover" };

export const imageUrl = (d: DraftJson, slide = 0) => `/api/drafts/${d.id}/image?slide=${slide}&v=${new Date(d.updatedAt).getTime()}`;

export function StepContent({ onBack, onNext }: { onBack: () => void; onNext: (drafts: DraftJson[]) => void }) {
  const [drafts, setDrafts] = useState<DraftJson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const write = async () => {
    setWriting(true);
    setError(null);
    try {
      const { drafts } = await api<{ drafts: DraftJson[] }>("/api/onboarding/samples", { method: "POST" });
      setDrafts(drafts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ drafts: DraftJson[] }>("/api/onboarding/samples")
      .then(({ drafts }) => (drafts.length ? setDrafts(drafts) : write()))
      .catch((e) => setError(e.message));
    // Runs once on arrival (guarded above)
  }, []);

  const replace = (d: DraftJson) => setDrafts((list) => list?.map((x) => (x.id === d.id ? d : x)) ?? null);

  return (
    <div className="mx-auto grid max-w-[1380px] gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <Eyebrow step={5} />
        <Title after=".">Let&apos;s make something</Title>
        <Lede>We wrote three sample posts from your brand kit and your own photos. They&apos;re free, and you can edit anything.</Lede>

        {writing || (!drafts && !error) ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-app-line bg-app-card">
                <div className="aspect-[4/5] animate-pulse bg-app-bg" />
                <div className="space-y-2 p-5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-app-bg" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-app-bg" />
                </div>
              </div>
            ))}
            <p className="flex items-center gap-2 text-sm text-app-muted md:col-span-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing your first posts…
            </p>
          </div>
        ) : drafts ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {drafts.map((d, i) => (
              <PostCard key={d.id} draft={d} number={i + 1} onChange={replace} />
            ))}
          </div>
        ) : null}

        {drafts && !writing && (
          <button type="button" onClick={write} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-electric hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Write three new ones
          </button>
        )}

        <Nav onBack={onBack} onNext={() => drafts && onNext(drafts)} disabled={!drafts?.length} busy={writing} error={error} />
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-app-line bg-app-card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-app-ink">
            <Sparkles className="h-4 w-4 text-electric" /> These posts are just the beginning
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-app-ink">
            {["Created from your brand kit", "Written in your language", "Tailored to your audience", "Edit, rewrite or copy them"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-electric" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-app-line bg-app-card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-app-ink">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Tip
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-app-muted">Copy a caption, save the image and post it today. Your first post is the hardest one.</p>
        </div>
        <div className="rounded-3xl border border-app-line bg-app-card p-6">
          <h3 className="font-semibold text-app-ink">What&apos;s next</h3>
          <ul className="mt-4 space-y-4">
            <Next icon={<MessageCircle className="h-4 w-4" />} title="Reply automatically" sub="Turn comments into DMs and leads" />
            <Next icon={<BarChart3 className="h-4 w-4" />} title="Track your growth" sub="See what's working" />
            <Next icon={<CalendarDays className="h-4 w-4" />} title="A full content calendar" sub="Weeks of ideas, planned for you" soon />
            <Next icon={<Send className="h-4 w-4" />} title="Schedule and publish" sub="Post to your channels" soon />
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Next({ icon, title, sub, soon }: { icon: React.ReactNode; title: string; sub: string; soon?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-wash text-electric">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-app-ink">
          {title}
          {soon && <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">Soon</span>}
        </span>
        <span className="block text-xs text-app-muted">{sub}</span>
      </span>
    </li>
  );
}

function PostCard({ draft, number, onChange }: { draft: DraftJson; number: number; onChange: (d: DraftJson) => void }) {
  const [slide, setSlide] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "regen" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ headline: draft.headline, caption: draft.caption, hashtags: draft.hashtags.join(" ") });
  const slides = draft.kind === "CAROUSEL" ? draft.slides.length + 1 : 1;
  const language = LANGUAGES.find((l) => l.value === draft.language)?.label ?? "English";
  const tags = draft.hashtags.map((h) => `#${h}`).join(" ");

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const { draft: next } = await api<{ draft: DraftJson }>(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        json: { headline: form.headline, caption: form.caption, hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean) },
      });
      onChange(next);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy("regen");
    setError(null);
    try {
      const { draft: next, changed } = await api<{ draft: DraftJson; changed: boolean }>(`/api/drafts/${draft.id}/regenerate`, { method: "POST" });
      if (!changed) setError("Couldn't write a new version right now.");
      onChange(next);
      setForm({ headline: next.headline, caption: next.caption, hashtags: next.hashtags.join(" ") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-app-line bg-app-card">
      <header className="flex items-center gap-3 px-5 py-4">
        <span className="h-8 w-8 rounded-xl bg-[radial-gradient(circle_at_30%_110%,#FFDB73_0%,#FD5949_45%,#D6249F_65%,#285AEB_100%)]" />
        <span>
          <span className="block text-sm font-semibold text-app-ink">Post {String(number).padStart(2, "0")}</span>
          <span className="block text-xs text-app-muted">{KIND_LABEL[draft.kind]}</span>
        </span>
      </header>

      <div className="relative mx-4 aspect-[4/5] overflow-hidden rounded-2xl bg-app-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl(draft, slide)} alt={draft.headline} className="h-full w-full object-cover" />
        {busy === "regen" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-app-ink" />
          </div>
        )}
        {slides > 1 && (
          <>
            <button type="button" onClick={() => setSlide((s) => (s + slides - 1) % slides)} aria-label="Previous slide" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setSlide((s) => (s + 1) % slides)} aria-label="Next slide" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {Array.from({ length: slides }, (_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === slide ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {editing ? (
          <div className="space-y-2">
            <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} maxLength={48} aria-label="Headline" className="w-full rounded-lg border border-app-line px-3 py-2 text-sm font-semibold outline-none focus:border-electric" />
            <textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} rows={5} maxLength={2000} aria-label="Caption" className="w-full resize-none rounded-lg border border-app-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-electric" />
            <input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} aria-label="Hashtags" placeholder="hashtags separated by spaces" className="w-full rounded-lg border border-app-line px-3 py-2 text-sm text-electric outline-none focus:border-electric" />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed text-app-ink">{draft.caption}</p>
            <p className="mt-2 text-sm leading-relaxed text-electric">{tags}</p>
          </>
        )}
        <span className="mt-4 w-fit rounded-full bg-app-bg px-3 py-1 text-xs font-medium text-app-ink">{language}</span>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-auto flex gap-2 pt-4">
          {editing ? (
            <>
              <ActionButton onClick={save} busy={busy === "save"} icon={<Check className="h-4 w-4" />} label="Save" />
              <ActionButton onClick={() => setEditing(false)} icon={null} label="Cancel" />
            </>
          ) : (
            <>
              <ActionButton onClick={() => setEditing(true)} icon={<Pencil className="h-4 w-4" />} label="Edit" />
              <ActionButton onClick={regenerate} busy={busy === "regen"} icon={<RefreshCw className="h-4 w-4" />} label="Rewrite" />
              <ActionButton
                onClick={async () => {
                  await navigator.clipboard.writeText(`${draft.caption}\n\n${tags}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                label={copied ? "Copied" : "Copy"}
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ActionButton({ onClick, icon, label, busy }: { onClick: () => void; icon: React.ReactNode; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-line text-sm font-medium text-app-ink transition hover:bg-app-bg disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
