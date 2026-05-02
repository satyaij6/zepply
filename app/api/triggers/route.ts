import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createTriggerSchema = z.object({
  igAccountId: z.string(),
  name: z.string().optional(),
  type: z.enum(["COMMENT", "DM_KEYWORD", "STORY_REPLY", "NEW_FOLLOWER"]),
  keywords: z.array(z.string()).default([]),
  replyMessage: z.string().min(1).max(1000),
  deliverLink: z.string().url().optional().or(z.literal("")),
  followGate: z.boolean().default(false),
  publicReplyOn: z.boolean().default(false),
  publicReplies: z.array(z.string()).default([]),
  postScope: z.enum(["specific", "next", "any"]).optional(),
  selectedPostId: z.string().nullable().optional(),
  openingDmText: z.string().optional(),
  openingDmBtnLabel: z.string().optional(),
  followUpOn: z.boolean().default(false),
  followUpText: z.string().optional(),
  followUpDelayMins: z.number().int().min(0).optional(),
});

// Shared in-memory store for local dev (when DB is unreachable)
export let localTriggers: any[] = [];

// GET — List all triggers
export async function GET(request: NextRequest) {
  const session = await auth();

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  // Try database first
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const triggers = await db.trigger.findMany({
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
  } catch {
    console.warn("⚠️ Triggers GET: DB unreachable, using local store");
  }

  // Fallback: return local triggers
  const filtered = type
    ? localTriggers.filter((t) => t.type === type)
    : localTriggers;

  return NextResponse.json(filtered);
}

// POST — Create a new trigger
export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    const body = await request.json();
    const data = createTriggerSchema.parse(body);

    // Try database first
    try {
      const prismaModule = await import("@/lib/prisma");
      const db = prismaModule.default;

      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Verify the IG account belongs to this user
      const igAccount = await db.instagramAccount.findFirst({
        where: { id: data.igAccountId, userId: session.user.id },
      });

      if (!igAccount) {
        return NextResponse.json(
          { error: "Instagram account not found" },
          { status: 404 }
        );
      }

      const trigger = await db.trigger.create({
        data: {
          igAccountId: data.igAccountId,
          name: data.name || null,
          type: data.type,
          keywords: data.keywords.filter((k) => k.trim() !== ""),
          replyMessage: data.replyMessage,
          deliverLink: data.deliverLink || null,
          followGate: data.followGate,
          publicReplyOn: data.publicReplyOn,
          publicReplies: data.publicReplies,
          postScope: data.postScope || null,
          openingDmText: data.openingDmText || null,
          openingDmBtnLabel: data.openingDmBtnLabel || null,
          followUpOn: data.followUpOn,
          followUpText: data.followUpText || null,
          followUpDelayMins: data.followUpDelayMins ?? null,
        },
      });

      return NextResponse.json(trigger, { status: 201 });
    } catch (dbError) {
      console.warn("⚠️ Triggers POST: DB unreachable, saving locally");
    }

    // Fallback: save to local memory store
    const localTrigger = {
      id: `local_${Date.now()}`,
      igAccountId: data.igAccountId,
      type: data.type,
      keywords: data.keywords.filter((k) => k.trim() !== ""),
      replyMessage: data.replyMessage,
      deliverLink: data.deliverLink || null,
      followGate: data.followGate,
      postScope: data.postScope || "any",
      selectedPostId: data.selectedPostId || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      igAccount: { igUsername: "aytas.io" },
      _count: { leads: 0 },
    };

    // Try to get username from cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("zepply_user");
    if (userCookie) {
      try {
        const userData = JSON.parse(userCookie.value);
        localTrigger.igAccount.igUsername = userData.igUsername || "aytas.io";
      } catch {}
    }

    localTriggers.push(localTrigger);
    console.log("✅ Trigger saved locally:", localTrigger.type, localTrigger.keywords);

    return NextResponse.json(localTrigger, { status: 201 });
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
