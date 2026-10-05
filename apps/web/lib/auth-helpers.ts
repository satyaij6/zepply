import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getServerUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}
