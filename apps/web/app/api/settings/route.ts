import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

// GET — Get user settings
export async function GET(request: NextRequest) {
  const session = await auth();

  // Try database first
  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    if (session?.user?.id) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        include: {
          igAccounts: {
            select: {
              id: true,
              igUsername: true,
              igProfilePic: true,
              followerCount: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });

      if (user) {
        return NextResponse.json(user);
      }
    }
  } catch (dbError) {
    console.warn("⚠️ Settings: DB unreachable, using cookie fallback");
  }

  // Fallback: read from the zepply_user cookie set during OAuth callback
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("zepply_user");

  if (userCookie) {
    try {
      const userData = JSON.parse(userCookie.value);
      return NextResponse.json({
        id: userData.id || session?.user?.id || "local_user",
        name: userData.igUsername || session?.user?.name || "User",
        email: null,
        plan: "FREE",
        igAccounts: [
          {
            id: userData.igUserId || "local_ig",
            igUsername: userData.igUsername,
            igProfilePic: userData.profilePic || null,
            followerCount: userData.followers || 0,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    } catch {
      // Cookie parse failed
    }
  }

  // If session exists but no cookie, return minimal user
  if (session?.user) {
    return NextResponse.json({
      id: session.user.id,
      name: session.user.name || "User",
      email: session.user.email,
      plan: "FREE",
      igAccounts: [],
    });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// PUT — Update user settings
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;
    const body = await request.json();

    const user = await db.user.update({
      where: { id: session.user.id },
      data: { name: body.name },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

// DELETE — Delete user account
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;
    const body = await request.json();
    if (body.confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
    }

    await db.user.delete({ where: { id: session.user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
