/*
 * Writes a promo reel's words from what the owner told us. Claude fills the template's text slots
 * in one structured call; without an API key (or if the call fails) a plain built-in script is used,
 * so the wizard never dead-ends.
 */
import type { ReelGoal, ReelLanguage } from "./options";
import { basicScript, clip, type ReelScript, type ScriptInput } from "./basic-script";

export type { ReelScript, ScriptInput };

const MODEL = process.env.REELS_SCRIPT_MODEL || "claude-sonnet-5-5";

export const LANGUAGE_RULES: Record<ReelLanguage, string> = {
  en: "Write in simple Indian English.",
  hi: "Write in Hindi, in Devanagari script.",
  te: "Write in Telugu, in Telugu script.",
  hinglish: "Write in Hinglish: Hindi and English mixed the way people text, all in English (Latin) letters.",
  tenglish: "Write in Tenglish: Telugu and English mixed the way people text, all in English (Latin) letters.",
};

const GOAL_NOTES: Record<ReelGoal, string> = {
  promote: "Make people want to visit or message the business.",
  offer: "Put the offer front and centre: the reply, a highlight and the hook should all carry it.",
  product: "Put the product in the spotlight: the question and reply are about it.",
  event: "Build excitement for the event: what, when and where should be clear.",
};

// Character limits keep every slot inside the template's layout at every size.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "hookLine", "comments", "customerName", "question", "reply", "replyChip", "answerHeadline",
    "galleryTitle", "galleryHeadline", "highlights", "highlightsHeadline", "tagline", "ctaLabel", "ctaSub",
  ],
  properties: {
    hookLine: { type: "string", description: "Opening line, max 48 characters. Wrap ONE key word or short phrase in *asterisks* for the accent style. Example: Everyone is asking about *Brew House*." },
    comments: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" }, description: "Five short comments customers leave on the business's posts, max 22 characters each, lowercase and casual. Example: price?" },
    customerName: { type: "string", description: "A common Indian first name for the customer in the DM." },
    question: { type: "string", description: "The customer's DM question, max 60 characters." },
    reply: { type: "string", description: "The business's friendly DM reply, max 150 characters, using the customer's name. Answer the question with the facts given; end with a gentle next step. No emoji." },
    replyChip: { type: "string", description: "Tiny badge under the reply, max 22 characters. Example: Replied in 2s" },
    answerHeadline: { type: "string", description: "Headline next to the DM, max 34 characters, one *accent* word or phrase." },
    galleryTitle: { type: "string", description: "Title above the photo grid, max 24 characters. Example: Fresh this week" },
    galleryHeadline: { type: "string", description: "Headline next to the photos, max 34 characters, one *accent* word or phrase." },
    highlights: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false, required: ["value", "label"],
        properties: {
          value: { type: "string", description: "Big text, max 14 characters. Example: 7am – 11pm" },
          label: { type: "string", description: "Small text under it, max 30 characters. Example: Open every day" },
        },
      },
      description: "Three highlights. Use ONLY facts the owner gave (prices, timings, location, offer). If there are fewer than three facts, fill the rest with plain non-claims like 'Made fresh | Every single day'. Never invent ratings, customer counts, awards or years. Never use the | character.",
    },
    highlightsHeadline: { type: "string", description: "Headline next to the highlights, max 34 characters, one *accent* word or phrase." },
    tagline: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" }, description: "Three one-word beats, each ending with a full stop, max 11 characters each. Example: Brew. / Sip. / Repeat." },
    ctaLabel: { type: "string", description: "Button text, max 20 characters. Example: DM us to order" },
    ctaSub: { type: "string", description: "Line under the business name, max 32 characters: the location, or the handle if there is no location." },
  },
} as const;

type RawScript = Omit<ReelScript, "comments" | "highlights" | "tagline"> & {
  comments: string[];
  highlights: { value: string; label: string }[];
  tagline: string[];
};

export async function writeScript(input: ScriptInput): Promise<{ script: ReelScript; source: "ai" | "basic" }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      return { script: await askClaude(input, key), source: "ai" };
    } catch (err) {
      console.error("[reels] script generation failed, using the basic script:", err instanceof Error ? err.message : err);
    }
  }
  return { script: basicScript(input), source: "basic" };
}

async function askClaude(input: ScriptInput, key: string): Promise<ReelScript> {
  const facts = [
    `Business name: ${input.brandName}`,
    input.handle && `Instagram handle: ${input.handle}`,
    input.about && `What they do: ${input.about}`,
    input.location && `Location: ${input.location}`,
    input.details && `This reel is about: ${input.details}`,
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "You write the on-screen words for a short promo reel for a small Indian business that sells on Instagram.",
    "The reel's scenes: customers' comments pile up on a phone (hookLine + comments) → a DM where a customer asks and the business replies (question, reply) → a grid of the business's photos (galleryTitle, galleryHeadline) → three highlights → a three-word tagline → the business name with a button (ctaLabel, ctaSub).",
    "Keep every slot inside its character limit; the words must fit on a phone screen.",
    "Be warm, specific and confident. Plain words, no hype, no hashtags, no emoji.",
    "Honesty: use only facts the owner gave. Never invent prices, ratings, customer counts, awards, years in business or anything else that could be untrue.",
    "Keep the business name exactly as given. Use ₹ for prices.",
    LANGUAGE_RULES[input.language],
    GOAL_NOTES[input.goal],
    "Answer only by calling the reel_script tool.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      // Telugu and Hindi take several times more tokens than English for the same words
      max_tokens: 4000,
      system,
      tools: [{ name: "reel_script", description: "The reel's on-screen words.", input_schema: SCHEMA }],
      // Some models refuse a forced tool_choice; "auto" plus the instruction below is equivalent here
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: facts }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { content?: { type: string; input?: unknown }[]; stop_reason?: string };
  const raw = body.content?.find((c) => c.type === "tool_use")?.input as RawScript | undefined;
  if (!raw) throw new Error(`no structured script in the response (stop: ${body.stop_reason})`);
  if (body.stop_reason === "max_tokens") console.warn("[reels] script hit max_tokens; missing slots use the basic script");
  return normalise(raw, input);
}

function normalise(raw: RawScript, input: ScriptInput): ReelScript {
  const basic = basicScript(input);
  const s = (v: unknown, fallback: string, max: number) => {
    const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    return t ? clip(t, max) : fallback;
  };
  // Arrays sometimes arrive JSON-encoded or as one newline-separated string
  const asArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string") return [];
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return v.split(/\n|\s+\/\s+/);
  };
  const list = (v: unknown, n: number) =>
    asArray(v)
      .filter((x): x is string => typeof x === "string" && !!x.trim())
      .slice(0, n);
  const comments = list(raw.comments, 5).map((c) => clip(c, 26));
  const tagline = list(raw.tagline, 3).map((w) => clip(w, 14));
  const highlights = asArray(raw.highlights)
    .map((h) => {
      if (typeof h === "string") {
        const [value = "", ...label] = h.split("|");
        return { value, label: label.join("|") };
      }
      return h as { value?: unknown; label?: unknown };
    })
    .filter((h) => h && typeof h.value === "string" && h.value.trim())
    .slice(0, 3)
    .map((h) => `${clip(String(h.value), 18)} | ${clip(typeof h.label === "string" ? h.label : "", 34)}`);
  return {
    hookLine: s(raw.hookLine, basic.hookLine, 60),
    comments: comments.length === 5 ? comments.join("\n") : basic.comments,
    customerName: s(raw.customerName, basic.customerName, 20),
    question: s(raw.question, basic.question, 70),
    reply: s(raw.reply, basic.reply, 170),
    replyChip: s(raw.replyChip, basic.replyChip, 26),
    answerHeadline: s(raw.answerHeadline, basic.answerHeadline, 44),
    galleryTitle: s(raw.galleryTitle, basic.galleryTitle, 28),
    galleryHeadline: s(raw.galleryHeadline, basic.galleryHeadline, 44),
    highlights: highlights.length === 3 ? highlights.join("\n") : basic.highlights,
    highlightsHeadline: s(raw.highlightsHeadline, basic.highlightsHeadline, 44),
    tagline: tagline.length === 3 ? tagline.join("\n") : basic.tagline,
    ctaLabel: s(raw.ctaLabel, basic.ctaLabel, 24),
    ctaSub: s(raw.ctaSub, basic.ctaSub, 40),
  };
}
