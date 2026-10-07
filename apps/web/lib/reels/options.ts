/*
 * What the promo reel wizard offers, in one place for the API and the Create page.
 * Safe to import from client components: no server-only code here.
 */
import type { ReelFormat, ReelLength, ReelMusic } from "@zepply/reels";

export const GOALS = [
  { value: "promote", label: "Promote my business", hint: "Get more people to know you and message you" },
  { value: "offer", label: "Announce an offer", hint: "A discount, a deal or a limited-time price" },
  { value: "product", label: "Show a product", hint: "Put one product or service in the spotlight" },
  { value: "event", label: "Event or launch", hint: "An opening, a launch or something happening soon" },
] as const;
export type ReelGoal = (typeof GOALS)[number]["value"];

/** Where the reel will be posted. Several destinations can share one video size. */
export const DESTINATIONS = [
  { value: "ig-reel", label: "Instagram Reel / Story", format: "vertical", ratio: "9:16" },
  { value: "ig-post", label: "Instagram post", format: "portrait", ratio: "4:5" },
  { value: "youtube", label: "YouTube / Website", format: "wide", ratio: "16:9" },
  { value: "whatsapp", label: "WhatsApp Status", format: "vertical", ratio: "9:16" },
] as const satisfies readonly { value: string; label: string; format: ReelFormat; ratio: string }[];
export type ReelDestination = (typeof DESTINATIONS)[number]["value"];

export const FORMAT_LABELS: Record<ReelFormat, string> = {
  vertical: "Reel / Story (9:16)",
  portrait: "Instagram post (4:5)",
  wide: "YouTube / Website (16:9)",
};

/** The distinct video sizes a set of destinations needs, in a stable order. */
export const formatsFor = (destinations: readonly string[]): ReelFormat[] => {
  const wanted = new Set(DESTINATIONS.filter((d) => destinations.includes(d.value)).map((d) => d.format));
  return (["vertical", "portrait", "wide"] as const).filter((f) => wanted.has(f));
};

export const LENGTH_OPTIONS = [
  { value: "short", label: "15 seconds", hint: "Quick and punchy" },
  { value: "standard", label: "30 seconds", hint: "The full story" },
] as const satisfies readonly { value: ReelLength; label: string; hint: string }[];

export const MUSIC_OPTIONS = [
  { value: "upbeat", label: "Upbeat", hint: "Bright and energetic" },
  { value: "calm", label: "Calm", hint: "Warm and easy" },
  { value: "premium", label: "Premium", hint: "Deep and polished" },
] as const satisfies readonly { value: ReelMusic; label: string; hint: string }[];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
  { value: "hinglish", label: "Hinglish" },
  { value: "tenglish", label: "Tenglish" },
] as const;
export type ReelLanguage = (typeof LANGUAGES)[number]["value"];

/** Brand colours offered before the owner picks their own. */
export const SWATCHES = ["#3D7EFF", "#7C5CFF", "#E0457B", "#FF6B2C", "#F2B320", "#1FA971", "#0EA5B7", "#111827"];

export const MAX_PHOTOS = 6;
export const MAX_IMAGE_BYTES = 10 * 1024 ** 2;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Reels one user may have queued or rendering at once (one Generate can queue up to three sizes). */
export const MAX_ACTIVE_REELS = 6;

export const REEL_BUCKETS = { assets: "brand-assets", renders: "reel-renders" } as const;

export const TEMPLATE_PATH = "/reel-templates/promo-classic/";
