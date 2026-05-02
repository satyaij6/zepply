// Trigger engine — matches incoming Instagram events to user-defined triggers

import prisma from "@/lib/prisma";
import { sendDM, sendQuickReplyDM, replyToComment, type QuickReply } from "@/lib/instagram";
import { sendLeadAlertEmail } from "@/lib/resend";
import type { TriggerType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────

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

interface IgAccountForReply {
  id: string;
  igUserId: string;
  igUsername: string;
  accessToken: string;
  user: { email: string | null };
}

interface TriggerResult {
  matched: boolean;
  triggerId?: string;
  replySent: boolean;
  leadCaptured: boolean;
  error?: string;
}

// ─── Postback payload encoding ───────────────────────────
//
// We encode the trigger id directly in the postback payload so the
// "I'm following" tap can resolve back to the originating automation
// without any extra DB lookup (and without persisting per-user pending
// state).
const FOLLOW_CONFIRM_PREFIX = "FOLLOW_CONFIRM:";

export function buildFollowConfirmPayload(triggerId: string): string {
  return `${FOLLOW_CONFIRM_PREFIX}${triggerId}`;
}

export function parseFollowConfirmPayload(payload: string): string | null {
  if (!payload?.startsWith(FOLLOW_CONFIRM_PREFIX)) return null;
  return payload.slice(FOLLOW_CONFIRM_PREFIX.length) || null;
}

// ─── Main entry — keyword-matched events (comment/DM/story/follow) ───

export async function processTriggerEvent(
  event: IncomingEvent
): Promise<TriggerResult> {
  console.log(`⚡ processTriggerEvent type=${event.type} text="${event.text}" sender=${event.senderUsername}`);
  try {
    const igAccount = await prisma.instagramAccount.findUnique({
      where: { id: event.igAccountId },
      include: { user: true },
    });

    if (!igAccount || !igAccount.isActive) {
      console.warn(`❌ Account not found or inactive. igAccountId=${event.igAccountId}`);
      return { matched: false, replySent: false, leadCaptured: false };
    }
    console.log(`✅ Account active: ${igAccount.igUsername}`);

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

    let matchedTrigger = null;
    for (const trigger of triggers) {
      if (trigger.type === "NEW_FOLLOWER" || trigger.type === "STORY_REPLY") {
        matchedTrigger = trigger;
        break;
      }
      if (trigger.keywords.length === 0) {
        matchedTrigger = trigger;
        break;
      }
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

    const trigger = matchedTrigger as unknown as TriggerWithAdvanced;
    console.log(`✅ Matched trigger: ${trigger.id}, reply: "${trigger.replyMessage}"`);

    // Follow-gate: send an interactive "follow + confirm" DM instead of
    // the actual content. The user must tap "I'm following" before they
    // get the link. Only applies to comment-originated triggers.
    if (trigger.followGate && event.type === "COMMENT") {
      return sendFollowGateMessage(trigger, igAccount, event);
    }

    return executeReply(trigger, igAccount, event);
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

// ─── Postback entry — "I'm following" tap on the gate DM ────

export async function handleFollowConfirm(
  igUserId: string,
  senderIgUserId: string,
  senderUsername: string,
  triggerId: string
): Promise<TriggerResult> {
  console.log(`✅ Follow-confirm postback for trigger ${triggerId} from ${senderUsername || senderIgUserId}`);

  const igAccount = await prisma.instagramAccount.findUnique({
    where: { igUserId },
    include: { user: true },
  });
  if (!igAccount) {
    console.warn(`❌ Follow-confirm: no IG account for ${igUserId}`);
    return { matched: false, replySent: false, leadCaptured: false };
  }

  const trigger = await prisma.trigger.findFirst({
    where: { id: triggerId, igAccountId: igAccount.id, isActive: true },
  });
  if (!trigger) {
    console.warn(`❌ Follow-confirm: trigger ${triggerId} not found or inactive`);
    return { matched: false, replySent: false, leadCaptured: false };
  }

  return executeReply(
    trigger as unknown as TriggerWithAdvanced,
    igAccount,
    {
      type: "COMMENT",
      igAccountId: igAccount.id,
      senderIgUserId,
      senderUsername: senderUsername || senderIgUserId,
      // No commentId — postback path never re-replies publicly.
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────

async function sendFollowGateMessage(
  trigger: TriggerWithAdvanced,
  igAccount: IgAccountForReply,
  event: IncomingEvent
): Promise<TriggerResult> {
  console.log(`🔒 Follow gate active — sending interactive request to ${event.senderUsername}`);

  // Public comment reply still goes out (e.g. "Check your DMs!") — same
  // as the non-gated flow, so the commenter knows to look in DMs.
  if (event.commentId && trigger.publicReplyOn && trigger.publicReplies.length > 0) {
    try {
      const publicReplyText = trigger.publicReplies[
        Math.floor(Math.random() * trigger.publicReplies.length)
      ];
      console.log(`💬 Replying publicly to comment ${event.commentId}: "${publicReplyText}"`);
      await replyToComment(event.commentId, publicReplyText, igAccount.accessToken);
      console.log(`✅ Public comment reply sent (gate flow).`);
    } catch (err) {
      console.error("Public reply failed in gate flow:", err);
    }
  }

  const text =
    `Looks like you're not following yet 👀\n\n` +
    `👉 instagram.com/${igAccount.igUsername}\n\n` +
    `Follow me and tap "I'm following" — I'll send it right away!`;
  const quickReplies: QuickReply[] = [
    {
      content_type: "text",
      title: "I'm following ✅",
      payload: buildFollowConfirmPayload(trigger.id),
    },
  ];

  try {
    console.log(`📨 Sending follow-gate DM to ${event.senderIgUserId}...`);
    await sendQuickReplyDM(
      igAccount.igUserId,
      event.senderIgUserId,
      text,
      quickReplies,
      igAccount.accessToken
    );
    console.log(`✅ Follow-gate DM sent (awaiting tap).`);
  } catch (err) {
    console.error("Follow-gate DM failed:", err);
    return {
      matched: true,
      triggerId: trigger.id,
      replySent: false,
      leadCaptured: false,
      error: `Gate DM failed: ${err}`,
    };
  }

  // Count the trigger fire, but defer lead capture until the user
  // actually taps "I'm following".
  await prisma.trigger.update({
    where: { id: trigger.id },
    data: { hitCount: { increment: 1 } },
  });

  return {
    matched: true,
    triggerId: trigger.id,
    replySent: true,
    leadCaptured: false,
  };
}

async function executeReply(
  trigger: TriggerWithAdvanced,
  igAccount: IgAccountForReply,
  event: IncomingEvent
): Promise<TriggerResult> {
  let replyText = trigger.replyMessage;
  if (trigger.deliverLink) replyText += `\n\n${trigger.deliverLink}`;

  let replySent = false;
  try {
    if (event.type === "COMMENT" && event.commentId) {
      if (trigger.publicReplyOn && trigger.publicReplies.length > 0) {
        const publicReplyText = trigger.publicReplies[
          Math.floor(Math.random() * trigger.publicReplies.length)
        ];
        console.log(`💬 Replying publicly to comment ${event.commentId}: "${publicReplyText}"`);
        await replyToComment(event.commentId, publicReplyText, igAccount.accessToken);
        console.log(`✅ Public comment reply sent.`);
      }
      console.log(`📨 Sending DM to ${event.senderIgUserId}...`);
      await sendDM(igAccount.igUserId, event.senderIgUserId, replyText, igAccount.accessToken);
      console.log(`✅ DM sent successfully!`);
    } else {
      console.log(`📨 Sending DM to ${event.senderIgUserId}...`);
      await sendDM(igAccount.igUserId, event.senderIgUserId, replyText, igAccount.accessToken);
      console.log(`✅ DM sent successfully!`);
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

  await prisma.lead.create({
    data: {
      igAccountId: igAccount.id,
      triggerId: trigger.id,
      igUserId: event.senderIgUserId,
      igUsername: event.senderUsername,
    },
  });

  if (igAccount.user.email) {
    const keyword = trigger.keywords[0] || event.type;
    sendLeadAlertEmail(igAccount.user.email, event.senderUsername, keyword).catch(
      (err) => console.error("Lead alert email failed:", err)
    );
  }

  await prisma.trigger.update({
    where: { id: trigger.id },
    data: { hitCount: { increment: 1 } },
  });

  await bumpDailyAnalytics(igAccount.id, replySent);

  return {
    matched: true,
    triggerId: trigger.id,
    replySent: true,
    leadCaptured: true,
  };
}

async function bumpDailyAnalytics(igAccountId: string, dmSent: boolean) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const existing = await prisma.analytics.findFirst({
    where: { igAccountId, date: { gte: today, lt: tomorrow } },
  });

  if (existing) {
    await prisma.analytics.update({
      where: { id: existing.id },
      data: {
        triggersHit: { increment: 1 },
        leadsCaptured: { increment: 1 },
        dmsSent: dmSent ? { increment: 1 } : undefined,
      },
    });
  } else {
    await prisma.analytics.create({
      data: {
        igAccountId,
        date: today,
        triggersHit: 1,
        leadsCaptured: 1,
        dmsSent: dmSent ? 1 : 0,
      },
    });
  }
}

// Find the Instagram account ID from the IG user ID in the webhook payload
export async function findIgAccountByIgUserId(igUserId: string) {
  return prisma.instagramAccount.findUnique({
    where: { igUserId },
    include: { user: true },
  });
}
