import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { createLoginToken } from "@/lib/login-token";
import prisma from "@/lib/prisma";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  findInstagramAccount,
} from "@/lib/instagram";

/*
 * Meta sends people here after they approve Zepply. The Instagram account they own decides which
 * Zepply account they get (created the first time), and the session is issued here on the server,
 * so no user id ever travels through the browser.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("Instagram OAuth error:", error);
    return goTo(request, "/login?error=instagram_auth_failed");
  }
  if (!code) {
    return goTo(request, "/login?error=no_code");
  }

  try {
    // Code → short-lived token → long-lived (60-day) token → the Instagram account behind it
    const tokenData = await exchangeCodeForToken(code);
    const longLivedData = await getLongLivedToken(tokenData.access_token);
    const igData = await findInstagramAccount(longLivedData.access_token);

    let user = await prisma.user.findFirst({
      where: { igAccounts: { some: { igUserId: igData.igUserId } } },
    });
    if (!user) {
      user = await prisma.user.create({ data: { name: igData.igUsername } });
    }

    // We persist the *Page Access Token* (igData.pageAccessToken) because the Instagram Messaging
    // API on graph.facebook.com requires it — a user access token returns "(#3) Application does
    // not have the capability" even when the user-token has instagram_manage_messages. Page tokens
    // for IG-connected pages don't expire, so we still set a long expiresAt for the existing column.
    const tokenToStore = igData.pageAccessToken || longLivedData.access_token;
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in || 5184000));

    const account = {
      igUsername: igData.igUsername,
      igProfilePic: igData.profilePic || null,
      followerCount: igData.followers || 0,
      accessToken: tokenToStore,
      tokenExpiresAt: expiresAt,
    };
    await prisma.instagramAccount.upsert({
      where: { igUserId: igData.igUserId },
      create: { userId: user.id, igUserId: igData.igUserId, ...account },
      update: account,
    });

    const triggerCount = await prisma.trigger.count({
      where: { igAccount: { userId: user.id } },
    });

    await signIn("instagram", { token: createLoginToken(user.id), redirect: false });
    return goTo(request, triggerCount === 0 ? "/connected" : "/dashboard");
  } catch (error: any) {
    console.error("Instagram callback failed:", error?.message || error);
    return goTo(request, "/login?error=callback_failed");
  }
}

/** Redirects within the app, clearing the cookie older versions kept the Instagram token in. */
function goTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete("zepply_user");
  return response;
}
