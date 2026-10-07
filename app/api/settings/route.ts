import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GET — Get user settings
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error("Settings failed:", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
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
