import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";

const body = z.object({ reason: z.string().trim().min(3, "Say briefly what's wrong with it").max(500) });

// POST — Mark a clip as not good enough, with the reason (kept to improve how clips are picked)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const { id } = await params;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { count } = await prisma.clip.updateMany({
    where: { id, job: { userId } },
    data: { rejected: true, rejectReason: parsed.data.reason },
  });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
