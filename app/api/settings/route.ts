import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Get user settings
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
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

  return NextResponse.json(user);
}

// PUT — Update user settings
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name,
    },
  });

  return NextResponse.json(user);
}

// DELETE — Delete user account
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
