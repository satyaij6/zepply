/*
 * Options the clip engine (workers/clipper) accepts, in one place for the API and the Create page.
 * Safe to import from client components: no server-only code here.
 */

/** Languages the engine can transcribe and caption. Stage A3 adds Hindi, English and code-mixed. */
export const CLIP_LANGUAGES = [{ value: "te", label: "Telugu" }] as const;
export type ClipLanguage = (typeof CLIP_LANGUAGES)[number]["value"];

/** Caption styles: the files in workers/clipper/styles. "Latin" styles show the speech in English letters. */
export const CLIP_STYLES = [
  { value: "kinetic", label: "Kinetic", script: "Latin", note: "Words around the speaker, a pen mark on the key word" },
  { value: "karaoke", label: "Karaoke", script: "Latin", note: "The word being said sits in a white box" },
  { value: "pill", label: "Pill", script: "Latin", note: "One short phrase at a time in a dark pill" },
  { value: "emphasis", label: "Big word", script: "Latin", note: "A small line, then the key word large" },
  { value: "caps", label: "Caps", script: "Latin", note: "Bold uppercase with the key word in yellow" },
  { value: "clean", label: "Clean", script: "Telugu", note: "Plain captions low in frame" },
  { value: "telugu_noto", label: "Noto", script: "Telugu", note: "Telugu in Noto Sans" },
  { value: "roman", label: "Roman", script: "Latin", note: "Romanised captions" },
  { value: "tiktok", label: "Bold", script: "Latin", note: "Heavy short-form captions" },
  { value: "roboto", label: "Sans", script: "Latin", note: "Plain sans captions" },
  { value: "zalando", label: "Wide", script: "Latin", note: "Wide sans captions" },
  { value: "didot", label: "Editorial", script: "Latin", note: "Serif captions" },
  { value: "headline", label: "Headline", script: "Latin", note: "Square video with a title band" },
] as const;
export type ClipStyle = (typeof CLIP_STYLES)[number]["value"];

export const CAPTION_POSITIONS = ["bottom", "center", "top"] as const;

/** How the engine frames a 16:9 source for a vertical clip. */
export const CLIP_LAYOUTS = [
  { value: "auto", label: "Automatic", note: "Follows whoever is talking. Screen recordings are spotted for you." },
  { value: "screen", label: "Screen recording", note: "Your screen on top, your camera below." },
  { value: "single", label: "One person at a time", note: "Never splits the frame between two people." },
] as const;
export type ClipLayout = (typeof CLIP_LAYOUTS)[number]["value"];

/** Post copy for the long video, written by the engine alongside the clips. */
export type SourceKit = {
  titles: string[];
  description: string;
  chapters: { start: number; title: string }[];
};

/** "1:05" or "1:02:05", the way YouTube reads chapter times. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

export const CLIP_COUNT = { min: 1, max: 10, default: 5 } as const;

/** Largest upload accepted. The Supabase project's own upload limit must be at least this. */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;

/** Jobs one user may have queued or running at once. */
export const MAX_ACTIVE_JOBS = 3;

export const BUCKETS = { sources: "clip-sources", renders: "clip-renders" } as const;

export const isYouTubeUrl = (value: string) => {
  try {
    const { hostname, protocol } = new URL(value);
    return protocol === "https:" && /(^|\.)(youtube\.com|youtu\.be)$/.test(hostname);
  } catch {
    return false;
  }
};
