"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Download, ImageIcon, Loader2, RotateCcw, ThumbsDown, X } from "lucide-react";
import { isDemo } from "@/components/layout/DashboardLayout";
import { clock } from "@/lib/clip-engine";
import { CopyButton } from "./CopyButton";
import { active, stageText, type ClipRow, type JobDetail } from "./types";

export function JobView({ id }: { id: string }) {
  const [demo] = useState(isDemo);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");

  const load = useCallback(async () => {
    if (demo) {
      setJob(DEMO_JOB);
      setState("ok");
      return DEMO_JOB;
    }
    try {
      const r = await fetch(`/api/create/jobs/${id}`);
      if (r.status === 401) return void window.location.replace("/login");
      if (r.status === 404 || r.status === 403) return void setState("missing");
      if (!r.ok) throw new Error();
      const data: JobDetail = await r.json();
      setJob(data);
      setState("ok");
      return data;
    } catch {
      setState((s) => (s === "loading" ? "error" : s));
      return null;
    }
  }, [id, demo]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const data = await load();
      if (alive && (!data || active(data.status))) timer = setTimeout(tick, 4000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  async function act(action: "retry" | "cancel") {
    if (demo) return;
    await fetch(`/api/create/jobs/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await load();
    if (data && active(data.status)) {
      const poll = async () => {
        const d = await load();
        if (d && active(d.status)) setTimeout(poll, 4000);
      };
      setTimeout(poll, 4000);
    }
  }

  const back = (
    <Link href={`/dashboard/create/clips${demo ? "?demo=1" : ""}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-app-muted transition hover:text-app-ink">
      <ArrowLeft className="h-4 w-4" /> Long video to shorts
    </Link>
  );

  if (state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-app-muted" />
      </div>
    );
  }
  if (state === "missing" || state === "error" || !job) {
    return (
      <div className="pt-2">
        {back}
        <p className="mt-10 font-display text-xl font-semibold">{state === "missing" ? "We couldn't find that video" : "We couldn't load this page"}</p>
        <p className="mt-2 text-sm text-app-muted">{state === "missing" ? "It may have been removed." : "Check your connection and try again."}</p>
      </div>
    );
  }

  const name = job.title || (job.sourceKind === "YOUTUBE" ? "YouTube video" : "Uploaded video");

  return (
    <div className="pb-16 pt-2">
      {back}
      <h1 className="mt-4 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-tight tracking-[-0.03em]">{name}</h1>

      {active(job.status) ? (
        <Working job={job} onCancel={() => act("cancel")} />
      ) : job.status !== "DONE" ? (
        <div className="mt-8 flex max-w-xl items-start gap-4 rounded-3xl border border-app-line bg-app-card p-6">
          <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${job.status === "FAILED" ? "text-red-500" : "text-app-muted"}`} />
          <div>
            <p className="text-[15px] font-semibold">{job.status === "CANCELLED" ? "You cancelled this one" : "This one didn't work"}</p>
            {job.status === "FAILED" && <p className="mt-1 text-sm text-app-muted">{job.error || "Something went wrong while processing."}</p>}
            <button type="button" onClick={() => act("retry")} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-app-ink px-4 text-sm font-semibold text-white">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-app-muted">
            {job.clips.length} clip{job.clips.length === 1 ? "" : "s"}, best first
            {job.sourceSeconds ? ` · from ${clock(job.sourceSeconds)} of video` : ""}. Each comes with a cover and words ready to paste.
          </p>
          <div className="mt-8 space-y-6">
            {job.clips.map((c) => (
              <ClipCard key={c.id} clip={c} demo={demo} />
            ))}
          </div>
          {job.sourceKit && <FullVideoKit kit={job.sourceKit} />}
        </>
      )}
    </div>
  );
}

function Working({ job, onCancel }: { job: JobDetail; onCancel: () => void }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="mt-8 flex max-w-xl flex-col items-start gap-6 rounded-[28px] bg-app-side p-7 text-white sm:flex-row sm:items-center">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="#3D7EFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0.03, job.progress / 100))}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{job.progress}%</span>
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-[-0.02em]">{stageText(job)}</p>
        <p className="mt-1 text-sm text-zinc-400">This takes a while for long videos. You can leave; your clips will be waiting here.</p>
        <button type="button" onClick={onCancel} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

const hashtagLine = (tags: string[]) => tags.map((t) => `#${t}`).join(" ");

function ClipCard({ clip, demo }: { clip: ClipRow; demo: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [rejected, setRejected] = useState(clip.rejected);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const titles = clip.titles.length ? clip.titles : [clip.title];
  const post = [clip.caption, hashtagLine(clip.hashtags)].filter(Boolean).join("\n\n");

  async function reject() {
    if (demo) return setRejected(true);
    const res = await fetch(`/api/create/clips/${clip.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setRejectError(data.error || "Couldn't save that.");
    setRejected(true);
    setRejecting(false);
  }

  return (
    <article className={`grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[28px] border border-app-line bg-app-card p-5 sm:p-6 md:grid-cols-[240px_minmax(0,1fr)] ${rejected ? "opacity-60" : ""}`}>
      <div className="mx-auto w-full max-w-[240px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-app-side ring-1 ring-black/5">
          {clip.videoUrl ? (
            <video src={clip.videoUrl} poster={clip.coverUrl ?? clip.thumbUrl ?? undefined} controls playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">Preview unavailable</div>
          )}
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            #{clip.rank}
            {clip.durationSec ? ` · ${clock(clip.durationSec)}` : ""}
          </span>
        </div>
        {clip.downloadUrl && (
          <a href={clip.downloadUrl} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-app-ink text-sm font-semibold text-white transition hover:bg-black">
            <Download className="h-4 w-4" /> Download video
          </a>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        <div>
          <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em]">{titles[0]}</h3>
          {clip.reason && <p className="mt-1.5 text-sm leading-relaxed text-app-muted">{clip.reason}</p>}
        </div>

        {clip.caption || clip.hashtags.length ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-faint">Caption</p>
              <CopyButton text={post} label="Copy caption" />
            </div>
            <div className="mt-2 rounded-2xl border border-app-line bg-white p-4 text-[15px] leading-relaxed">
              {clip.caption && <p className="whitespace-pre-line">{clip.caption}</p>}
              {clip.hashtags.length > 0 && <p className={`text-[#2F6BFF] ${clip.caption ? "mt-3" : ""}`}>{hashtagLine(clip.hashtags)}</p>}
            </div>
          </section>
        ) : null}

        {titles.length > 1 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-faint">Title ideas</p>
            <ul className="mt-2 divide-y divide-app-line rounded-2xl border border-app-line bg-white">
              {titles.map((t) => (
                <li key={t} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">{t}</span>
                  <CopyButton text={t} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {clip.coverUrl && (
            <a
              href={clip.coverDownloadUrl ?? clip.coverUrl}
              className="group inline-flex items-center gap-3 rounded-2xl border border-app-line bg-white p-2 pr-4 transition hover:border-zinc-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={clip.coverUrl} alt="" className="h-14 w-8 rounded-md object-cover" />
              <span className="text-sm font-semibold">
                <ImageIcon className="mr-1.5 inline h-4 w-4 align-[-3px]" />
                Download cover
              </span>
            </a>
          )}
          {clip.captionsUrl && (
            <a href={clip.captionsUrl} className="inline-flex h-10 items-center rounded-xl border border-app-line bg-white px-3.5 text-sm font-semibold transition hover:border-zinc-300">
              Subtitles (.srt)
            </a>
          )}
          {!rejected && !rejecting && (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-app-muted transition hover:bg-white hover:text-app-ink"
            >
              <ThumbsDown className="h-4 w-4" /> Not quite right
            </button>
          )}
          {rejected && <span className="text-sm text-app-muted">Thanks, we&apos;ll learn from this.</span>}
        </div>

        {rejecting && (
          <div className="rounded-2xl border border-app-line bg-white p-4">
            <label htmlFor={`why-${clip.id}`} className="text-sm font-semibold">
              What&apos;s wrong with it?
            </label>
            <textarea
              id={`why-${clip.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Starts mid-sentence, boring moment, wrong person in frame…"
              className="mt-2 min-h-[72px] w-full resize-y rounded-xl border border-app-line px-3 py-2 text-sm outline-none focus:border-app-ink"
            />
            {rejectError && <p className="mt-1 text-sm text-red-600">{rejectError}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={reject} disabled={reason.trim().length < 3} className="h-9 rounded-lg bg-app-ink px-3 text-sm font-semibold text-white disabled:opacity-40">
                Send
              </button>
              <button type="button" onClick={() => setRejecting(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-app-muted">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function FullVideoKit({ kit }: { kit: NonNullable<JobDetail["sourceKit"]> }) {
  const chapters = kit.chapters.map((c) => `${clock(c.start)} ${c.title}`).join("\n");
  const description = [kit.description, chapters].filter(Boolean).join("\n\n");
  return (
    <section className="mt-12 rounded-[28px] bg-app-side p-6 text-white sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">For the full video</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
        Posting the whole thing on YouTube? <span className="font-serif font-normal italic text-silver">It&apos;s written.</span>
      </h2>

      {kit.titles.length > 0 && (
        <ul className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10">
          {kit.titles.map((t) => (
            <li key={t} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-[15px]">{t}</span>
              <CopyButton text={t} className="border-white/15 bg-white/5 text-white hover:border-white/30" />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-300">Description{chapters ? " with chapters" : ""}</p>
          <CopyButton text={description} label="Copy description" className="border-white/15 bg-white/5 text-white hover:border-white/30" />
        </div>
        <div className="mt-2 max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-zinc-300">
          <p className="whitespace-pre-line">{kit.description}</p>
          {chapters && (
            <ul className="mt-4 space-y-1 font-mono text-[13px]">
              {kit.chapters.map((c) => (
                <li key={c.start}>
                  <span className="text-[#7FA8FF]">{clock(c.start)}</span> {c.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const DEMO_JOB: JobDetail = {
  id: "demo",
  title: "Episode 12 — RGV unfiltered",
  sourceKind: "UPLOAD",
  sourceUrl: null,
  status: "DONE",
  stage: null,
  progress: 100,
  error: null,
  clipCount: 2,
  style: "clean",
  layout: "auto",
  effects: true,
  broll: true,
  sourceSeconds: 4191,
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  sourceKit: {
    titles: ["RGV Unfiltered: Money, Crime, Nepotism and the Logic of Life", "Inside RGV's Mind: Money, Fear, Failure and Human Nature"],
    description:
      "In this episode, Ram Gopal Varma sits down for a wide-ranging conversation on cinema, money, crime and the human mind.\n\nHe breaks down why people are drawn to disorder, why star kids get first chances, and why most worry is really unprocessed emotion.",
    chapters: [
      { start: 0, title: "Money, power and nepotism" },
      { start: 390, title: "What cinema means to RGV" },
      { start: 1890, title: "Why crime is the most sellable content" },
      { start: 3730, title: "Worry versus thinking explained" },
    ],
  },
  clips: [1, 2].map((rank) => ({
    id: `demo-${rank}`,
    rank,
    title: rank === 1 ? "Why Is Crime The Most Sellable Content" : "Why Do Star Kids Get Chances First",
    theme: null,
    reason: rank === 1 ? "Opens on a contestable claim and pays it off with a concrete example inside 80 seconds." : "A question the viewer has asked themselves, answered bluntly.",
    format: "single_take",
    finalScore: 8.4,
    durationSec: rank === 1 ? 80.7 : 43.7,
    titles:
      rank === 1
        ? ["Why Is Crime The Most Sellable Content", "RGV's Bold Claim About Human Nature", "Why Do We Love Reading About Disasters"]
        : ["Why Do Star Kids Get Chances First", "RGV's Blunt Take On Nepotism", "Would You Not Give Your Own Son"],
    caption:
      rank === 1
        ? "RGV breaks down why crime, chaos and disorder excite us more than order ever will.\nWatch till the end and tell us what you think."
        : "RGV says nepotism isn't injustice, it's just how every family business works.\nAgree or disagree? Drop a comment.",
    hashtags: ["rgv", "ramgopalvarma", "telugupodcast", "humannature", "teluguinterviews"],
    rejected: false,
    videoUrl: null,
    downloadUrl: null,
    thumbUrl: null,
    captionsUrl: null,
    coverUrl: null,
    coverDownloadUrl: null,
  })),
};
