import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { brandKitView, type BrandKitView } from "@/lib/brand-kit";
import { FONTS, MAX_COLORS, MAX_TAGS } from "@/lib/onboarding/options";
import { LANGUAGES, MAX_PHOTOS, REEL_BUCKETS } from "@/lib/reels/options";
import { objectExists } from "@/lib/storage";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const tags = z.array(z.string().trim().min(1).max(40)).max(MAX_TAGS);

const body = z.object({
  brandName: z.string().trim().min(1, "Add your business name").max(60),
  handle: optionalText(40),
  about: optionalText(200),
  location: optionalText(60),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  logoPath: z.string().max(300).nullish().transform((v) => v || null),
  photoPaths: z.array(z.string().max(300)).max(MAX_PHOTOS),
  language: z.enum(values(LANGUAGES)),
  // Filled by onboarding; optional so the Create wizard can keep saving just the basics
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(MAX_COLORS).optional(),
  font: z.enum(values(FONTS)).nullish(),
  voice: tags.optional(),
  audience: optionalText(300).optional(),
  offerings: tags.optional(),
  themes: tags.optional(),
});

export type BrandKitResponse = { kit: BrandKitView | null };

// GET — The user's brand kit, with short-lived URLs for the logo and photos
export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  if (!kit) return NextResponse.json({ kit: null } satisfies BrandKitResponse);
  return NextResponse.json({ kit: await brandKitView(kit) } satisfies BrandKitResponse);
}

// PUT — Save the brand kit (created on first save)
export async function PUT(request: NextRequest) {
  const { userId, error } = await requireUserId();
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

  // The accent colour follows the first brand colour when a palette is saved
  const fields = { ...data, ...(data.colors?.length && { accent: data.colors[0] }) };
  const kit = await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  return NextResponse.json({ kit: await brandKitView(kit) } satisfies BrandKitResponse);
}
