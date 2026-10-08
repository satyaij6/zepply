"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, Captions, Check, ChevronDown, ChevronRight, Clapperboard, Clock, Film, Link2,
  Loader2, Megaphone, MessageCircle, Minus, Palette, Plus, Scissors, SlidersHorizontal, Smartphone, Sparkles,
  Upload, Wand2, X,
} from "lucide-react";
import { isDemo, useShellUser } from "@/components/layout/DashboardLayout";
import { TextInput } from "@/components/create/ui";
import {
  CAPTION_POSITIONS, CLIP_COUNT, CLIP_LAYOUTS, CLIP_STYLES, MAX_UPLOAD_BYTES, isYouTubeUrl, type ClipLayout,
} from "@/lib/clip-engine";
import { CAPTION_GROUPS, DEFAULT_TEMPLATE, EDIT_TEMPLATES, estimateMinutes, isKeyword, templateOf } from "@/lib/clip-templates";
import { CaptionSample, TemplatePreview } from "./StylePreviews";
import { active, ago, stageText, type JobRow } from "./types";

type Upload = { name: string; size: number; progress: number; path: string | null; error: string | null };
type CaptionPos = (typeof CAPTION_POSITIONS)[number];

const OPTIONS_KEY = "zepply.clips.options.v2";
type Options = {
  template: string;
  style: string; // a CLIP_STYLES value, or "none"
  captionPos: CaptionPos;
  layout: ClipLayout;
  effects: boolean;
  broll: boolean;
  clipCount: number;
  keyword: string;
  link: string;
  message: string;
};
const fromTemplate = (value: string) => {
  const t = templateOf(value);
  return { template: t.value, style: t.caption, effects: t.effects, broll: t.broll };
};
const DEFAULTS: Options = {
  ...fromTemplate(DEFAULT_TEMPLATE),
  captionPos: "bottom",
  layout: "auto",
  clipCount: CLIP_COUNT.default,
  keyword: "",
  link: "",
  message: "",
};

const size = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`);

/** The brand hue, darkened for the "Comment for link" canvas (same rule as workers/clipper/clipper/reel.py). */
function canvasFrom(accent: string) {
  const h = accent.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    hue = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  }
  return `hsl(${Math.round(hue * 360)} 48% 17%)`;
}

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
  const shell = useShellUser();
  const [demo] = useState(isDemo);
  const [access, setAccess] = useState<"loading" | "ok" | "invite" | "error">("loading");
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [kind, setKind] = useState<"UPLOAD" | "YOUTUBE">("UPLOAD");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [url, setUrl] = useState("");
  const [owns, setOwns] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<Options>(DEFAULTS);
  const [captionTab, setCaptionTab] = useState<string>("all");
  const [advanced, setAdvanced] = useState(false);
  const [accent, setAccent] = useState("#3888F0");
  const [hasKit, setHasKit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const template = templateOf(options.template);
  const canvas = canvasFrom(accent);
  const set = <K extends keyof Options>(key: K, value: Options[K]) => setOptions((o) => ({ ...o, [key]: value }));
  const chooseTemplate = (value: string) => setOptions((o) => ({ ...o, ...fromTemplate(value) }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "null");
      if (saved) queueMicrotask(() => setOptions({ ...DEFAULTS, ...saved }));
      // Arriving from the "Comment for link" chip on Create
      const wanted = new URLSearchParams(window.location.search).get("template");
      if (wanted && EDIT_TEMPLATES.some((t) => t.value === wanted)) queueMicrotask(() => setOptions((o) => ({ ...o, ...fromTemplate(wanted) })));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch {}
  }, [options]);

  // The Brand Kit's accent colours the previews, the pen marks and the end card
  useEffect(() => {
    if (demo) return;
    fetch("/api/brand-kit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.kit?.accent) {
          setAccent(d.kit.accent);
          setHasKit(true);
        }
      })
      .catch(() => {});
  }, [demo]);

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

  const sourceReady = kind === "UPLOAD" ? !!upload?.path : isYouTubeUrl(url.trim()) && owns;
  const ctaReady = !template.cta || isKeyword(options.keyword);
  const ready = sourceReady && ctaReady;
  const minutes = estimateMinutes(template, options.clipCount);
  const missing = !sourceReady ? "Add a video first" : !ctaReady ? "Add the keyword people will comment" : null;

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
          template: options.template,
          style: options.style,
          captionPos: options.captionPos,
          layout: options.layout,
          effects: options.effects,
          broll: options.broll,
          clipCount: options.clipCount,
          cta: template.cta ? { keyword: options.keyword.trim(), link: options.link.trim(), message: options.message.trim() || undefined } : undefined,
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

  const captionStyles = useMemo(() => {
    const group = CAPTION_GROUPS.find((g) => g.value === captionTab);
    const values: string[] = group ? [...group.styles] : CLIP_STYLES.map((s) => s.value);
    return CLIP_STYLES.filter((s) => values.includes(s.value));
  }, [captionTab]);
  const suggested = useMemo(() => {
    const own = template.caption;
    return [own, ...["karaoke", "emphasis", "pill"].filter((v) => v !== own)].slice(0, 3);
  }, [template.caption]);
  const styleLabel = (v: string) => (v === "none" ? "No captions" : CLIP_STYLES.find((s) => s.value === v)?.label ?? v);

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

  const generate = (
    <button
      type="button"
      onClick={submit}
      disabled={!ready || busy}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-ink text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Make my clips
    </button>
  );

  return (
    <div className="pb-16 pt-2">
      <h1 className="font-display text-[clamp(26px,2.6vw,34px)] font-semibold leading-tight tracking-[-0.03em]">What do you want to make?</h1>
      <p className="mt-1.5 text-[15px] text-app-muted">Pick a starting point. Everything below stays editable.</p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <ModeChip active={!template.cta} onClick={() => template.cta && chooseTemplate(DEFAULT_TEMPLATE)} icon={Scissors}>
          Long video to shorts
        </ModeChip>
        <ModeChip active={template.cta} onClick={() => chooseTemplate("comment")} icon={MessageCircle}>
          Comment-for-link reel
        </ModeChip>
        <ModeChip href="/dashboard/create/promo" icon={Megaphone}>
          Promo reel
        </ModeChip>
      </div>

      <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------------------------------------------------------- main column */}
        <div className="min-w-0 space-y-7">
          <section className="rounded-[24px] border border-app-line bg-app-card p-5 sm:p-7">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">{template.cta ? "Your video" : "Long video to shorts"}</h2>
            <p className="mt-1 text-[15px] text-app-muted">
              {template.cta
                ? "Upload yourself talking about the offer or tool. We cut it into a reel with your brand colour and a “Comment” ending."
                : "Give us a podcast, interview or talk. We find the moments worth sharing and edit each one in the style you pick below."}
            </p>

            <div className="mt-5 inline-flex rounded-xl bg-app-bg p-1" role="tablist">
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
              <div className="mt-4">
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
                    className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                      dragging ? "border-app-ink bg-white" : "border-app-line bg-white/60 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-bg text-app-muted">
                      <Upload className="h-[18px] w-[18px]" />
                    </span>
                    <span className="mt-3 text-[15px] font-semibold text-app-ink">Drop your video here, or click to choose</span>
                    <span className="mt-1 text-sm text-app-muted">MP4, MOV or audio, up to {size(MAX_UPLOAD_BYTES)}</span>
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
              <div className="mt-4 space-y-3">
                <TextInput type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
                {url && !isYouTubeUrl(url.trim()) && <p className="text-sm text-red-600">Paste a youtube.com or youtu.be link.</p>}
                <label className="flex cursor-pointer items-start gap-3 text-sm text-app-muted">
                  <input type="checkbox" checked={owns} onChange={(e) => setOwns(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-app-ink)]" />
                  This is my video, or I have permission to use it.
                </label>
              </div>
            )}
            <div className="mt-4">
              <TextInput placeholder="Name it (just for you)" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </section>

          <h2 className="pt-1 text-xl font-semibold tracking-[-0.02em]">Customize options</h2>

          {/* -------- template */}
          <Section icon={Wand2} tint="bg-violet-100 text-violet-700" title="Edit template" hint="The whole look of every clip. You can still change captions below.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {EDIT_TEMPLATES.map((t) => {
                const on = t.value === options.template;
                return (
                  <button key={t.value} type="button" onClick={() => chooseTemplate(t.value)} className="group text-left" aria-pressed={on}>
                    <span
                      className={`relative block aspect-[9/14] overflow-hidden rounded-2xl ring-1 ring-black/5 transition ${
                        on ? "ring-[3px] ring-emerald-500" : "group-hover:ring-zinc-300"
                      }`}
                    >
                      <TemplatePreview template={t.value} accent={accent} canvas={canvas} />
                      {t.badge && (
                        <span className="absolute left-2 top-2 rounded-md bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">{t.badge}</span>
                      )}
                      {on && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-600 shadow">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className={`mt-2 block text-[15px] ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
                    <span className="block text-[13px] text-app-muted">{t.bestFor}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* -------- captions */}
          <Section icon={Captions} tint="bg-sky-100 text-sky-700" title="Captions">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold">Turn off captions</p>
                <p className="text-sm text-app-muted">Show no words on screen</p>
              </div>
              <Switch checked={options.style === "none"} onChange={(v) => set("style", v ? "none" : template.caption)} />
            </div>

            {options.style !== "none" && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-[15px] font-semibold">Suggested for {template.label}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {suggested.map((v) => (
                    <CaptionTile key={v} value={v} label={styleLabel(v)} on={options.style === v} accent={accent} onClick={() => set("style", v)} />
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-b border-app-line">
                  {[{ value: "all", label: "All" }, ...CAPTION_GROUPS].map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setCaptionTab(g.value)}
                      className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
                        captionTab === g.value ? "border-app-ink text-app-ink" : "border-transparent text-app-muted hover:text-app-ink"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {captionStyles.map((s) => (
                    <CaptionTile key={s.value} value={s.value} label={s.label} on={options.style === s.value} accent={accent} onClick={() => set("style", s.value)} />
                  ))}
                </div>

                <p className="mt-6 text-[15px] font-semibold">Position</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["top", "Top"],
                      ["center", "Middle"],
                      ["bottom", "Bottom"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set("captionPos", v)}
                      className={`h-10 rounded-xl border text-sm font-semibold transition ${
                        options.captionPos === v ? "border-emerald-500 bg-emerald-50 text-app-ink" : "border-app-line bg-white text-app-muted hover:border-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {options.style === "kinetic" && <p className="mt-2 text-[13px] text-app-muted">Kinetic places words around the speaker, so position only applies to the fallback line.</p>}
              </>
            )}
          </Section>

          {/* -------- comment for link */}
          {template.cta && (
            <Section icon={MessageCircle} tint="bg-rose-100 text-rose-700" title="Comment for link" hint="The reel ends with “Comment WORD”. Everyone who comments that word gets your link in a DM.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold">Keyword</span>
                  <TextInput
                    className="mt-1.5 uppercase"
                    placeholder="LINK"
                    maxLength={16}
                    value={options.keyword}
                    onChange={(e) => set("keyword", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                  />
                  {options.keyword && !isKeyword(options.keyword) && <span className="mt-1 block text-[13px] text-red-600">2 to 16 letters or numbers</span>}
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">Link they get</span>
                  <TextInput className="mt-1.5" type="url" placeholder="https://…" value={options.link} onChange={(e) => set("link", e.target.value)} />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold">DM message</span>
                <TextInput className="mt-1.5" placeholder="Here's the link you asked for:" maxLength={600} value={options.message} onChange={(e) => set("message", e.target.value)} />
              </label>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-app-bg px-4 py-3 text-sm">
                {shell?.igAccount ? (
                  <>
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      Replies go out from <b>@{shell.igAccount.igUsername}</b> as soon as you post the reel.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Connect Instagram so Zepply can send the link.{" "}
                      <Link href="/dashboard/settings" className="font-semibold underline">
                        Connect
                      </Link>
                    </span>
                  </>
                )}
              </div>
            </Section>
          )}

          {/* -------- effects */}
          <Section icon={Sparkles} tint="bg-amber-100 text-amber-700" title="Effects">
            <Row title="Story visuals" hint={`Motion graphics that show what's being said, in the ${template.look === "explainer" ? "light Explainer" : template.look === "signal" ? "Signal Grid" : "Editorial"} look. Adds a few minutes per clip.`}>
              <Switch checked={options.broll} onChange={(v) => set("broll", v)} />
            </Row>
            <Row title="Zoom on key moments" hint="A quick punch-in when the speaker hits a word hard.">
              <Switch checked={options.effects} onChange={(v) => set("effects", v)} />
            </Row>
          </Section>

          {/* -------- advanced */}
          <section className="rounded-[24px] border border-app-line bg-app-card">
            <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex w-full items-center justify-between px-5 py-5 sm:px-7" aria-expanded={advanced}>
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <span className="text-[17px] font-semibold">Advanced options</span>
              </span>
              <ChevronDown className={`h-5 w-5 text-app-muted transition ${advanced ? "rotate-180" : ""}`} />
            </button>
            {advanced && (
              <div className="space-y-5 border-t border-app-line px-5 py-6 sm:px-7">
                <Row title="How many clips" hint="The best moments, best first.">
                  <div className="inline-flex items-center gap-1 rounded-xl border border-app-line bg-white p-1">
                    <button type="button" aria-label="Fewer" onClick={() => set("clipCount", Math.max(CLIP_COUNT.min, options.clipCount - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-app-bg">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-semibold tabular-nums">{options.clipCount}</span>
                    <button type="button" aria-label="More" onClick={() => set("clipCount", Math.min(CLIP_COUNT.max, options.clipCount + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-app-bg">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </Row>
                <Row title="Framing" hint={CLIP_LAYOUTS.find((l) => l.value === options.layout)?.note ?? ""}>
                  <select
                    value={options.layout}
                    onChange={(e) => set("layout", e.target.value as ClipLayout)}
                    className="h-10 rounded-xl border border-app-line bg-white px-3 text-sm font-medium"
                  >
                    {CLIP_LAYOUTS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Speech language" hint="More languages are coming.">
                  <span className="rounded-xl border border-app-line bg-white px-3 py-2 text-sm font-medium">Telugu</span>
                </Row>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <p className="flex items-center gap-2 text-sm text-app-muted">
              <Clock className="h-4 w-4" /> About {minutes} min · {options.clipCount} clips
            </p>
            <div className="w-full sm:w-64">{generate}</div>
          </div>
          {error && (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}

          <section className="pt-6">
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Your videos</h2>
            {jobs === null ? (
              <div className="mt-4 h-24 animate-pulse rounded-3xl bg-white/60" />
            ) : jobs.length === 0 ? (
              <p className="mt-3 text-sm text-app-muted">Videos you send will show up here, with their clips.</p>
            ) : (
              <ul className="mt-4 divide-y divide-app-line overflow-hidden rounded-3xl border border-app-line bg-app-card">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/dashboard/create/clips/${j.id}${demo ? "?demo=1" : ""}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{j.title || (j.sourceKind === "YOUTUBE" ? "YouTube video" : "Uploaded video")}</span>
                        <span className="mt-0.5 block text-sm text-app-muted">
                          {active(j.status)
                            ? `${stageText(j)} ${j.status === "RUNNING" ? `${j.progress}%` : ""}`
                            : j.status === "DONE"
                              ? `${templateOf(j.template).label} · ${j._count.clips} clip${j._count.clips === 1 ? "" : "s"} · ${ago(j.finishedAt ?? j.createdAt)}`
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

        {/* ---------------------------------------------------------------- side rail */}
        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-app-line bg-app-card p-1">
              {(["9:16", "16:9", "1:1", "4:5"] as const).map((r) => (
                <span
                  key={r}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${r === "9:16" ? "bg-white text-app-ink shadow-sm" : "text-app-faint"}`}
                  title={r === "9:16" ? undefined : "Coming soon"}
                >
                  <Smartphone className={`h-3.5 w-3.5 ${r === "9:16" ? "" : "opacity-50"}`} /> {r}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-app-muted">Best for Reels, Shorts and TikTok.</p>
          </div>

          <div className="rounded-[20px] border border-app-line bg-app-card p-4">
            <div className="flex items-center justify-between rounded-xl border border-app-line bg-white px-3.5 py-3 text-sm">
              <span className="flex items-center gap-2 text-app-muted">
                <Clock className="h-4 w-4" /> Estimated time
              </span>
              <span className="font-semibold">~{minutes} min</span>
            </div>
            <div className="mt-3">{generate}</div>
            {missing && <p className="mt-2 text-center text-[13px] text-app-muted">{missing}</p>}
          </div>

          <div>
            <p className="text-[15px] font-semibold">Example output</p>
            <div className="relative mt-3 aspect-[9/16] w-full overflow-hidden rounded-[22px] bg-app-side shadow-sm">
              <TemplatePreview template={options.template} accent={accent} canvas={canvas} big />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1.5 bg-gradient-to-b from-black/55 to-transparent p-3">
                <Chip label="Template" value={template.label} />
                <Chip label="Captions" value={styleLabel(options.style)} />
                {options.broll && <Chip label="Visuals" value="On" />}
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-app-muted">{template.about}</p>
          </div>

          <div className="rounded-[20px] border border-app-line bg-app-card p-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Palette className="h-4 w-4" /> Brand kit
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: accent }} />
              <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: canvas }} />
              <span className="text-[13px] text-app-muted">{hasKit ? "Your colours colour the pen, the canvas and the ending." : "Using Zepply blue. Set your colours once and every clip uses them."}</span>
            </div>
            <Link href="/dashboard/brand-kit" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-app-line bg-white px-3 text-sm font-semibold transition hover:border-zinc-300">
              {hasKit ? "Edit brand kit" : "Set up brand kit"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ModeChip({ children, icon: Icon, active = false, onClick, href }: { children: ReactNode; icon: typeof Scissors; active?: boolean; onClick?: () => void; href?: string }) {
  const cls = `inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium transition ${
    active ? "border-emerald-500 bg-emerald-50 text-app-ink" : "border-app-line bg-white text-app-ink hover:border-zinc-300"
  }`;
  if (href)
    return (
      <Link href={href} className={cls}>
        <Icon className="h-4 w-4" /> {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function Section({ icon: Icon, tint, title, hint, children }: { icon: typeof Scissors; tint: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-app-line bg-app-card p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-[17px] font-semibold">{title}</h3>
      </div>
      {hint && <p className="mt-2 text-sm text-app-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-sm text-app-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-zinc-300"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function CaptionTile({ value, label, on, accent, onClick }: { value: string; label: string; on: boolean; accent: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group text-left" aria-pressed={on}>
      <span
        className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-700 to-zinc-900 px-2 transition ${
          on ? "ring-[3px] ring-emerald-500" : "ring-1 ring-black/10 group-hover:ring-zinc-400"
        }`}
      >
        <CaptionSample style={value} accent={accent} />
        {on && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={`mt-1.5 block text-sm ${on ? "font-semibold" : "text-app-muted"}`}>{label}</span>
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur">
      {label} <b className="text-white">{value}</b>
    </span>
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
        <Clapperboard className="h-5 w-5" />
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
    title: "Episode 12 — on building in public",
    sourceKind: "UPLOAD",
    status: "DONE",
    stage: null,
    progress: 100,
    error: null,
    clipCount: 3,
    template: "kinetic",
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
    template: "comment",
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    finishedAt: null,
    _count: { clips: 0 },
  },
];
