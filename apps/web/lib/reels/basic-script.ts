/*
 * The plain built-in promo script: the owner's own words dropped into the template.
 * Used for the live preview before the AI script arrives, and when no AI key is set.
 * Safe to import from client components.
 */
import type { ReelGoal, ReelLanguage } from "./options";

export interface ScriptInput {
  brandName: string;
  handle?: string | null;
  about?: string | null;
  location?: string | null;
  goal: ReelGoal;
  /** The offer, product or event, in the owner's words */
  details?: string | null;
  language: ReelLanguage;
}

/** The template's text slots (packages/reels ReelVariables minus brand and media). */
export interface ReelScript {
  hookLine: string;
  comments: string;
  customerName: string;
  question: string;
  reply: string;
  replyChip: string;
  answerHeadline: string;
  galleryTitle: string;
  galleryHeadline: string;
  highlights: string;
  highlightsHeadline: string;
  tagline: string;
  ctaLabel: string;
  ctaSub: string;
}

/** A plain English script from the owner's own words. Used without an API key. */
export function basicScript(input: ScriptInput): ReelScript {
  const name = input.brandName.trim() || "us";
  const where = input.location?.trim();
  const detail = input.details?.trim();
  const reply =
    input.goal === "offer" && detail
      ? `Hi Priya! ${cap(detail)}. Want me to keep one aside for you?`
      : input.goal === "event" && detail
        ? `Hi Priya! ${cap(detail)}. Want me to save you a spot?`
        : `Hi Priya! Thanks for asking. ${detail ? cap(detail) + ". " : ""}Can I share the details with you?`;
  return {
    hookLine: `Everyone is asking about *${name}*.`,
    comments: ["price?", "details please", "open today?", "where are you?", "still available?"].join("\n"),
    customerName: "Priya",
    question: input.goal === "event" ? "When is it happening?" : input.goal === "offer" ? "Is the offer still on?" : "Can I know the price?",
    reply: clip(reply, 170),
    replyChip: "Replied in 2s",
    answerHeadline: "Every question, *answered*.",
    galleryTitle: "Fresh this week",
    galleryHeadline: "Made with *care*.",
    highlights: [
      detail
        ? `${input.goal === "offer" ? "Offer" : input.goal === "event" ? "Coming up" : "New"} | ${clip(firstSentence(detail), 34)}`
        : "Made fresh | Every single day",
      where ? `${clip(where.split(",")[0], 18)} | Come say hello` : "Quick replies | Message us anytime",
      `${clip(name, 18)} | ${input.handle?.trim() || "Find us on Instagram"}`,
    ].join("\n"),
    highlightsHeadline: "The little things, *done right*.",
    tagline: ["Visit.", "Enjoy.", "Return."].join("\n"),
    ctaLabel: input.goal === "event" ? "DM to join" : "DM us today",
    ctaSub: where || input.handle?.trim() || "",
  };
}

/** Shortens on a word boundary, never inside a word or a number. */
export function clip(s: string, max: number) {
  const t = s.trim();
  if ([...t].length <= max) return t;
  let out = "";
  for (const w of t.split(/\s+/)) {
    const next = out ? `${out} ${w}` : w;
    if ([...next].length > max) break;
    out = next;
  }
  return out || [...t].slice(0, max).join("");
}

function firstSentence(s: string) {
  return s.split(/(?<=[.!?])\s+/)[0].replace(/[.!\s]+$/, "");
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[.!\s]+$/, "");
}
