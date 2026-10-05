import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

const GRAPH_API = "https://graph.facebook.com/v21.0";

// GET — Fetch user's recent Instagram posts/reels
export async function GET(request: NextRequest) {
  const session = await auth();

  // Get the access token — try database first, then cookie fallback
  let accessToken: string | null = null;
  let igUserId: string | null = null;

  // Try database
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (session?.user?.id) {
      const igAccount = await db.instagramAccount.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { accessToken: true, igUserId: true },
      });

      if (igAccount) {
        accessToken = igAccount.accessToken;
        igUserId = igAccount.igUserId;
      }
    }
  } catch {
    console.warn("⚠️ Media API: DB unreachable, using cookie fallback");
  }

  // Fallback: read from cookie
  if (!accessToken) {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("zepply_user");

    if (userCookie) {
      try {
        const userData = JSON.parse(userCookie.value);
        accessToken = userData.accessToken;
        igUserId = userData.igUserId;
      } catch {
        // Cookie parse failed
      }
    }
  }

  if (!accessToken || !igUserId) {
    return NextResponse.json(
      { error: "No Instagram account connected" },
      { status: 401 }
    );
  }

  try {
    // Fetch recent media from Instagram Graph API
    const mediaRes = await fetch(
      `${GRAPH_API}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=20&access_token=${accessToken}`
    );

    if (!mediaRes.ok) {
      const error = await mediaRes.json();
      console.error("Instagram media fetch error:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Failed to fetch media", details: error },
        { status: 500 }
      );
    }

    const mediaData = await mediaRes.json();

    // Format the response
    const posts = (mediaData.data || []).map((item: any) => ({
      id: item.id,
      caption: item.caption || "",
      mediaType: item.media_type, // IMAGE, VIDEO, CAROUSEL_ALBUM
      mediaUrl: item.media_url || null,
      thumbnailUrl: item.thumbnail_url || item.media_url || null,
      permalink: item.permalink || null,
      timestamp: item.timestamp,
    }));

    return NextResponse.json({
      data: posts,
      paging: mediaData.paging || null,
    });
  } catch (error: any) {
    console.error("Media API error:", error?.message);
    return NextResponse.json(
      { error: "Failed to fetch Instagram media" },
      { status: 500 }
    );
  }
}
