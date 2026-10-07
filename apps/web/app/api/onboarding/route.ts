import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { onboardingState } from "@/lib/onboarding/state";
import { BUSINESS_GOALS, BUSINESS_TYPES, CREATOR_GOALS, CREATOR_NICHES, LANGUAGES, LAST_STEP, PATHS } from "@/lib/onboarding/options";

const values = (...lists: (readonly { value: string }[])[]) => lists.flat().map((o) => o.value) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max);

const body = z.object({
  step: z.number().int().min(1).max(LAST_STEP).optional(),
  path: z.enum(values(PATHS)).optional(),
  languages: z.array(z.enum(values(LANGUAGES))).min(1, "Pick at least one language").max(LANGUAGES.length).optional(),
  name: text(60).min(1, "Add your name").optional(),
  niche: z.enum(values(CREATOR_NICHES, BUSINESS_TYPES)).optional(),
  goals: z.array(z.enum(values(CREATOR_GOALS, BUSINESS_GOALS))).max(6).optional(),
  brandName: text(60).optional(),
  location: text(60).optional(),
});

// GET — Where the person is in onboarding and what they've answered
export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;
  return NextResponse.json(await onboardingState(userId));
}

// PUT — Save answers as they go (each step saves before moving on)
export async function PUT(request: NextRequest) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { step, path, languages, name, niche, goals, brandName, location } = parsed.data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(path && { path }),
      ...(languages && { languages }),
      ...(name && { name }),
      ...(niche && { niche }),
      ...(goals && { goals }),
      ...(step && { onboardingStep: step }),
    },
    select: { name: true, path: true, languages: true },
  });

  // The brand kit exists from step 2 on: named after the business, or after the creator themselves
  if (brandName !== undefined || location !== undefined || name) {
    const kitName = (user.path === "business" ? brandName : name) || brandName || user.name || "My brand";
    const fields = {
      brandName: kitName,
      ...(location !== undefined && { location: location || null }),
      ...(user.languages[0] && { language: user.languages[0] }),
    };
    await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  }
  return NextResponse.json(await onboardingState(userId));
}
