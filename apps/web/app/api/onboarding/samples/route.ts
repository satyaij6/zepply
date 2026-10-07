import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { writeSamples } from "@/lib/onboarding/samples";

export const maxDuration = 120;

// GET — The sample posts written during onboarding, if any
export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const drafts = await prisma.draft.findMany({ where: { userId, source: "onboarding" }, orderBy: { kind: "asc" } });
  return NextResponse.json({ drafts });
}

// POST — Write three sample posts from the brand kit (replacing earlier samples)
export async function POST() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  try {
    const { drafts, source } = await writeSamples(userId);
    return NextResponse.json({ drafts, source });
  } catch (e) {
    console.error("onboarding/samples failed:", e);
    return NextResponse.json({ error: "We couldn't write your sample posts just now. Please try again." }, { status: 500 });
  }
}
