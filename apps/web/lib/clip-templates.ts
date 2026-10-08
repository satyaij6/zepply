/*
 * Edit templates and caption styles for Long video to shorts: the single place that says what each
 * template switches on. The API resolves a template into the job's options; the page shows these as
 * the gallery. Specs live in docs/style_guide*.md; the engine side is workers/clipper (styles/*.toml,
 * clipper/kinetic.py, clipper/reel.py, prompts/looks/*.md).
 *
 * Safe to import from client components.
 */
import type { ClipStyle } from "./clip-engine";

export type BrollLook = "editorial" | "explainer" | "signal";

export type EditTemplate = {
  value: string;
  label: string;
  /** One line under the name: who it's for */
  bestFor: string;
  /** Longer description shown on the example panel */
  about: string;
  caption: ClipStyle;
  broll: boolean;
  look: BrollLook;
  card: boolean;
  effects: boolean;
  /** Shows the "Comment for link" fields and creates the comment->DM trigger */
  cta: boolean;
  /** Relative render time, for the estimate in the side rail */
  weight: number;
  badge?: string;
};

export const EDIT_TEMPLATES: readonly EditTemplate[] = [
  {
    value: "kinetic",
    label: "Creator Kinetic",
    bestFor: "Talking-head creators",
    about: "Words appear around the speaker as they're said, with a pen mark on the key word.",
    caption: "kinetic",
    broll: false,
    look: "editorial",
    card: false,
    effects: true,
    cta: false,
    weight: 1.6,
    badge: "New",
  },
  {
    value: "comment",
    label: "Comment for link",
    bestFor: "Offers, tools and giveaways",
    about: "You in a card on your brand colour, headlines on top, and a “Comment WORD” ending. Zepply DMs the link to everyone who comments.",
    caption: "karaoke",
    broll: false,
    look: "editorial",
    card: true,
    effects: false,
    cta: true,
    weight: 1.6,
    badge: "Popular",
  },
  {
    value: "editorial",
    label: "Editorial",
    bestFor: "Podcasts and opinions",
    about: "Dark story visuals that show what's being said, with fine line drawings for objects and ideas.",
    caption: "emphasis",
    broll: true,
    look: "editorial",
    card: false,
    effects: true,
    cta: false,
    weight: 4,
  },
  {
    value: "explainer",
    label: "Clean Explainer",
    bestFor: "Numbers, comparisons, launches",
    about: "Light, data-forward visuals: stats, bar charts and a clear winner for every claim.",
    caption: "pill",
    broll: true,
    look: "explainer",
    card: false,
    effects: false,
    cta: false,
    weight: 4,
  },
  {
    value: "signal",
    label: "Signal Grid",
    bestFor: "How-tos and processes",
    about: "A dark, cinematic grid where every step of a process gets its own colour.",
    caption: "caps",
    broll: true,
    look: "signal",
    card: false,
    effects: false,
    cta: false,
    weight: 4,
  },
  {
    value: "simple",
    label: "Simple",
    bestFor: "Fast and clean",
    about: "Just your clip, framed and captioned. The quickest option.",
    caption: "clean",
    broll: false,
    look: "editorial",
    card: false,
    effects: true,
    cta: false,
    weight: 1,
  },
] as const;

export const DEFAULT_TEMPLATE = "kinetic";
export const templateOf = (value: string | null | undefined) => EDIT_TEMPLATES.find((t) => t.value === value) ?? EDIT_TEMPLATES[0];

/** Caption style groups for the picker's tabs. Values match workers/clipper/styles/<value>.toml. */
export const CAPTION_GROUPS = [
  { value: "creator", label: "Creator", styles: ["kinetic", "karaoke", "pill", "emphasis", "caps"] },
  { value: "classic", label: "Classic", styles: ["clean", "tiktok", "roboto", "zalando", "didot", "headline"] },
  { value: "telugu", label: "Telugu script", styles: ["clean", "telugu_noto"] },
] as const;

/** A minute-ish estimate for the side rail: transcription dominates, templates add render time per clip. */
export function estimateMinutes(template: EditTemplate, clipCount: number, sourceMinutes?: number | null) {
  const base = sourceMinutes ? Math.max(4, sourceMinutes * 0.25) : 10;
  return Math.round(base + clipCount * template.weight * 1.2);
}

export const isKeyword = (v: string) => /^[A-Za-z0-9]{2,16}$/.test(v.trim());
