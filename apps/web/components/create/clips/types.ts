import type { SourceKit } from "@/lib/clip-engine";

export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";

/** A row in "Your videos" (GET /api/create/jobs). */
export type JobRow = {
  id: string;
  title: string | null;
  sourceKind: "UPLOAD" | "YOUTUBE";
  status: JobStatus;
  stage: string | null;
  progress: number;
  error: string | null;
  clipCount: number;
  /** Edit template value (lib/clip-templates.ts) */
  template: string;
  createdAt: string;
  finishedAt: string | null;
  _count: { clips: number };
};

export type ClipRow = {
  id: string;
  rank: number;
  title: string;
  theme: string | null;
  reason: string | null;
  format: string | null;
  finalScore: number | null;
  durationSec: number | null;
  titles: string[];
  caption: string | null;
  hashtags: string[];
  rejected: boolean;
  videoUrl: string | null;
  downloadUrl: string | null;
  thumbUrl: string | null;
  captionsUrl: string | null;
  coverUrl: string | null;
  coverDownloadUrl: string | null;
  /** Restyled takes of this clip */
  versions: { id: string; template: string; style: string; videoUrl: string | null; downloadUrl: string | null; coverUrl: string | null }[];
};

/** One job with its clips (GET /api/create/jobs/[id]). */
export type JobDetail = Omit<JobRow, "_count"> & {
  sourceUrl: string | null;
  style: string;
  layout: string;
  effects: boolean;
  broll: boolean;
  sourceSeconds: number | null;
  sourceKit: SourceKit | null;
  startedAt: string | null;
  ctaKeyword: string | null;
  triggerId: string | null;
  canRestyle: boolean;
  restyling: { id: string; rank: number | null; template: string; progress: number; status: JobStatus }[];
  clips: ClipRow[];
};

export const active = (status: JobStatus) => status === "QUEUED" || status === "RUNNING";

const STAGES: Record<string, string> = {
  preparing: "Getting your video ready…",
  transcribing: "Listening to every word…",
  finding_moments: "Finding the moments worth sharing…",
  rendering: "Cutting, framing and captioning…",
  uploading: "Almost ready…",
};

export const stageText = (job: Pick<JobRow, "status" | "stage">) =>
  job.status === "QUEUED" ? "Waiting for a free spot…" : STAGES[job.stage ?? ""] ?? "Working on it…";

export const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
