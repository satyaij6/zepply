import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { MAX_ACTIVE_REELS, MAX_PHOTOS, REEL_BUCKETS } from "@/lib/reels/options";
import { signedUrls } from "@/lib/storage";

const text = (max: number) => z.string().max(max).default("");

const variables = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brandName: z.string().trim().min(1, "Add your business name").max(60),
  handle: text(40),
  logo: text(300),
  hookLine: text(80),
  comments: text(200),
  customerName: text(30),
  question: text(100),
  reply: text(260),
  replyChip: text(40),
  answerHeadline: text(70),
  galleryTitle: text(40),
  galleryHeadline: text(70),
  photos: text(MAX_PHOTOS * 310),
  highlights: text(300),
  highlightsHeadline: text(70),
  tagline: text(60),
  ctaLabel: text(40),
  ctaSub: text(60),
});

const body = z.object({
  formats: z.array(z.enum(["vertical", "portrait", "wide"])).min(1, "Pick where you'll post it").max(3),
  length: z.enum(["standard", "short"]),
  music: z.enum(["upbeat", "calm", "premium"]),
  variables,
});

const SELECT = {
  id: true, groupId: true, format: true, length: true, music: true, status: true, progress: true,
  error: true, outputPath: true, createdAt: true, finishedAt: true, variables: true,
} as const;

// GET — The user's reels, newest first (?group= for one Generate's batch)
export async function GET(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const group = request.nextUrl.searchParams.get("group");

  const jobs = await prisma.reelJob.findMany({
    where: { userId, ...(group ? { groupId: group } : {}) },
    orderBy: { createdAt: "desc" },
    take: group ? 3 : 30,
    select: SELECT,
  });
  const urls = await signedUrls(REEL_BUCKETS.renders, jobs.map((j) => j.outputPath)).catch(() => new Map<string, string>());
  return NextResponse.json({
    reels: jobs.map(({ outputPath, variables, ...j }) => ({
      ...j,
      brandName: (variables as { brandName?: string })?.brandName ?? "",
      videoUrl: outputPath ? urls.get(outputPath) ?? null : null,
    })),
  });
}

// POST — Queue one render per chosen video size
export async function POST(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { formats, length, music, variables: vars } = parsed.data;

  // Media are this user's brand-asset paths; the worker signs them at render time
  const media = [vars.logo, ...vars.photos.split("\n")].map((p) => p.trim()).filter(Boolean);
  if (media.some((p) => !p.startsWith(`${userId}/`))) {
    return NextResponse.json({ error: "An image doesn't belong to you" }, { status: 400 });
  }

  const active = await prisma.reelJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active + formats.length > MAX_ACTIVE_REELS) {
    return NextResponse.json({ error: "You have reels still being made. Wait for them to finish, then try again." }, { status: 429 });
  }

  const groupId = randomUUID();
  const unique = [...new Set(formats)];
  await prisma.reelJob.createMany({
    data: unique.map((format) => ({ userId, groupId, format, length, music, variables: vars })),
  });
  return NextResponse.json({ groupId }, { status: 201 });
}
