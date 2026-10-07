import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { LANGUAGES, MAX_PHOTOS, REEL_BUCKETS } from "@/lib/reels/options";
import { objectExists, signedUrls } from "@/lib/storage";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

const body = z.object({
  brandName: z.string().trim().min(1, "Add your business name").max(60),
  handle: optionalText(40),
  about: optionalText(200),
  location: optionalText(60),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  logoPath: z.string().max(300).nullish().transform((v) => v || null),
  photoPaths: z.array(z.string().max(300)).max(MAX_PHOTOS),
  language: z.enum(values(LANGUAGES)),
});

export type BrandKitResponse = {
  kit: (z.infer<typeof body> & { logoUrl: string | null; photos: { path: string; url: string }[] }) | null;
};

// GET — The user's brand kit, with short-lived URLs for the logo and photos
export async function GET() {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  if (!kit) return NextResponse.json({ kit: null } satisfies BrandKitResponse);
  return NextResponse.json({ kit: await withUrls(kit) } satisfies BrandKitResponse);
}

// PUT — Save the brand kit (created on first save)
export async function PUT(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data = parsed.data;

  // Only this user's uploads, and only ones that finished uploading
  const existing = await prisma.brandKit.findUnique({ where: { userId }, select: { logoPath: true, photoPaths: true } });
  const known = new Set([existing?.logoPath, ...(existing?.photoPaths ?? [])]);
  for (const path of [data.logoPath, ...data.photoPaths]) {
    if (!path) continue;
    if (!path.startsWith(`${userId}/`)) return NextResponse.json({ error: "That image doesn't belong to you" }, { status: 400 });
    if (!known.has(path) && !(await objectExists(REEL_BUCKETS.assets, path))) {
      return NextResponse.json({ error: "An image didn't finish uploading. Try adding it again." }, { status: 400 });
    }
  }

  const kit = await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return NextResponse.json({ kit: await withUrls(kit) } satisfies BrandKitResponse);
}

async function withUrls(kit: {
  brandName: string; handle: string | null; about: string | null; location: string | null; accent: string;
  logoPath: string | null; photoPaths: string[]; language: string;
}) {
  const urls = await signedUrls(REEL_BUCKETS.assets, [kit.logoPath, ...kit.photoPaths], 6 * 3600).catch(() => new Map<string, string>());
  return {
    brandName: kit.brandName,
    handle: kit.handle,
    about: kit.about,
    location: kit.location,
    accent: kit.accent,
    logoPath: kit.logoPath,
    photoPaths: kit.photoPaths,
    language: kit.language as z.infer<typeof body>["language"],
    logoUrl: kit.logoPath ? urls.get(kit.logoPath) ?? null : null,
    photos: kit.photoPaths.flatMap((path) => (urls.get(path) ? [{ path, url: urls.get(path)! }] : [])),
  };
}
