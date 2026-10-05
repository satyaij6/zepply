import { NextRequest, NextResponse } from "next/server";
import { getInstagramAuthUrl } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const authUrl = getInstagramAuthUrl();
  return NextResponse.redirect(authUrl);
}
