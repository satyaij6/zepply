import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { signedRenderUrls } from "@/lib/clip-storage";

// GET — One job with its clips; clip files come back as signed URLs valid for an hour
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const { id } = await params;

  // Only what the page shows: no storage paths or worker bookkeeping
  const job = await prisma.clipJob.findFirst({
    where: { id, userId },
    select: {
      id: true, title: true, sourceKind: true, sourceUrl: true, language: true, clipCount: true, style: true,
      captionPos: true, layout: true, effects: true, broll: true, sourceKit: true,
      status: true, stage: true, progress: true, error: true, sourceSeconds: true,
      createdAt: true, startedAt: true, finishedAt: true,
      clips: { orderBy: { rank: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const urls = await signedRenderUrls(job.clips.flatMap((c) => [c.videoPath, c.thumbPath, c.captionsPath, c.coverPath])).catch((e) => {
    console.error("create/jobs/[id]: could not sign clip URLs", e);
    return new Map<string, string>();
  });

  return NextResponse.json({
    ...job,
    clips: job.clips.map(({ videoPath, thumbPath, captionsPath, coverPath, ...clip }) => {
      const video = urls.get(videoPath) ?? null;
      const cover = (coverPath && urls.get(coverPath)) ?? null;
      return {
        ...clip,
        videoUrl: video,
        // Same file, but the browser saves it instead of playing it
        downloadUrl: video && `${video}&download=${encodeURIComponent(`${slug(clip.title) || "clip"}-${clip.rank}.mp4`)}`,
        thumbUrl: (thumbPath && urls.get(thumbPath)) ?? null,
        captionsUrl: (captionsPath && urls.get(captionsPath)) ?? null,
        coverUrl: cover,
        coverDownloadUrl: cover && `${cover}&download=${encodeURIComponent(`${slug(clip.title) || "clip"}-${clip.rank}-cover.jpg`)}`,
      };
    }),
  });
}

const slug = (s: string) => s.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);

const action = z.object({ action: z.enum(["retry", "cancel"]) });

// POST — Retry a job that failed, or cancel one that hasn't finished (the worker stops within seconds)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const { id } = await params;

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  if (parsed.data.action === "retry") {
    const { count } = await prisma.clipJob.updateMany({
      where: { id, userId, status: { in: ["FAILED", "CANCELLED"] } },
      data: { status: "QUEUED", stage: null, progress: 0, error: null, attempts: 0, workerId: null, startedAt: null, finishedAt: null },
    });
    if (!count) return NextResponse.json({ error: "Only a video that failed can be retried" }, { status: 409 });
  } else {
    const { count } = await prisma.clipJob.updateMany({
      where: { id, userId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    if (!count) return NextResponse.json({ error: "That video has already finished" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
