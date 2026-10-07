import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { brandKitView } from "@/lib/brand-kit";
import { analyzeBrand } from "@/lib/onboarding/brand";

// Reading Instagram, copying photos and asking Claude can take a while
export const maxDuration = 120;

// POST — Build the brand kit from Instagram, uploads and the onboarding answers
export async function POST() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  try {
    const { source } = await analyzeBrand(userId);
    const kit = await prisma.brandKit.findUniqueOrThrow({ where: { userId } });
    return NextResponse.json({ kit: await brandKitView(kit), source });
  } catch (e) {
    console.error("onboarding/analyze failed:", e);
    return NextResponse.json({ error: "We couldn't build your brand kit just now. Please try again." }, { status: 500 });
  }
}
