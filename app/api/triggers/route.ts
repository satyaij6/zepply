import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createTriggerSchema = z.object({
  igAccountId: z.string(),
  type: z.enum(["COMMENT", "DM_KEYWORD", "STORY_REPLY", "NEW_FOLLOWER"]),
  keywords: z.array(z.string()).default([]),
  replyMessage: z.string().min(1).max(500),
  deliverLink: z.string().url().optional().or(z.literal("")),
  followGate: z.boolean().default(false),
});

// GET — List all triggers for the authenticated user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  const triggers = await prisma.trigger.findMany({
    where: {
      igAccount: { userId: session.user.id },
      ...(type ? { type: type as any } : {}),
    },
    include: {
      igAccount: { select: { igUsername: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(triggers);
}

// POST — Create a new trigger
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createTriggerSchema.parse(body);

    // Verify the IG account belongs to this user
    const igAccount = await prisma.instagramAccount.findFirst({
      where: { id: data.igAccountId, userId: session.user.id },
    });

    if (!igAccount) {
      return NextResponse.json(
        { error: "Instagram account not found" },
        { status: 404 }
      );
    }

    const trigger = await prisma.trigger.create({
      data: {
        igAccountId: data.igAccountId,
        type: data.type,
        keywords: data.keywords.filter((k) => k.trim() !== ""),
        replyMessage: data.replyMessage,
        deliverLink: data.deliverLink || null,
        followGate: data.followGate,
      },
    });

    return NextResponse.json(trigger, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Create trigger error:", error);
    return NextResponse.json(
      { error: "Failed to create trigger" },
      { status: 500 }
    );
  }
}
