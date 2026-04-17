import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  findInstagramAccount,
} from "@/lib/instagram";
import prisma from "@/lib/prisma";

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

    // 3. Find Instagram account (tries 4 methods, always returns something)
    console.log("Step 3: Finding Instagram account...");
    const igData = await findInstagramAccount(longLivedData.access_token);
    console.log("Step 3 ✅ Account:", igData.igUsername, "ID:", igData.igUserId);

    // 4. Create or find user in database
    console.log("Step 4: Saving to database...");
    let user = await prisma.user.findFirst({
      where: {
        igAccounts: {
          some: { igUserId: igData.igUserId },
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: igData.igUsername,
        },
      });
      console.log("Step 4 ✅ Created new user:", user.id);
    } else {
      console.log("Step 4 ✅ Found existing user:", user.id);
    }

    // 5. Create or update Instagram account
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + longLivedData.expires_in);

    await prisma.instagramAccount.upsert({
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

    // 6. Check if user has any triggers
    const triggerCount = await prisma.trigger.count({
      where: {
        igAccount: { userId: user.id },
      },
    });

    // 7. Redirect
    const redirectUrl = triggerCount === 0 ? "/onboarding" : "/dashboard";
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));

    response.cookies.set("pending_auth_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60,
      path: "/",
    });

    console.log("=== INSTAGRAM CALLBACK COMPLETE ✅ → " + redirectUrl + " ===");
    return response;
  } catch (error: any) {
    console.error("=== INSTAGRAM CALLBACK FAILED ===");
    console.error("Error:", error?.message || error);
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url)
    );
  }
}
