/*
 * Builds a brand kit from what we know: the onboarding answers, the connected Instagram account
 * (profile photo, bio, recent posts) and anything the person uploaded. Instagram images are copied
 * into our own storage, because Instagram's image links expire. Claude reads it all and suggests
 * colours, voice, audience, offers and themes; without Claude, sensible defaults come from the answers.
 */
import { z } from "zod";
import prisma from "@/lib/prisma";
import { askForJson, imageBlock, type ContentBlock } from "@/lib/ai";
import { getIGProfileDetails, getIGRecentPosts } from "@/lib/instagram";
import { MAX_PHOTOS, REEL_BUCKETS } from "@/lib/reels/options";
import { downloadObject, uploadObject } from "@/lib/storage";
import { BUSINESS_TYPES, CREATOR_NICHES, FONTS, MAX_COLORS, MAX_TAGS, goalsFor, type Path } from "./options";

const BUCKET = REEL_BUCKETS.assets;
const MAX_IMAGE_BYTES_FOR_AI = 4 * 1024 ** 2;

type Image = { path: string; bytes: Buffer; type: "image/jpeg" | "image/png" | "image/webp" };

const Analysis = z.object({
  brandName: z.string().describe("The brand or creator name as customers know it"),
  about: z.string().describe("One sentence on what the brand is and offers, under 200 characters"),
  audience: z.string().describe("Who the brand is for, one or two sentences"),
  voice: z.array(z.string()).describe("3 to 6 one- or two-word tone words, e.g. Warm, Conversational"),
  offerings: z.array(z.string()).describe("3 to 6 short names of what they sell or offer"),
  themes: z.array(z.string()).describe("4 to 6 short content themes they should post about"),
  colors: z.array(z.string()).describe("Exactly 4 brand colours as #RRGGBB, from the logo and photos, most important first"),
  font: z.enum(FONTS.map((f) => f.value) as [string, ...string[]]).describe("The headline typeface that best fits the brand"),
});
type Analysis = z.infer<typeof Analysis>;

export async function analyzeBrand(userId: string): Promise<{ source: "ai" | "basic" }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      brandKit: true,
      igAccounts: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  const kit = user.brandKit;
  const ig = user.igAccounts[0] ?? null;
  const path = (user.path as Path | null) ?? "business";

  // Keep what the person uploaded; Instagram fills the rest
  const uploadedPhotos = (kit?.photoPaths ?? []).filter((p) => !p.includes("/photo/ig-"));
  let logoPath = kit?.logoPath ?? null;
  const images: Image[] = [];
  let profile: Awaited<ReturnType<typeof getIGProfileDetails>> | null = null;
  let captions: string[] = [];
  const igPhotoPaths: string[] = [];

  if (ig) {
    try {
      const [details, posts] = await Promise.all([
        getIGProfileDetails(ig.igUserId, ig.accessToken),
        getIGRecentPosts(ig.igUserId, ig.accessToken, 12),
      ]);
      profile = details;
      captions = posts.map((p) => p.caption.trim()).filter(Boolean).slice(0, 12);

      if ((!logoPath || logoPath.includes("/logo/instagram")) && details.profile_picture_url) {
        const logo = await importImage(details.profile_picture_url, `${userId}/logo/instagram`);
        if (logo) {
          logoPath = logo.path;
          images.push(logo);
        }
      }
      const room = Math.max(0, MAX_PHOTOS - uploadedPhotos.length);
      for (const post of posts.filter((p) => p.imageUrl).slice(0, room)) {
        const photo = await importImage(post.imageUrl!, `${userId}/photo/ig-${post.id}`);
        if (photo) {
          igPhotoPaths.push(photo.path);
          images.push(photo);
        }
      }
    } catch (error) {
      console.warn("[onboarding] couldn't read Instagram for the brand kit:", error);
    }
  }

  // Uploaded images the person added themselves, for Claude to look at too
  for (const p of [logoPath && !images.some((i) => i.path === logoPath) ? logoPath : null, ...uploadedPhotos]) {
    if (!p) continue;
    const bytes = await downloadObject(BUCKET, p);
    if (bytes) images.push({ path: p, bytes, type: typeFromPath(p) });
  }

  const photoPaths = [...uploadedPhotos, ...igPhotoPaths].slice(0, MAX_PHOTOS);
  const name = kit?.brandName || profile?.name || user.name || ig?.igUsername || "Your brand";
  const facts = {
    path,
    name,
    instagramHandle: ig ? `@${ig.igUsername}` : null,
    instagramBio: profile?.biography ?? null,
    website: profile?.website ?? null,
    location: kit?.location ?? null,
    whatTheyDo: labelOf(path === "business" ? BUSINESS_TYPES : CREATOR_NICHES, user.niche),
    goals: user.goals.map((g) => labelOf(goalsFor(path), g)).filter(Boolean),
    recentCaptions: captions,
  };

  const content: ContentBlock[] = [
    ...images.filter((i) => i.bytes.length <= MAX_IMAGE_BYTES_FOR_AI).slice(0, 8).map((i) => imageBlock(i.bytes, i.type)),
    {
      type: "text",
      text:
        `Here is what we know about a ${path === "business" ? "business" : "creator"} joining Zepply, ` +
        `plus their logo or profile photo and recent post photos (above, if any):\n\n${JSON.stringify(facts, null, 2)}\n\n` +
        "Build their brand kit. Take colours from the logo and photos (not generic defaults), keep every tag short, " +
        "and write for a small Indian business or creator, in English." +
        (path === "creator"
          ? " This is a creator, not a business: the image first is their profile photo, voice is their personal voice, " +
            "and offerings are the topics they make content about (not products)."
          : ""),
    },
  ];

  const ai = await askForJson({
    schema: Analysis,
    system:
      "You are a brand strategist. You look at a brand's own words and images and describe it precisely, " +
      "without inventing products, prices or claims it doesn't make.",
    content,
    effort: "medium",
    label: "brand analysis",
  });
  const result = tidy(ai ?? basicAnalysis(path, user.niche, name, kit?.location ?? null, kit?.colors ?? []), name);

  const data = {
    brandName: result.brandName,
    handle: ig?.igUsername ?? kit?.handle ?? null,
    about: result.about,
    audience: result.audience,
    voice: result.voice,
    offerings: result.offerings,
    themes: result.themes,
    colors: result.colors,
    accent: result.colors[0],
    font: result.font,
    logoPath,
    photoPaths,
    language: user.languages[0] ?? kit?.language ?? "en",
  };
  await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { source: ai ? "ai" : "basic" };
}

/** Copies an image from Instagram into our storage. Returns null if it can't be fetched. */
async function importImage(url: string, pathWithoutExt: string): Promise<Image | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0] as Image["type"];
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const path = `${pathWithoutExt}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`;
    await uploadObject(BUCKET, path, bytes, type);
    return { path, bytes, type };
  } catch (error) {
    console.warn("[onboarding] image import failed:", error);
    return null;
  }
}

const typeFromPath = (p: string): Image["type"] => (p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg");

const labelOf = (list: readonly { value: string; label: string }[], value: string | null) =>
  list.find((o) => o.value === value)?.label ?? null;

/** Trims and caps everything, and makes sure there are four valid colours. */
function tidy(a: Analysis, fallbackName: string): Analysis {
  const tags = (list: string[]) =>
    [...new Set(list.map((t) => t.trim().replace(/^#/, "")).filter((t) => t && t.length <= 40))].slice(0, MAX_TAGS);
  const colors = [...new Set(a.colors.map((c) => c.trim().toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c)))];
  for (const c of DEFAULT_COLORS) if (colors.length < MAX_COLORS && !colors.includes(c)) colors.push(c);
  return {
    brandName: a.brandName.trim().slice(0, 60) || fallbackName,
    about: a.about.trim().slice(0, 200),
    audience: a.audience.trim().slice(0, 300),
    voice: tags(a.voice),
    offerings: tags(a.offerings),
    themes: tags(a.themes),
    colors: colors.slice(0, MAX_COLORS),
    font: FONTS.some((f) => f.value === a.font) ? a.font : FONTS[0].value,
  };
}

const DEFAULT_COLORS = ["#16161A", "#3D7EFF", "#F5F4F0", "#D6E2FF"];

const THEMES: Record<string, string[]> = {
  "cafe-restaurant": ["Signature dishes", "Behind the counter", "Customer stories", "Offers & events"],
  retail: ["New arrivals", "Product spotlights", "Customer favourites", "Offers & sales"],
  clinic: ["Health tips", "Meet the team", "Patient stories", "Services explained"],
  fitness: ["Workout tips", "Member transformations", "Class schedule", "Offers"],
  "real-estate": ["Property tours", "Neighbourhood guides", "Buying tips", "New launches"],
  d2c: ["Product spotlights", "How it's made", "Customer reviews", "Launches & offers"],
  services: ["Before & after", "Tips from the team", "Client stories", "Offers"],
  creator: ["Behind the scenes", "Tips & lessons", "Personal stories", "Q&A with followers"],
};

/** How a creator's niche reads in a sentence, and who it's for */
const CREATOR_WORDS: Record<string, { makes: string; audience: string }> = {
  "personal-brand": { makes: "shares their life, ideas and what they've learned", audience: "People who follow the journey and want the honest take" },
  education: { makes: "teaches what they know in short, useful posts", audience: "People who want to learn something useful, fast" },
  podcast: { makes: "turns long conversations into short, shareable clips", audience: "Listeners who want the best moments without the full episode" },
  coaching: { makes: "helps people grow with practical advice", audience: "People looking for guidance and a push in the right direction" },
  entertainment: { makes: "makes fun, entertaining content", audience: "People who come for a laugh and stay for the vibe" },
};

/** Used when Claude isn't available: honest defaults from the onboarding answers. */
function basicAnalysis(path: Path, niche: string | null, name: string, location: string | null, colors: string[]): Analysis {
  const business = path === "business";
  const what = labelOf(business ? BUSINESS_TYPES : CREATOR_NICHES, niche);
  const creator = CREATOR_WORDS[niche ?? ""] ?? { makes: "creates content their audience loves", audience: "People who enjoy their content and want more of it" };
  return {
    brandName: name,
    about: business ? `${name}${what ? `, ${what.toLowerCase()}` : ""}${location ? ` in ${location}` : ""}.` : `${name} ${creator.makes}.`,
    audience: business ? `People${location ? ` in and around ${location}` : " nearby"} looking for what ${name} offers.` : `${creator.audience}.`,
    voice: ["Warm", "Friendly", "Confident"],
    offerings: [],
    themes: THEMES[business ? niche ?? "" : "creator"] ?? ["Behind the scenes", "Customer stories", "Offers & updates", "Tips"],
    colors,
    font: FONTS[0].value,
  };
}
