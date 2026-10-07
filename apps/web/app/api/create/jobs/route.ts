import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { CAPTION_POSITIONS, CLIP_COUNT, CLIP_LANGUAGES, CLIP_LAYOUTS, CLIP_STYLES, MAX_ACTIVE_JOBS, isYouTubeUrl } from "@/lib/clip-engine";
import { sourceExists } from "@/lib/clip-storage";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];

const body = z.object({
  title: z.string().trim().max(200).optional(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("UPLOAD"), path: z.string().min(1) }),
    z.object({
      kind: z.literal("YOUTUBE"),
      url: z.string().refine(isYouTubeUrl, "Paste a youtube.com or youtu.be link"),
      ownsContent: z.literal(true, { error: "Confirm you own this video or have permission to use it" }),
    }),
  ]),
  language: z.enum(values(CLIP_LANGUAGES)),
  clipCount: z.number().int().min(CLIP_COUNT.min).max(CLIP_COUNT.max),
  style: z.enum(values(CLIP_STYLES)),
  captionPos: z.enum(CAPTION_POSITIONS),
  layout: z.enum(values(CLIP_LAYOUTS)).default("auto"),
  effects: z.boolean().default(true),
});

// GET — The user's clip jobs, newest first
export async function GET() {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const jobs = await prisma.clipJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, sourceKind: true, status: true, stage: true, progress: true, error: true,
      language: true, clipCount: true, createdAt: true, finishedAt: true, _count: { select: { clips: true } },
    },
  });
  return NextResponse.json({ jobs });
}

// POST — Queue a long video for the clip engine
export async function POST(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { title, source, ...options } = parsed.data;

  if (source.kind === "UPLOAD") {
    // Only files this user uploaded, and only once the upload actually finished
    if (!source.path.startsWith(`${userId}/`) || !(await sourceExists(source.path))) {
      return NextResponse.json({ error: "That upload wasn't found. Try uploading again." }, { status: 400 });
    }
  }

  const active = await prisma.clipJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= MAX_ACTIVE_JOBS) {
    return NextResponse.json({ error: `You can have ${MAX_ACTIVE_JOBS} videos processing at once. Wait for one to finish.` }, { status: 429 });
  }

  const job = await prisma.clipJob.create({
    data: {
      userId,
      title: title || (source.kind === "UPLOAD" ? source.path.split("/").pop() : null),
      sourceKind: source.kind,
      sourcePath: source.kind === "UPLOAD" ? source.path : null,
      sourceUrl: source.kind === "YOUTUBE" ? source.url : null,
      ownsContent: source.kind === "YOUTUBE",
      ...options,
    },
    select: { id: true },
  });
  return NextResponse.json(job, { status: 201 });
}
