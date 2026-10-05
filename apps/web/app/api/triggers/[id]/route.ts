import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateTriggerSchema = z.object({
  type: z.enum(["COMMENT", "DM_KEYWORD", "STORY_REPLY", "NEW_FOLLOWER"]).optional(),
  keywords: z.array(z.string()).optional(),
  replyMessage: z.string().min(1).max(500).optional(),
  deliverLink: z.string().url().optional().or(z.literal("")).or(z.null()),
  followGate: z.boolean().optional(),
  isActive: z.boolean().optional(),
  igAccountId: z.string().optional(),
  postScope: z.enum(["specific", "next", "any"]).optional(),
  selectedPostId: z.string().nullable().optional(),
});

// Reference to the shared local triggers store from the parent route
// We dynamically import it to share the same array reference
async function getLocalTriggers(): Promise<any[]> {
  try {
    // Access module-level localTriggers from the triggers route
    const mod = await import("../route");
    return (mod as any).localTriggers || [];
  } catch {
    return [];
  }
}

// GET — Get a single trigger
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  // Try database
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trigger = await db.trigger.findFirst({
      where: { id, igAccount: { userId: session.user.id } },
      include: {
        igAccount: { select: { igUsername: true } },
        _count: { select: { leads: true } },
        leads: { take: 20, orderBy: { capturedAt: "desc" } },
      },
    });

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    return NextResponse.json(trigger);
  } catch {
    console.warn("⚠️ Trigger GET: DB unreachable, checking local store");
  }

  // Fallback: local triggers
  const localTriggers = await getLocalTriggers();
  const trigger = localTriggers.find((t) => t.id === id);
  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }
  return NextResponse.json({ ...trigger, leads: [] });
}

// PUT — Update a trigger
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateTriggerSchema.parse(body);

    // Try database
    try {
      const prismaModule = await import("@/lib/prisma");
      const db = prismaModule.default;

      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const existing = await db.trigger.findFirst({
        where: { id, igAccount: { userId: session.user.id } },
      });

      if (!existing) {
        return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
      }

      const trigger = await db.trigger.update({
        where: { id },
        data: {
          ...data,
          keywords: data.keywords?.filter((k) => k.trim() !== ""),
          deliverLink: data.deliverLink === "" ? null : data.deliverLink,
        },
      });

      return NextResponse.json(trigger);
    } catch {
      console.warn("⚠️ Trigger PUT: DB unreachable, updating locally");
    }

    // Fallback: update local trigger
    const localTriggers = await getLocalTriggers();
    const idx = localTriggers.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    const updated = {
      ...localTriggers[idx],
      ...data,
      keywords: data.keywords?.filter((k) => k.trim() !== "") || localTriggers[idx].keywords,
      deliverLink: data.deliverLink === "" ? null : (data.deliverLink ?? localTriggers[idx].deliverLink),
      updatedAt: new Date().toISOString(),
    };
    localTriggers[idx] = updated;
    console.log("✅ Trigger updated locally:", updated.id);

    return NextResponse.json(updated);
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
  const { id } = await params;

  // Try database
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.trigger.findFirst({
      where: { id, igAccount: { userId: session.user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    await db.trigger.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    console.warn("⚠️ Trigger DELETE: DB unreachable, deleting locally");
  }

  // Fallback: delete from local store
  const localTriggers = await getLocalTriggers();
  const idx = localTriggers.findIndex((t) => t.id === id);
  if (idx !== -1) {
    localTriggers.splice(idx, 1);
  }
  return NextResponse.json({ success: true });
}

// PATCH — Toggle active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  // Try database
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.trigger.findFirst({
      where: { id, igAccount: { userId: session.user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    const trigger = await db.trigger.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return NextResponse.json(trigger);
  } catch {
    console.warn("⚠️ Trigger PATCH: DB unreachable, toggling locally");
  }

  // Fallback: toggle locally
  const localTriggers = await getLocalTriggers();
  const idx = localTriggers.findIndex((t) => t.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  localTriggers[idx].isActive = !localTriggers[idx].isActive;
  return NextResponse.json(localTriggers[idx]);
}
