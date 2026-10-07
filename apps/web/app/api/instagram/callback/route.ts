import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";
import { createLoginToken } from "@/lib/login-token";
import prisma from "@/lib/prisma";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  findInstagramAccount,
} from "@/lib/instagram";

/*
 * Meta sends people here after they approve Zepply.
 * - Signed in (the normal case, after Google sign-up): the Instagram account is attached to that
 *   Zepply account, unless it already belongs to a different one.
 * - Signed out: whoever already owns this Instagram account is logged in; anyone else is asked to
 *   sign up first, so every account starts from a verified Google email.
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

  const session = await auth();
  const signedInId = session?.user?.id ?? null;

  try {
    // Code → short-lived token → long-lived (60-day) token → the Instagram account behind it
    const tokenData = await exchangeCodeForToken(code);
    const longLivedData = await getLongLivedToken(tokenData.access_token);
    const igData = await findInstagramAccount(longLivedData.access_token);

    const owner = await prisma.instagramAccount.findUnique({
      where: { igUserId: igData.igUserId },
      select: { userId: true },
    });

    let userId: string;
    if (signedInId) {
      const me = await prisma.user.findUnique({ where: { id: signedInId }, select: { id: true } });
      if (!me) return goTo(request, "/login?error=account_missing");
      if (owner && owner.userId !== me.id) return goTo(request, "/connected?error=instagram_in_use");
      userId = me.id;
    } else {
      if (!owner) return goTo(request, "/signup?error=signup_first");
      userId = owner.userId;
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
      create: { userId, igUserId: igData.igUserId, ...account },
      update: account,
    });

    if (!signedInId) {
      await signIn("instagram", { token: createLoginToken(userId), redirect: false });
      return goTo(request, "/dashboard");
    }
    return goTo(request, "/connected");
  } catch (error: any) {
    console.error("Instagram callback failed:", error?.message || error);
    return goTo(request, signedInId ? "/connected?error=callback_failed" : "/login?error=callback_failed");
  }
}

/** Redirects within the app, clearing the cookie older versions kept the Instagram token in. */
function goTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete("zepply_user");
  return response;
}
