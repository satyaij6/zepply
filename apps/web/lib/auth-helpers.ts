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

/** The signed-in user's id, or the 401 response to send back. For route handlers. */
export async function requireUserId(): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: session.user.id };
}
