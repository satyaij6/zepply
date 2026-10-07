"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Film, Link2, Loader2, Minus, Plus, Sparkles, Upload, X } from "lucide-react";
import { isDemo } from "@/components/layout/DashboardLayout";
import { Field, OptionCard, TextInput } from "@/components/create/ui";
import {
  CAPTION_POSITIONS,
  CLIP_COUNT,
  CLIP_LAYOUTS,
  CLIP_STYLES,
  MAX_UPLOAD_BYTES,
  isYouTubeUrl,
  type ClipLayout,
  type ClipStyle,
} from "@/lib/clip-engine";
import { active, ago, stageText, type JobRow } from "./types";

type Upload = { name: string; size: number; progress: number; path: string | null; error: string | null };

const OPTIONS_KEY = "zepply.clips.options";
type Options = {
  clipCount: number;
  style: ClipStyle;
  captionPos: (typeof CAPTION_POSITIONS)[number];
  layout: ClipLayout;
  effects: boolean;
  broll: boolean;
};
const DEFAULTS: Options = { clipCount: CLIP_COUNT.default, style: "clean", captionPos: "bottom", layout: "auto", effects: true, broll: false };

const size = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`);

/** PUT with progress events, which fetch() can't report. */
function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(file);
  });
}

export function ClipsHome() {
  const router = useRouter();
  const [demo] = useState(isDemo);
  const [access, setAccess] = useState<"loading" | "ok" | "invite" | "error">("loading");
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [kind, setKind] = useState<"UPLOAD" | "YOUTUBE">("UPLOAD");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [url, setUrl] = useState("");
  const [owns, setOwns] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<Options>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "null");
      if (saved) queueMicrotask(() => setOptions({ ...DEFAULTS, ...saved }));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch {}
  }, [options]);

  // The user's videos; polled while any is still processing
  useEffect(() => {
    if (demo) {
      queueMicrotask(() => {
        setAccess("ok");
        setJobs(DEMO_JOBS);
      });
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/create/jobs")
        .then(async (r) => {
          if (r.status === 401) return window.location.replace("/login");
          if (r.status === 403) return setAccess("invite");
          if (!r.ok) throw new Error();
          const d: { jobs: JobRow[] } = await r.json();
          if (!alive) return;
          setAccess("ok");
          setJobs(d.jobs);
          if (d.jobs.some((j) => active(j.status))) timer = setTimeout(load, 5000);
        })
        .catch(() => alive && setAccess((a) => (a === "loading" ? "error" : a)));
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [demo]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/^(video|audio)\//.test(file.type)) return setError("That isn't a video or audio file.");
    if (file.size > MAX_UPLOAD_BYTES) return setError(`Files can be up to ${size(MAX_UPLOAD_BYTES)}.`);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const next: Upload = { name: file.name, size: file.size, progress: 0, path: null, error: null };
    setUpload(next);
    if (demo) {
      // Pretend, so the flow can be reviewed without storage
      for (let p = 0; p <= 1; p += 0.25) await new Promise((r) => setTimeout(r, 150)).then(() => setUpload({ ...next, progress: p }));
      return setUpload({ ...next, progress: 1, path: "demo/path" });
    }
    try {
      const res = await fetch("/api/create/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Uploads aren't available right now.");
      await put(data.signedUrl, file, (p) => setUpload((u) => (u && u.name === file.name ? { ...u, progress: p } : u)));
      setUpload((u) => (u && u.name === file.name ? { ...u, progress: 1, path: data.path } : u));
    } catch (e) {
      setUpload((u) => (u && u.name === file.name ? { ...u, error: e instanceof Error ? e.message : "Upload failed." } : u));
    }
  }

  const ready = kind === "UPLOAD" ? !!upload?.path : isYouTubeUrl(url.trim()) && owns;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    if (demo) return router.push("/dashboard/create/clips/demo?demo=1");
    try {
      const res = await fetch("/api/create/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          source: kind === "UPLOAD" ? { kind, path: upload!.path } : { kind, url: url.trim(), ownsContent: true },
          language: "te",
          ...options,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start. Please try again.");
      router.push(`/dashboard/create/clips/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start. Please try again.");
      setBusy(false);
    }
  }

  const set = <K extends keyof Options>(key: K, value: Options[K]) => setOptions((o) => ({ ...o, [key]: value }));

  if (access === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-app-muted" />
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

  return (
    <div className="space-y-10 pb-12 pt-2">
      <div>
        <Link href="/dashboard/create" className="inline-flex items-center gap-1.5 text-sm font-medium text-app-muted transition hover:text-app-ink">
          <ArrowLeft className="h-4 w-4" /> Create
        </Link>
        <h1 className="mt-4 font-display text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-[-0.03em]">
          One long video, <span className="font-serif font-normal italic">a week of posts</span>
        </h1>
        <p className="mt-2 max-w-[620px] text-[15px] text-app-muted">
          Give us a podcast, interview or talk. We find the moments worth sharing, frame them for Reels and Shorts, add captions, and write the
          titles, caption and hashtags for each one.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Source */}
        <section className="rounded-[28px] border border-app-line bg-app-card p-6 sm:p-8">
          <div className="inline-flex rounded-xl bg-app-bg p-1" role="tablist">
            {(
              [
                ["UPLOAD", "Upload a file", Upload],
                ["YOUTUBE", "YouTube link", Link2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={kind === value}
                onClick={() => setKind(value)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${
                  kind === value ? "bg-white text-app-ink shadow-sm" : "text-app-muted hover:text-app-ink"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {kind === "UPLOAD" ? (
            <div className="mt-6">
              {!upload ? (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pick(e.dataTransfer.files[0]);
                  }}
                  className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
                    dragging ? "border-app-ink bg-white" : "border-app-line bg-white/60 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-side text-white">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="mt-4 text-[15px] font-semibold text-app-ink">Drop your video here, or click to choose</span>
                  <span className="mt-1 text-sm text-app-muted">MP4, MOV or audio, up to {size(MAX_UPLOAD_BYTES)}. Longer than a few minutes works best.</span>
                </button>
              ) : (
                <div className="rounded-2xl border border-app-line bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg text-app-muted">
                      <Film className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{upload.name}</p>
                      <p className="text-xs text-app-muted">
                        {size(upload.size)} ·{" "}
                        {upload.error ? (
                          <span className="text-red-600">{upload.error}</span>
                        ) : upload.path ? (
                          <span className="text-emerald-700">Uploaded</span>
                        ) : (
                          `Uploading ${Math.round(upload.progress * 100)}%`
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => setUpload(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-bg hover:text-app-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {!upload.path && !upload.error && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-bg">
                      <div className="h-full rounded-full bg-app-ink transition-[width] duration-300" style={{ width: `${Math.max(3, upload.progress * 100)}%` }} />
                    </div>
                  )}
                </div>
              )}
              <input ref={fileInput} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <TextInput type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
              {url && !isYouTubeUrl(url.trim()) && <p className="text-sm text-red-600">Paste a youtube.com or youtu.be link.</p>}
              <label className="flex cursor-pointer items-start gap-3 text-sm text-app-muted">
                <input type="checkbox" checked={owns} onChange={(e) => setOwns(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-app-ink)]" />
                This is my video, or I have permission to use it.
              </label>
            </div>
          )}

          <div className="mt-6">
            <Field label="Name" hint="Just for you, to find it later." htmlFor="clip-title">
              <TextInput id="clip-title" placeholder="Episode 12 with Ravi" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Options */}
        <section className="space-y-6 rounded-[28px] border border-app-line bg-app-card p-6 sm:p-8">
          <Field label="How many clips">
            <div className="inline-flex items-center gap-1 rounded-xl border border-app-line bg-white p-1">
              <button
                type="button"
                aria-label="Fewer"
                onClick={() => set("clipCount", Math.max(CLIP_COUNT.min, options.clipCount - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-app-bg"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-[15px] font-semibold tabular-nums">{options.clipCount}</span>
              <button
                type="button"
                aria-label="More"
                onClick={() => set("clipCount", Math.min(CLIP_COUNT.max, options.clipCount + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-app-bg"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Field>

          <Field label="Framing">
            <div className="grid gap-2">
              {CLIP_LAYOUTS.map((l) => (
                <OptionCard key={l.value} selected={options.layout === l.value} onClick={() => set("layout", l.value)} title={l.label} hint={l.note} />
              ))}
            </div>
          </Field>

          <Field label="Caption style" hint="Speech is in Telugu. Latin styles show it in English letters.">
            <div className="flex flex-wrap gap-2">
              {CLIP_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  title={s.note}
                  onClick={() => set("style", s.value)}
                  className={`h-9 rounded-xl border px-3 text-sm font-semibold transition ${
                    options.style === s.value ? "border-app-ink bg-app-ink text-white" : "border-app-line bg-white text-app-ink hover:border-zinc-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Caption position">
            <div className="inline-flex rounded-xl bg-app-bg p-1">
              {CAPTION_POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("captionPos", p)}
                  className={`h-8 rounded-lg px-3 text-sm font-semibold capitalize transition ${
                    options.captionPos === p ? "bg-white text-app-ink shadow-sm" : "text-app-muted hover:text-app-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Toggle
            checked={options.broll}
            onChange={(v) => set("broll", v)}
            title="Story visuals"
            hint="Motion graphics that show what's being said, designed for each clip. Adds a few minutes per clip."
          />
          <Toggle
            checked={options.effects}
            onChange={(v) => set("effects", v)}
            title="Zoom on key moments"
            hint="A quick punch-in when the speaker hits a word hard."
          />
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-app-ink px-6 text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Make my clips
        </button>
        <p className="text-sm text-app-muted">Usually 10 to 20 minutes for an hour of video. You can leave this page.</p>
        {error && (
          <p className="flex w-full items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Your videos</h2>
        {jobs === null ? (
          <div className="mt-4 h-24 animate-pulse rounded-3xl bg-white/60" />
        ) : jobs.length === 0 ? (
          <p className="mt-3 text-sm text-app-muted">Videos you send will show up here, with their clips.</p>
        ) : (
          <ul className="mt-4 divide-y divide-app-line overflow-hidden rounded-3xl border border-app-line bg-app-card">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/dashboard/create/clips/${j.id}${demo ? "?demo=1" : ""}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{j.title || (j.sourceKind === "YOUTUBE" ? "YouTube video" : "Uploaded video")}</span>
                    <span className="mt-0.5 block text-sm text-app-muted">
                      {active(j.status)
                        ? `${stageText(j)} ${j.status === "RUNNING" ? `${j.progress}%` : ""}`
                        : j.status === "DONE"
                          ? `${j._count.clips} clip${j._count.clips === 1 ? "" : "s"} · ${ago(j.finishedAt ?? j.createdAt)}`
                          : j.status === "CANCELLED"
                            ? "Cancelled"
                            : j.error || "This one didn't work."}
                    </span>
                  </span>
                  <StatusDot status={j.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-app-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Toggle({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-app-line bg-white p-4">
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-app-muted">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-app-ink" : "bg-zinc-300"} after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition ${
          checked ? "after:translate-x-5" : ""
        } peer-focus-visible:ring-2 peer-focus-visible:ring-app-ink peer-focus-visible:ring-offset-2`}
      />
    </label>
  );
}

function StatusDot({ status }: { status: JobRow["status"] }) {
  if (status === "DONE") return <Check className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "FAILED") return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />;
  if (active(status)) return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-muted" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-300" />;
}

function InviteOnly() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-side text-white">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">Clips are invite-only for now</p>
      <p className="mt-2 text-[15px] leading-relaxed text-app-muted">
        We&apos;re opening video creation to a few creators at a time. Write to us and we&apos;ll add you to the next group.
      </p>
      <a href="mailto:contact@buybloc.com?subject=Zepply%20clips" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white">
        Ask for access <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}

const DEMO_JOBS: JobRow[] = [
  {
    id: "demo",
    title: "Episode 12 — RGV unfiltered",
    sourceKind: "UPLOAD",
    status: "DONE",
    stage: null,
    progress: 100,
    error: null,
    clipCount: 3,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    finishedAt: new Date(Date.now() - 2400_000).toISOString(),
    _count: { clips: 3 },
  },
  {
    id: "demo-running",
    title: "Weekly Q&A",
    sourceKind: "YOUTUBE",
    status: "RUNNING",
    stage: "finding_moments",
    progress: 52,
    error: null,
    clipCount: 5,
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    finishedAt: null,
    _count: { clips: 0 },
  },
];
