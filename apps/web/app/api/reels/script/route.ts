import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCreator } from "@/lib/clip-access";
import { GOALS, LANGUAGES } from "@/lib/reels/options";
import { writeScript } from "@/lib/reels/script";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];

const body = z.object({
  brandName: z.string().trim().min(1, "Add your business name").max(60),
  handle: z.string().trim().max(40).nullish(),
  about: z.string().trim().max(200).nullish(),
  location: z.string().trim().max(60).nullish(),
  goal: z.enum(values(GOALS)),
  details: z.string().trim().max(300).nullish(),
  language: z.enum(values(LANGUAGES)),
});

export const maxDuration = 60;

// POST — Write the reel's words from what the owner told us
export async function POST(request: NextRequest) {
  const { error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const result = await writeScript(parsed.data);
  return NextResponse.json(result);
}
