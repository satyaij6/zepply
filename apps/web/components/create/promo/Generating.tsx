"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Download, Loader2, Plus, RotateCcw } from "lucide-react";
import type { ReelFormat } from "@zepply/reels";
import { FORMATS } from "@zepply/reels";
import { FORMAT_LABELS } from "@/lib/reels/options";

export type ReelRow = {
  id: string;
  groupId: string;
  format: ReelFormat;
  length: "standard" | "short";
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
  progress: number;
  error: string | null;
  videoUrl: string | null;
  brandName: string;
  createdAt: string;
};

const STAGES = [
  [0, "Waiting for a free spot…"],
  [1, "Setting up your scenes…"],
  [20, "Adding your photos and words…"],
  [45, "Animating every scene…"],
  [75, "Mixing the music…"],
  [92, "Almost ready…"],
] as const;

export const stageText = (r: Pick<ReelRow, "status" | "progress">) =>
  r.status === "QUEUED" ? STAGES[0][1] : [...STAGES].reverse().find(([p]) => r.progress >= p)?.[1] ?? STAGES[1][1];

export const downloadUrl = (url: string, name: string) => `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
export const fileName = (r: Pick<ReelRow, "brandName" | "format">) =>
  `${(r.brandName || "zepply").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "reel"}-${r.format}.mp4`;

/** Progress for one Generate: a card per video size, each becoming a player with a download. */
export function Generating({ groupId, onAnother }: { groupId: string; onAnother: () => void }) {
  const [reels, setReels] = useState<ReelRow[] | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);

  const load = useCallback(
    () =>
      fetch(`/api/reels?group=${groupId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { reels: ReelRow[] }) => {
          setReels(d.reels);
          setFailedLoad(false);
          return d.reels;
        })
        .catch(() => {
          setFailedLoad(true);
          return null;
        }),
    [groupId],
  );

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const rows = await load();
      const active = !rows || rows.some((r) => r.status === "QUEUED" || r.status === "RUNNING");
      if (alive && active) timer = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  async function retry(id: string) {
    await fetch(`/api/reels/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "retry" }) });
    const rows = await load();
    if (rows) {
      // restart polling
      const poll = async () => {
        const r = await load();
        if (r?.some((x) => x.status === "QUEUED" || x.status === "RUNNING")) setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
    }
  }

  const done = reels?.every((r) => r.status === "DONE");
  const sorted = reels ? [...reels].sort((a, b) => order(a.format) - order(b.format)) : null;

  return (
    <div className="pb-12 pt-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-app-faint">Promo reel</p>
      <h1 className="mt-2 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-tight tracking-[-0.03em]">
        {done ? "Your reel is ready" : "Making your reel"}
      </h1>
      <p className="mt-2 text-[15px] text-app-muted">
        {done ? "Download it and post it wherever you picked." : "This takes about 2 minutes. You can leave this page: your reels will be waiting in Create."}
      </p>

      {failedLoad && !reels && <p className="mt-8 text-sm text-app-muted">Can&apos;t reach the server. Retrying…</p>}

      <div className="mt-8 flex flex-wrap items-start gap-6">
        {sorted?.map((r) => (
          <ReelCard key={r.id} reel={r} onRetry={() => retry(r.id)} />
        ))}
        {!reels && !failedLoad && <Loader2 className="h-5 w-5 animate-spin text-app-muted" />}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button type="button" onClick={onAnother} className="inline-flex h-11 items-center gap-2 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white transition hover:bg-black">
          <Plus className="h-4 w-4" /> Make another
        </button>
        <Link href="/dashboard/create" className="inline-flex h-11 items-center rounded-xl border border-app-line bg-white px-5 text-sm font-semibold text-app-ink transition hover:border-zinc-300">
          All my reels
        </Link>
      </div>
    </div>
  );
}

const order = (f: ReelFormat) => ["vertical", "portrait", "wide"].indexOf(f);

export function ReelCard({ reel, onRetry, compact = false }: { reel: ReelRow; onRetry?: () => void; compact?: boolean }) {
  const { width, height } = FORMATS[reel.format];
  const w = compact ? (reel.format === "wide" ? 300 : 170) : reel.format === "wide" ? 480 : 270;
  const working = reel.status === "QUEUED" || reel.status === "RUNNING";

  return (
    <div className="w-full max-w-full" style={{ width: w }}>
      <div className="relative overflow-hidden rounded-2xl bg-app-side ring-1 ring-black/5" style={{ aspectRatio: `${width} / ${height}` }}>
        {reel.status === "DONE" && reel.videoUrl ? (
          <video src={reel.videoUrl} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
            {working ? (
              <>
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="#3D7EFF"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 * (1 - Math.max(0.03, reel.progress / 100))}
                      className="transition-[stroke-dashoffset] duration-700"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-white">{reel.progress}%</span>
                </div>
                <p className="text-sm text-zinc-400">{stageText(reel)}</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-red-400" />
                <p className="text-sm text-zinc-300">{reel.status === "CANCELLED" ? "Cancelled" : reel.error || "This one didn't work."}</p>
                {onRetry && reel.status === "FAILED" && (
                  <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-app-ink">
                    <RotateCcw className="h-4 w-4" /> Try again
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{FORMAT_LABELS[reel.format]}</span>
        {reel.status === "DONE" && reel.videoUrl ? (
          <a href={downloadUrl(reel.videoUrl, fileName(reel))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-app-ink px-3 text-sm font-semibold text-white">
            <Download className="h-4 w-4" /> Download
          </a>
        ) : reel.status === "DONE" ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : null}
      </div>
    </div>
  );
}
