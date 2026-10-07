import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";

const body = z.object({
  headline: z.string().trim().min(1, "Add a headline").max(48).optional(),
  caption: z.string().trim().min(1, "Add a caption").max(2000).optional(),
  hashtags: z.array(z.string().trim().max(40)).max(8).optional(),
  slides: z.array(z.string().trim().max(32)).max(4).optional(),
});

// PATCH — Edit a draft's words
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const { id } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { hashtags, ...rest } = parsed.data;
  const data = { ...rest, ...(hashtags && { hashtags: hashtags.map((h) => h.replace(/^#+/, "")).filter(Boolean) }) };
  const { count } = await prisma.draft.updateMany({ where: { id, userId }, data });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ draft: await prisma.draft.findUnique({ where: { id } }) });
}
