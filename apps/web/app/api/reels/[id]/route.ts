import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";

const body = z.object({ action: z.enum(["retry", "cancel"]) });

// POST — Retry a failed reel, or cancel one that hasn't finished
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const { id } = await params;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  if (parsed.data.action === "retry") {
    const { count } = await prisma.reelJob.updateMany({
      where: { id, userId, status: { in: ["FAILED", "CANCELLED"] } },
      data: { status: "QUEUED", progress: 0, error: null, attempts: 0, workerId: null, startedAt: null, finishedAt: null },
    });
    if (!count) return NextResponse.json({ error: "Only a reel that failed can be retried" }, { status: 409 });
  } else {
    const { count } = await prisma.reelJob.updateMany({
      where: { id, userId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    if (!count) return NextResponse.json({ error: "That reel has already finished" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
