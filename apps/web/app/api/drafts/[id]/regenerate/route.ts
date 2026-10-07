import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { rewriteDraft } from "@/lib/onboarding/samples";

export const maxDuration = 60;

// POST — Fresh words for one draft (unchanged if Claude isn't available)
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { id } = await params;
  const draft = await prisma.draft.findFirst({ where: { id, userId } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const next = await rewriteDraft(draft);
  return NextResponse.json({ draft: next, changed: next.updatedAt.getTime() !== draft.updatedAt.getTime() });
}
