// Instagram Graph API helper functions

const GRAPH_API_FB = "https://graph.facebook.com/v21.0";

// ─── OAuth (Facebook Login — works with localhost) ─────────

export function getInstagramAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.META_FB_APP_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    scope: [
      "instagram_basic",
      "instagram_manage_messages",
      "instagram_manage_comments",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "business_management",
    ].join(","),
    response_type: "code",
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_FB_APP_ID!,
    client_secret: process.env.META_FB_APP_SECRET!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    code,
  });

  const response = await fetch(
    `${GRAPH_API_FB}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Token exchange error:", JSON.stringify(error));
    throw new Error(`Token exchange failed: ${JSON.stringify(error)}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
  }>;
}

// Exchange short-lived token for long-lived token (60 days)
export async function getLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_FB_APP_ID!,
    client_secret: process.env.META_FB_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `${GRAPH_API_FB}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Long-lived token failed: ${JSON.stringify(error)}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>;
}

// ─── Find Instagram Account ──────────────────────────────

export async function findInstagramAccount(accessToken: string) {
  // Method 1: /me/accounts with fields expansion
  try {
    const url = `${GRAPH_API_FB}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}&limit=100&access_token=${accessToken}`;
    console.log("Method 1: Fetching /me/accounts with IG fields...");
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log("Method 1 pages:", data.data?.length || 0);
      if (data.data) {
        for (const page of data.data) {
          if (page.instagram_business_account) {
            console.log("✅ Found IG via pages:", page.instagram_business_account.username);
            return {
              igUserId: page.instagram_business_account.id,
              igUsername: page.instagram_business_account.username,
              profilePic: page.instagram_business_account.profile_picture_url,
              followers: page.instagram_business_account.followers_count || 0,
              pageAccessToken: page.access_token,
            };
          }
        }
      }
    }
  } catch (err) {
    console.log("Method 1 failed:", err);
  }

  // Method 2: Try /me/instagram_accounts (newer endpoint)
  try {
    console.log("Method 2: Fetching /me/instagram_accounts...");
    const res = await fetch(
      `${GRAPH_API_FB}/me/instagram_accounts?fields=id,username,profile_picture_url,followers_count&access_token=${accessToken}`
    );
    if (res.ok) {
      const data = await res.json();
      console.log("Method 2 result:", JSON.stringify(data));
      if (data.data && data.data.length > 0) {
        const ig = data.data[0];
        return {
          igUserId: ig.id,
          igUsername: ig.username,
          profilePic: ig.profile_picture_url,
          followers: ig.followers_count || 0,
          pageAccessToken: accessToken,
        };
      }
    }
  } catch (err) {
    console.log("Method 2 failed:", err);
  }

  // Method 3: Debug token to see granted permissions
  try {
    console.log("Method 3: Checking token permissions...");
    const res = await fetch(
      `${GRAPH_API_FB}/debug_token?input_token=${accessToken}&access_token=${process.env.META_FB_APP_ID}|${process.env.META_FB_APP_SECRET}`
    );
    if (res.ok) {
      const data = await res.json();
      console.log("Token scopes:", data.data?.scopes);
      console.log("Token granular_scopes:", JSON.stringify(data.data?.granular_scopes));
    }
  } catch (err) {
    console.log("Token debug failed:", err);
  }

  // Method 4: Get /me info for fallback user creation
  console.log("Method 4: Falling back to /me for basic user info...");
  const meRes = await fetch(
    `${GRAPH_API_FB}/me?fields=id,name,email&access_token=${accessToken}`
  );

  if (meRes.ok) {
    const me = await meRes.json();
    console.log("Facebook user:", me.name, me.id);

    // Return a fallback with Facebook user info — the user can connect IG from settings
    return {
      igUserId: `fb_${me.id}`,
      igUsername: me.name?.toLowerCase().replace(/\s+/g, "_") || "user",
      profilePic: null,
      followers: 0,
      pageAccessToken: accessToken,
      isPending: true, // Flag to show "connect IG" prompt in dashboard
    };
  }

  throw new Error("Could not authenticate. Please try again.");
}

// ─── Profile ──────────────────────────────────────────────

export async function getIGUserProfile(igUserId: string, accessToken: string) {
  const response = await fetch(
    `${GRAPH_API_FB}/${igUserId}?fields=id,username,profile_picture_url,followers_count&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get IG profile: ${JSON.stringify(error)}`);
  }

  return response.json() as Promise<{
    id: string;
    username: string;
    profile_picture_url?: string;
    followers_count?: number;
  }>;
}

// ─── Messaging ────────────────────────────────────────────

export async function sendDM(
  igUserId: string,
  recipientId: string,
  message: string,
  accessToken: string
) {
  const url = new URL(`${GRAPH_API_FB}/${igUserId}/messages`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("DM send failed:", error);
    throw new Error(`Failed to send DM: ${JSON.stringify(error)}`);
  }

  return res.json();
}

export async function replyToComment(
  commentId: string,
  message: string,
  accessToken: string
) {
  const url = new URL(`${GRAPH_API_FB}/${commentId}/replies`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Comment reply failed:", error);
    throw new Error(`Failed to reply to comment: ${JSON.stringify(error)}`);
  }

  return res.json();
}

// ─── Follow Check ─────────────────────────────────────────

export async function checkIfFollows(
  igUserId: string,
  followerId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const url = `${GRAPH_API_FB}/${igUserId}/followers?access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return data.data?.some((f: { id: string }) => f.id === followerId) ?? false;
  } catch {
    return false;
  }
}

// ─── Webhook Signature Verification ──────────────────────

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const expectedSig = crypto
    .createHmac("sha256", process.env.META_FB_APP_SECRET!)
    .update(payload)
    .digest("hex");
  return `sha256=${expectedSig}` === signature;
}
