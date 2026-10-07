export type ReelFormat = "vertical" | "portrait" | "wide";
export type ReelLength = "standard" | "short";
export type ReelMusic = "upbeat" | "calm" | "premium";

/** Content slots of the promo-classic template. Multi-item fields are one item per line. */
export interface ReelVariables {
  accent: string;
  brandName: string;
  handle: string;
  logo: string;
  hookLine: string;
  comments: string;
  customerName: string;
  question: string;
  reply: string;
  replyChip: string;
  answerHeadline: string;
  galleryTitle: string;
  galleryHeadline: string;
  photos: string;
  /** "value | label" per line */
  highlights: string;
  highlightsHeadline: string;
  /** three words, one per line */
  tagline: string;
  ctaLabel: string;
  ctaSub: string;
}

export interface BuildOptions {
  format: ReelFormat;
  length: ReelLength;
  music: ReelMusic;
  /** false renders without music or sound effects */
  sound?: boolean;
  variables?: Partial<ReelVariables>;
  /** inline `window.__hfVariables` (preview); the worker passes --variables-file instead */
  inlineVariables?: boolean;
  /** `<base href>` so relative fonts/audio resolve when the HTML is loaded as srcdoc */
  baseHref?: string;
}

export declare function buildReelHtml(html: string, opts: BuildOptions): string;
export declare const FORMATS: Record<ReelFormat, { width: number; height: number }>;
export declare const MUSIC: ReelMusic[];
export declare const VARIABLE_KEYS: (keyof ReelVariables)[];
export declare const BEAT: number;
export declare const LENGTHS: Record<
  ReelLength,
  { duration: number; scenes: { id: string; start: number; end: number }[] }
>;
export declare const SFX: Record<string, { file: string; at: number | ((len: number) => number); volume: number }[]>;
