import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  // Locally-stranded triggers (saved when a prior POST couldn't reach the DB).
  // We always surface these so the user can see what was created in this lambda,
  // even if a later GET reaches a healthy DB that doesn't have them.
  const localFiltered = type
    ? localTriggers.filter((t) => t.type === type)
    : localTriggers;

  // Try database
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

    // Avoid duplicates if a local trigger was later persisted to the DB.
    const dbIds = new Set(triggers.map((t: any) => t.id));
    const merged = [...triggers, ...localFiltered.filter((t) => !dbIds.has(t.id))];
    return NextResponse.json(merged);
  } catch {
    console.warn("⚠️ Triggers GET: DB unreachable, using local store");
  }

  return NextResponse.json(localFiltered);
}

// POST — Create a new trigger
export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    const body = await request.json();
    const data = createTriggerSchema.parse(body);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    // Verify the IG account belongs to this user. If the client passed
    // an Instagram-side user id (the cookie-fallback shape returned by
    // /api/settings when DB is briefly unreachable), match on igUserId too
    // so the create still resolves to the right igAccount row.
    const igAccount = await db.instagramAccount.findFirst({
      where: {
        userId: session.user.id,
        OR: [{ id: data.igAccountId }, { igUserId: data.igAccountId }],
      },
    });

    if (!igAccount) {
      return NextResponse.json(
        { error: "Instagram account not found for this user" },
        { status: 404 }
      );
    }

    let trigger;
    try {
      // Full create with all fields (requires latest schema migration).
      // Cast to any: local Prisma client is stale; Vercel regenerates it at build time.
      trigger = await (db.trigger.create as any)({
        data: {
          igAccountId: igAccount.id,
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
    } catch (schemaErr: any) {
      // DB may not have the new columns yet — fall back to base fields only
      console.warn("⚠️ Full trigger create failed (schema migration pending?), retrying with base fields:", schemaErr?.message?.slice(0, 200));
      trigger = await db.trigger.create({
        data: {
          igAccountId: igAccount.id,
          type: data.type,
          keywords: data.keywords.filter((k) => k.trim() !== ""),
          replyMessage: data.replyMessage,
          deliverLink: data.deliverLink || null,
          followGate: data.followGate,
        },
      });
    }

    return NextResponse.json(trigger, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Create trigger error:", error?.message || error, error?.stack);
    return NextResponse.json(
      {
        error: "Failed to save automation. Please try again.",
        detail: error?.message?.slice(0, 200) || String(error).slice(0, 200),
      },
      { status: 500 }
    );
  }
}
