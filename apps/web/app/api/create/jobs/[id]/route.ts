import { NextRequest, NextResponse } from "next/server";
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
      captionPos: true, status: true, stage: true, progress: true, error: true, sourceSeconds: true,
      createdAt: true, startedAt: true, finishedAt: true,
      clips: { orderBy: { rank: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const urls = await signedRenderUrls(job.clips.flatMap((c) => [c.videoPath, c.thumbPath, c.captionsPath])).catch((e) => {
    console.error("create/jobs/[id]: could not sign clip URLs", e);
    return new Map<string, string>();
  });

  return NextResponse.json({
    ...job,
    clips: job.clips.map(({ videoPath, thumbPath, captionsPath, ...clip }) => {
      const video = urls.get(videoPath) ?? null;
      return {
        ...clip,
        videoUrl: video,
        // Same file, but the browser saves it instead of playing it
        downloadUrl: video && `${video}&download=${encodeURIComponent(`${slug(clip.title) || "clip"}-${clip.rank}.mp4`)}`,
        thumbUrl: (thumbPath && urls.get(thumbPath)) ?? null,
        captionsUrl: (captionsPath && urls.get(captionsPath)) ?? null,
      };
    }),
  });
}

const slug = (s: string) => s.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
