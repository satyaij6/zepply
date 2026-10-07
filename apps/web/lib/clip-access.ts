import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * The signed-in user, if they're allowed to create videos. Until credits exist, video creation
 * costs real money per run, so only users with `canCreateVideos` set (by hand, in the database) get in.
 * Returns either the user id or the error response to send back.
 */
export async function requireCreator(): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { canCreateVideos: true } });
  if (!user?.canCreateVideos) {
    return { error: NextResponse.json({ error: "Video creation is invite-only for now." }, { status: 403 }) };
  }
  return { userId: session.user.id };
}
