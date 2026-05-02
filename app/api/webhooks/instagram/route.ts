import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/instagram";
import {
  processTriggerEvent,
  findIgAccountByIgUserId,
  handleFollowConfirm,
  parseFollowConfirmPayload,
} from "@/lib/trigger-engine";

// GET — Meta webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ Webhook verification failed");
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST — Handle incoming Instagram events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log("📨 WEBHOOK RECEIVED. Body:", body);

    // Verify signature
    const signature = request.headers.get("x-hub-signature-256");
    if (signature && !verifyWebhookSignature(body, signature)) {
      console.error("❌ Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);
    console.log("📨 Parsed webhook data:", JSON.stringify(data, null, 2));

    // Await processing so serverless function doesn't terminate early.
    // Meta allows up to 20 seconds for webhook response.
    try {
      await processWebhookEvents(data);
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

async function processWebhookEvents(data: any) {
  console.log("🔄 processWebhookEvents START");
  if (!data.entry) {
    console.warn("⚠️ No entry in webhook data");
    return;
  }

  for (const entry of data.entry) {
    const igUserId = entry.id;
    console.log(`🔍 Looking up IG account by id: ${igUserId}`);

    // Find the Instagram account in our DB
    const igAccount = await findIgAccountByIgUserId(igUserId);
    if (!igAccount) {
      console.warn(`❌ No account found for IG user ID: ${igUserId}`);
      continue;
    }
    console.log(`✅ Found account: ${igAccount.igUsername} (internal id: ${igAccount.id})`);

    // Process changes
    if (entry.changes) {
      console.log(`📋 Processing ${entry.changes.length} changes`);
      for (const change of entry.changes) {
        console.log(`📋 Change field: ${change.field}, value:`, JSON.stringify(change.value));
        await processChange(change, igAccount.id, igUserId);
      }
    }

    // Process messaging events
    if (entry.messaging) {
      console.log(`💬 Processing ${entry.messaging.length} messaging events`);
      for (const messagingEvent of entry.messaging) {
        await processMessaging(messagingEvent, igAccount.id, igUserId);
      }
    }
  }
  console.log("🔄 processWebhookEvents END");
}

async function processChange(change: any, igAccountId: string, igUserId: string) {
  const field = change.field;
  const value = change.value;

  switch (field) {
    case "comments": {
      // Someone commented on a post
      if (value.from && value.from.id !== igUserId) {
        await processTriggerEvent({
          type: "COMMENT",
          igAccountId,
          senderIgUserId: value.from.id,
          senderUsername: value.from.username || "unknown",
          text: value.text || "",
          commentId: value.id,
        });
      }
      break;
    }

    case "story_insights":
    case "mentions": {
      // Story mention/reply
      if (value.sender && value.sender.id !== igUserId) {
        await processTriggerEvent({
          type: "STORY_REPLY",
          igAccountId,
          senderIgUserId: value.sender.id,
          senderUsername: value.sender.username || "unknown",
          text: value.text || "",
        });
      }
      break;
    }

    case "followers": {
      // New follower
      if (value.follower_id) {
        await processTriggerEvent({
          type: "NEW_FOLLOWER",
          igAccountId,
          senderIgUserId: value.follower_id,
          senderUsername: value.username || "new_follower",
        });
      }
      break;
    }
  }
}

async function processMessaging(event: any, igAccountId: string, igUserId: string) {
  // Postback (e.g. "I'm following" tap on a follow-gate DM)
  if (event.postback?.payload && event.sender) {
    const triggerId = parseFollowConfirmPayload(event.postback.payload);
    if (triggerId) {
      console.log(`📩 Postback FOLLOW_CONFIRM for trigger ${triggerId} from ${event.sender.id}`);
      await handleFollowConfirm(
        igUserId,
        event.sender.id,
        event.sender.username || "",
        triggerId
      );
      return;
    }
    console.log(`📩 Postback with unknown payload, ignoring: ${event.postback.payload}`);
    return;
  }

  // DM received
  if (event.message && event.sender) {
    await processTriggerEvent({
      type: "DM_KEYWORD",
      igAccountId,
      senderIgUserId: event.sender.id,
      senderUsername: event.sender.username || "unknown",
      text: event.message.text || "",
    });
  }
}
