import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");
  const username = searchParams.get("username");
  const igUserId = searchParams.get("igUserId");
  const profilePic = searchParams.get("profilePic");
  const redirect = searchParams.get("redirect") || "/onboarding";

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=no_user", request.url));
  }

  try {
    // Use NextAuth's signIn to create a JWT session
    // This calls the "instagram" credentials provider's authorize function
    await signIn("instagram", {
      userId,
      username: username || "user",
      igUserId: igUserId || "",
      profilePic: profilePic || "",
      redirect: false,
    });

    // signIn with redirect:false won't redirect, so we do it manually
    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (error: any) {
    // NextAuth signIn throws a NEXT_REDIRECT error on success (expected behavior)
    // Check if it's the redirect "error" which means success
    if (error?.digest?.includes("NEXT_REDIRECT")) {
      // This is actually a success - NextAuth session was created
      // Extract the redirect URL from the error
      return NextResponse.redirect(new URL(redirect, request.url));
    }

    console.error("Auth complete error:", error?.message || error);
    return NextResponse.redirect(
      new URL("/login?error=session_failed", request.url)
    );
  }
}
