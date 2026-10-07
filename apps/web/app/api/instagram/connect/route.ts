import { NextRequest, NextResponse } from "next/server";
import { getInstagramAuthUrl, IG_RETURN_COOKIE } from "@/lib/instagram";

// In-app pages Instagram may send people back to after connecting (the callback reads the cookie)
const RETURN_PATHS = ["/start"];

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(getInstagramAuthUrl());
  const next = request.nextUrl.searchParams.get("next");
  if (next && RETURN_PATHS.includes(next)) {
    response.cookies.set(IG_RETURN_COOKIE, next, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  }
  return response;
}
