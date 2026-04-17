import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/instagram";
import { processTriggerEvent, findIgAccountByIgUserId } from "@/lib/trigger-engine";

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

    // Verify signature
    const signature = request.headers.get("x-hub-signature-256");
    if (signature && !verifyWebhookSignature(body, signature)) {
      console.error("❌ Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);

    // Always respond 200 immediately (Meta requires this)
    // Process events asynchronously
    processWebhookEvents(data).catch((err) =>
      console.error("Webhook processing error:", err)
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

async function processWebhookEvents(data: any) {
  if (!data.entry) return;

  for (const entry of data.entry) {
    const igUserId = entry.id;

    // Find the Instagram account in our DB
    const igAccount = await findIgAccountByIgUserId(igUserId);
    if (!igAccount) {
      console.warn(`No account found for IG user ID: ${igUserId}`);
      continue;
    }

    // Process changes
    if (entry.changes) {
      for (const change of entry.changes) {
        await processChange(change, igAccount.id, igUserId);
      }
    }

    // Process messaging events
    if (entry.messaging) {
      for (const messagingEvent of entry.messaging) {
        await processMessaging(messagingEvent, igAccount.id);
      }
    }
  }
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

async function processMessaging(event: any, igAccountId: string) {
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
