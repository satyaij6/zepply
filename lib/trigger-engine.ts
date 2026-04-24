// Trigger engine — matches incoming Instagram events to user-defined triggers

import prisma from "@/lib/prisma";
import { sendDM, replyToComment, checkIfFollows } from "@/lib/instagram";
import type { TriggerType } from "@prisma/client";

interface IncomingEvent {
  type: "COMMENT" | "DM_KEYWORD" | "STORY_REPLY" | "NEW_FOLLOWER";
  igAccountId: string;
  senderIgUserId: string;
  senderUsername: string;
  text?: string;
  commentId?: string;
}

interface TriggerResult {
  matched: boolean;
  triggerId?: string;
  replySent: boolean;
  leadCaptured: boolean;
  error?: string;
}

export async function processTriggerEvent(
  event: IncomingEvent
): Promise<TriggerResult> {
  try {
    // 1. Find the Instagram account
    const igAccount = await prisma.instagramAccount.findUnique({
      where: { id: event.igAccountId },
      include: { user: true },
    });

    if (!igAccount || !igAccount.isActive) {
      return { matched: false, replySent: false, leadCaptured: false };
    }

    // 2. Find matching active triggers
    const triggers = await prisma.trigger.findMany({
      where: {
        igAccountId: event.igAccountId,
        type: event.type as TriggerType,
        isActive: true,
      },
    });

    if (triggers.length === 0) {
      return { matched: false, replySent: false, leadCaptured: false };
    }

    // 3. Match keywords
    let matchedTrigger = null;

    for (const trigger of triggers) {
      if (
        trigger.type === "NEW_FOLLOWER" ||
        trigger.type === "STORY_REPLY"
      ) {
        // These match without keywords
        matchedTrigger = trigger;
        break;
      }

      if (trigger.keywords.length === 0) {
        // Trigger with no keywords matches everything
        matchedTrigger = trigger;
        break;
      }

      // Check if any keyword matches (case-insensitive)
      const text = (event.text || "").toLowerCase();
      const keywordMatch = trigger.keywords.some((kw) =>
        text.includes(kw.toLowerCase())
      );

      if (keywordMatch) {
        matchedTrigger = trigger;
        break;
      }
    }

    if (!matchedTrigger) {
      return { matched: false, replySent: false, leadCaptured: false };
    }

    // 4. Follow-gate check (for comments only)
    if (matchedTrigger.followGate && event.type === "COMMENT") {
      const follows = await checkIfFollows(
        igAccount.igUserId,
        event.senderIgUserId,
        igAccount.accessToken
      );
      if (!follows) {
        return {
          matched: true,
          triggerId: matchedTrigger.id,
          replySent: false,
          leadCaptured: false,
          error: "Follow gate: user does not follow",
        };
      }
    }

    // 5. Build reply message
    let replyText = matchedTrigger.replyMessage;
    if (matchedTrigger.deliverLink) {
      replyText += `\n\n${matchedTrigger.deliverLink}`;
    }

    // 6. Send reply
    let replySent = false;
    try {
      if (event.type === "COMMENT" && event.commentId) {
        // Reply to comment, then always send DM
        await replyToComment(
          event.commentId,
          matchedTrigger.replyMessage,
          igAccount.accessToken
        );
        await sendDM(
          igAccount.igUserId,
          event.senderIgUserId,
          replyText,
          igAccount.accessToken
        );
      } else {
        // Send DM for DM_KEYWORD, STORY_REPLY, NEW_FOLLOWER
        await sendDM(
          igAccount.igUserId,
          event.senderIgUserId,
          replyText,
          igAccount.accessToken
        );
      }
      replySent = true;
    } catch (error) {
      console.error("Failed to send reply:", error);
      return {
        matched: true,
        triggerId: matchedTrigger.id,
        replySent: false,
        leadCaptured: false,
        error: `Reply failed: ${error}`,
      };
    }

    // 7. Capture lead
    await prisma.lead.create({
      data: {
        igAccountId: event.igAccountId,
        triggerId: matchedTrigger.id,
        igUserId: event.senderIgUserId,
        igUsername: event.senderUsername,
      },
    });

    // 8. Update trigger hit count
    await prisma.trigger.update({
      where: { id: matchedTrigger.id },
      data: { hitCount: { increment: 1 } },
    });

    // 9. Log analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const existingAnalytics = await prisma.analytics.findFirst({
      where: {
        igAccountId: event.igAccountId,
        date: { gte: today, lt: tomorrow },
      },
    });

    if (existingAnalytics) {
      await prisma.analytics.update({
        where: { id: existingAnalytics.id },
        data: {
          triggersHit: { increment: 1 },
          leadsCaptured: { increment: 1 },
          dmsSent: replySent ? { increment: 1 } : undefined,
        },
      });
    } else {
      await prisma.analytics.create({
        data: {
          igAccountId: event.igAccountId,
          date: today,
          triggersHit: 1,
          leadsCaptured: 1,
          dmsSent: replySent ? 1 : 0,
        },
      });
    }

    return {
      matched: true,
      triggerId: matchedTrigger.id,
      replySent: true,
      leadCaptured: true,
    };
  } catch (error) {
    console.error("Trigger engine error:", error);
    return {
      matched: false,
      replySent: false,
      leadCaptured: false,
      error: `Engine error: ${error}`,
    };
  }
}

// Find the Instagram account ID from the IG user ID in the webhook payload
export async function findIgAccountByIgUserId(igUserId: string) {
  return prisma.instagramAccount.findUnique({
    where: { igUserId },
    include: { user: true },
  });
}
