import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  findInstagramAccount,
} from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("Instagram OAuth error:", error);
    return NextResponse.redirect(
      new URL("/login?error=instagram_auth_failed", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=no_code", request.url)
    );
  }

  try {
    // 1. Exchange code for short-lived token
    console.log("=== INSTAGRAM CALLBACK START ===");
    console.log("Step 1: Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code);
    console.log("Step 1 ✅ Got access token");

    // 2. Exchange for long-lived token (60-day)
    console.log("Step 2: Getting long-lived token...");
    const longLivedData = await getLongLivedToken(tokenData.access_token);
    console.log("Step 2 ✅ Expires in", longLivedData.expires_in, "seconds");

    // 3. Find Instagram account
    console.log("Step 3: Finding Instagram account...");
    const igData = await findInstagramAccount(longLivedData.access_token);
    console.log("Step 3 ✅ Account:", igData.igUsername, "ID:", igData.igUserId);

    // 4. Try saving to database (gracefully fail for local dev)
    let userId = `local_${igData.igUserId}`;
    let isNewUser = true;

    try {
      console.log("Step 4: Saving to database...");
      const prismaModule = await import("@/lib/prisma");
      const db = prismaModule.default;

      let user = await db.user.findFirst({
        where: {
          igAccounts: { some: { igUserId: igData.igUserId } },
        },
      });

      if (!user) {
        user = await db.user.create({
          data: { name: igData.igUsername },
        });
        console.log("Step 4 ✅ Created new user:", user.id);
      } else {
        isNewUser = false;
        console.log("Step 4 ✅ Found existing user:", user.id);
      }
      userId = user.id;

      // Save Instagram account
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in || 5184000));

      await db.instagramAccount.upsert({
        where: { igUserId: igData.igUserId },
        create: {
          userId: user.id,
          igUserId: igData.igUserId,
          igUsername: igData.igUsername,
          igProfilePic: igData.profilePic || null,
          followerCount: igData.followers || 0,
          accessToken: longLivedData.access_token,
          tokenExpiresAt: expiresAt,
        },
        update: {
          accessToken: longLivedData.access_token,
          tokenExpiresAt: expiresAt,
          igUsername: igData.igUsername,
          igProfilePic: igData.profilePic || null,
          followerCount: igData.followers || 0,
        },
      });
      console.log("Step 5 ✅ IG account saved");

      const triggerCount = await db.trigger.count({
        where: { igAccount: { userId: user.id } },
      });
      isNewUser = triggerCount === 0;
    } catch (dbError: any) {
      console.warn("⚠️ Database unreachable, using local session fallback");
      console.warn("  →", dbError?.message?.substring(0, 120));
    }

    // 5. Set user data cookie (fallback for when DB is unreachable)
    const redirectUrl = isNewUser ? "/onboarding" : "/dashboard";

    const params = new URLSearchParams({
      userId: userId,
      username: igData.igUsername,
      igUserId: igData.igUserId,
      profilePic: igData.profilePic || "",
      redirect: redirectUrl,
    });

    console.log("=== INSTAGRAM CALLBACK COMPLETE ✅ → signing in... ===");

    const response = NextResponse.redirect(
      new URL(`/api/auth/complete?${params.toString()}`, request.url)
    );

    // Store IG account data in cookie for use by settings/onboarding pages
    response.cookies.set("zepply_user", JSON.stringify({
      id: userId,
      igUserId: igData.igUserId,
      igUsername: igData.igUsername,
      profilePic: igData.profilePic || null,
      followers: igData.followers || 0,
      accessToken: longLivedData.access_token,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("=== INSTAGRAM CALLBACK FAILED ===");
    console.error("Error:", error?.message || error);
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url)
    );
  }
}
