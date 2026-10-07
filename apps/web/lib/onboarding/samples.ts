/*
 * The three sample posts at the end of onboarding: a single image post, a four-slide carousel and a
 * Reel cover, all from the person's own photos and brand kit. Claude writes the words in their
 * language; without Claude, plain built-in words are used so the step never dead-ends.
 */
import type { BrandKit, Draft, DraftKind } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { askForJson } from "@/lib/ai";
import { LANGUAGE_RULES } from "@/lib/reels/script";
import type { ReelLanguage } from "@/lib/reels/options";
import { goalsFor, type Path } from "./options";

const KINDS: DraftKind[] = ["POST", "CAROUSEL", "REEL"];
export const SLIDES = 4;

const Words = z.object({
  headline: z.string().describe("On-image text, at most 32 characters"),
  caption: z.string().describe("2 to 4 short lines, ending with one clear call to action"),
  hashtags: z.array(z.string()).describe("4 to 6 relevant hashtags without the # sign"),
});
const CarouselWords = Words.extend({
  slides: z.array(z.string()).describe(`Exactly ${SLIDES} slide labels after the cover, each at most 24 characters`),
});
const AllWords = z.object({ post: Words, carousel: CarouselWords, reel: Words });
type CarouselWords = z.infer<typeof CarouselWords>;

const BRIEF: Record<DraftKind, string> = {
  POST: "post: a single Instagram image post that introduces the brand; the headline sits on the photo",
  CAROUSEL: `carousel: a ${SLIDES + 1}-slide carousel; the headline is the cover, then one short label per photo slide`,
  REEL: "reel: the cover of a short Reel; the headline is the hook that makes people stop scrolling",
};

/** Writes (or rewrites) the onboarding samples, replacing earlier ones. */
export async function writeSamples(userId: string): Promise<{ drafts: Draft[]; source: "ai" | "basic" }> {
  const { kit, user } = await load(userId);
  const ai = await askForJson({
    schema: AllWords,
    system: systemPrompt(kit),
    content: [{ type: "text", text: `${facts(kit, user)}\n\nWrite these three:\n- ${KINDS.map((k) => BRIEF[k]).join("\n- ")}` }],
    effort: "medium",
    label: "sample posts",
  });
  const words = ai ?? basicWords(kit);
  const photos = photosFor(kit);

  const drafts = await prisma.$transaction(async (tx) => {
    // One writer per user at a time, so two quick requests can't leave two sets of samples
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await tx.draft.deleteMany({ where: { userId, source: "onboarding" } });
    return Promise.all(
      KINDS.map((kind) => {
        const w = kind === "POST" ? words.post : kind === "CAROUSEL" ? words.carousel : words.reel;
        return tx.draft.create({
          data: {
            userId,
            kind,
            ...tidy(w),
            slides: kind === "CAROUSEL" ? tidySlides((w as CarouselWords).slides) : [],
            photoPaths: photos[kind],
            language: kit.language,
            source: "onboarding",
          },
        });
      }),
    );
  });
  return { drafts, source: ai ? "ai" : "basic" };
}

/** New words for one draft, different from what it says now. */
export async function rewriteDraft(draft: Draft): Promise<Draft> {
  const { kit, user } = await load(draft.userId);
  const schema = draft.kind === "CAROUSEL" ? CarouselWords : Words;
  const ai = await askForJson({
    schema,
    system: systemPrompt(kit),
    content: [
      {
        type: "text",
        text:
          `${facts(kit, user)}\n\nWrite a fresh ${BRIEF[draft.kind]}. Take a different angle from the current version:\n` +
          JSON.stringify({ headline: draft.headline, caption: draft.caption, slides: draft.slides }),
      },
    ],
    effort: "low",
    label: "rewrite draft",
  });
  if (!ai) return draft;
  return prisma.draft.update({
    where: { id: draft.id },
    data: { ...tidy(ai), ...(draft.kind === "CAROUSEL" ? { slides: tidySlides((ai as CarouselWords).slides) } : {}) },
  });
}

async function load(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { path: true, goals: true, name: true } });
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  if (!kit) throw new Error("Set up the brand kit first");
  return { kit, user };
}

function systemPrompt(kit: BrandKit) {
  const rule = LANGUAGE_RULES[kit.language as ReelLanguage] ?? LANGUAGE_RULES.en;
  return (
    "You write Instagram posts for small Indian businesses and creators, in their own voice. " +
    `${rule} Hashtags may stay in English. Use at most two emoji per caption. ` +
    "Never invent prices, discounts, dates or claims the brand hasn't made."
  );
}

function facts(kit: BrandKit, user: { path: string | null; goals: string[] }) {
  const goals = user.goals.map((g) => goalsFor(user.path as Path).find((o) => o.value === g)?.label).filter(Boolean);
  return `The brand:\n${JSON.stringify(
    {
      name: kit.brandName,
      handle: kit.handle ? `@${kit.handle}` : null,
      about: kit.about,
      location: kit.location,
      audience: kit.audience,
      voice: kit.voice,
      offers: kit.offerings,
      themes: kit.themes,
      goals,
    },
    null,
    2,
  )}`;
}

/** Which of the brand's photos each sample uses. Fewer photos just repeat; none means a colour background. */
function photosFor(kit: BrandKit): Record<DraftKind, string[]> {
  const p = kit.photoPaths;
  const pick = (i: number) => (p.length ? p[i % p.length] : null);
  const list = (...idx: number[]) => idx.map(pick).filter((x): x is string => !!x);
  return { POST: list(0), CAROUSEL: list(1, 2, 3, 4), REEL: list(5) };
}

function tidy(w: z.infer<typeof Words>) {
  return {
    headline: w.headline.trim().slice(0, 48),
    caption: w.caption.trim().slice(0, 2000),
    hashtags: [...new Set(w.hashtags.map((h) => h.trim().replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean))].slice(0, 8),
  };
}

const tidySlides = (slides: string[]) => slides.map((s) => s.trim().slice(0, 32)).filter(Boolean).slice(0, SLIDES);

/** Plain English words for when Claude isn't available. */
function basicWords(kit: BrandKit): z.infer<typeof AllWords> {
  const name = kit.brandName;
  const tags = [name.replace(/[^A-Za-z0-9]/g, ""), kit.location?.replace(/[^A-Za-z0-9]/g, ""), ...kit.offerings.map((o) => o.replace(/[^A-Za-z0-9]/g, ""))]
    .filter((t): t is string => !!t)
    .slice(0, 5);
  const about = kit.about || `Say hello to ${name}.`;
  return {
    post: { headline: `Welcome to ${name}`.slice(0, 32), caption: `${about}\n\nFollow along for more 👋`, hashtags: tags },
    carousel: {
      headline: "Here's what we do",
      slides: (kit.offerings.length ? kit.offerings : kit.themes).slice(0, SLIDES),
      caption: `A quick look at what you'll find at ${name}.\n\nSwipe through to see more →`,
      hashtags: tags,
    },
    reel: { headline: "It starts here", caption: `Come and see what ${name} is about.\n\nTell us what you'd like to see next in the comments.`, hashtags: tags },
  };
}
