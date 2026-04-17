import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateTriggerSchema = z.object({
  type: z.enum(["COMMENT", "DM_KEYWORD", "STORY_REPLY", "NEW_FOLLOWER"]).optional(),
  keywords: z.array(z.string()).optional(),
  replyMessage: z.string().min(1).max(500).optional(),
  deliverLink: z.string().url().optional().or(z.literal("")).or(z.null()),
  followGate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET — Get a single trigger
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const trigger = await prisma.trigger.findFirst({
    where: {
      id,
      igAccount: { userId: session.user.id },
    },
    include: {
      igAccount: { select: { igUsername: true } },
      _count: { select: { leads: true } },
      leads: {
        take: 20,
        orderBy: { capturedAt: "desc" },
      },
    },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  return NextResponse.json(trigger);
}

// PUT — Update a trigger
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateTriggerSchema.parse(body);

    // Verify ownership
    const existing = await prisma.trigger.findFirst({
      where: { id, igAccount: { userId: session.user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    const trigger = await prisma.trigger.update({
      where: { id },
      data: {
        ...data,
        keywords: data.keywords?.filter((k) => k.trim() !== ""),
        deliverLink: data.deliverLink === "" ? null : data.deliverLink,
      },
    });

    return NextResponse.json(trigger);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE — Delete a trigger
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.trigger.findFirst({
    where: { id, igAccount: { userId: session.user.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  await prisma.trigger.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH — Toggle active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.trigger.findFirst({
    where: { id, igAccount: { userId: session.user.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  const trigger = await prisma.trigger.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  return NextResponse.json(trigger);
}
