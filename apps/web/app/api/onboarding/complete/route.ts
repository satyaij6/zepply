import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { LAST_STEP } from "@/lib/onboarding/options";

// POST — Finish (or skip) onboarding; sign-in goes to the dashboard from now on
export async function POST() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date(), onboardingStep: LAST_STEP } });
  return NextResponse.json({ ok: true });
}
