// Trigger engine — matches incoming Instagram events to user-defined triggers

import prisma from "@/lib/prisma";
import { sendDM, replyToComment, checkIfFollows } from "@/lib/instagram";
import { sendLeadAlertEmail } from "@/lib/resend";
import type { TriggerType } from "@prisma/client";

interface IncomingEvent {
  type: "COMMENT" | "DM_KEYWORD" | "STORY_REPLY" | "NEW_FOLLOWER";
  igAccountId: string;
  senderIgUserId: string;
  senderUsername: string;
  text?: string;
  commentId?: string;
}

// Extended trigger type — includes fields added in the latest schema migration.
// Once `prisma generate` runs (Vercel does this at build time), this can be removed.
interface TriggerWithAdvanced {
  id: string;
  type: TriggerType;
  keywords: string[];
  replyMessage: string;
  deliverLink: string | null;
  followGate: boolean;
  publicReplyOn: boolean;
  publicReplies: string[];
  isActive: boolean;
  [key: string]: unknown;
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
  console.log(`⚡ processTriggerEvent type=${event.type} text="${event.text}" sender=${event.senderUsername}`);
  try {
    // 1. Find the Instagram account
    const igAccount = await prisma.instagramAccount.findUnique({
      where: { id: event.igAccountId },
      include: { user: true },
    });

    if (!igAccount || !igAccount.isActive) {
      console.warn(`❌ Account not found or inactive. igAccountId=${event.igAccountId}`);
      return { matched: false, replySent: false, leadCaptured: false };
    }
    console.log(`✅ Account active: ${igAccount.igUsername}`);

    // 2. Find matching active triggers
    const triggers = await prisma.trigger.findMany({
      where: {
        igAccountId: event.igAccountId,
        type: event.type as TriggerType,
        isActive: true,
      },
    });
    console.log(`📋 Found ${triggers.length} active ${event.type} triggers`);

    if (triggers.length === 0) {
      console.warn(`❌ No active triggers of type ${event.type}`);
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

      console.log(`🔍 Checking keywords [${trigger.keywords.join(",")}] against "${event.text}" → match=${keywordMatch}`);
      if (keywordMatch) {
        matchedTrigger = trigger;
        break;
      }
    }

    if (!matchedTrigger) {
      console.warn(`❌ No keyword match for text: "${event.text}"`);
      return { matched: false, replySent: false, leadCaptured: false };
    }
    // Cast to extended type — new fields exist after the schema migration runs
    const trigger = matchedTrigger as unknown as TriggerWithAdvanced;
    console.log(`✅ Matched trigger: ${trigger.id}, reply: "${trigger.replyMessage}"`);

    // 4. Follow-gate check (for comments only)
    if (trigger.followGate && event.type === "COMMENT") {
      const follows = await checkIfFollows(
        igAccount.igUserId,
        event.senderIgUserId,
        igAccount.accessToken
      );
      if (!follows) {
        return {
          matched: true,
          triggerId: trigger.id,
          replySent: false,
          leadCaptured: false,
          error: "Follow gate: user does not follow",
        };
      }
    }

    // 5. Build reply message
    let replyText = trigger.replyMessage;
    if (trigger.deliverLink) {
      replyText += `\n\n${trigger.deliverLink}`;
    }

    // 6. Send reply
    let replySent = false;
    try {
      if (event.type === "COMMENT" && event.commentId) {
        // Public comment reply — use the curated publicReplies list (random pick),
        // not the DM message (which is private)
        if (trigger.publicReplyOn && trigger.publicReplies.length > 0) {
          const publicReplyText = trigger.publicReplies[
            Math.floor(Math.random() * trigger.publicReplies.length)
          ];
          console.log(`💬 Replying publicly to comment ${event.commentId}: "${publicReplyText}"`);
          await replyToComment(event.commentId, publicReplyText, igAccount.accessToken);
          console.log(`✅ Public comment reply sent.`);
        }
        // Send private DM
        console.log(`📨 Sending DM to ${event.senderIgUserId}...`);
        await sendDM(igAccount.igUserId, event.senderIgUserId, replyText, igAccount.accessToken);
        console.log(`✅ DM sent successfully!`);
      } else {
        // DM_KEYWORD, STORY_REPLY, NEW_FOLLOWER — DM only
        await sendDM(igAccount.igUserId, event.senderIgUserId, replyText, igAccount.accessToken);
      }
      replySent = true;
    } catch (error) {
      console.error("Failed to send reply:", error);
      return {
        matched: true,
        triggerId: trigger.id,
        replySent: false,
        leadCaptured: false,
        error: `Reply failed: ${error}`,
      };
    }

    // 7. Capture lead
    await prisma.lead.create({
      data: {
        igAccountId: event.igAccountId,
        triggerId: trigger.id,
        igUserId: event.senderIgUserId,
        igUsername: event.senderUsername,
      },
    });

    // Send lead alert email if user has an email on file
    if (igAccount.user.email) {
      const keyword = trigger.keywords[0] || event.type;
      sendLeadAlertEmail(igAccount.user.email, event.senderUsername, keyword).catch(
        (err) => console.error("Lead alert email failed:", err)
      );
    }

    // 8. Update trigger hit count
    await prisma.trigger.update({
      where: { id: trigger.id },
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
      triggerId: trigger.id,
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
