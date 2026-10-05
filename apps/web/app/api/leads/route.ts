import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — List leads with optional filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: any = {
    igAccount: { userId: session.user.id },
  };

  if (search) {
    where.igUsername = { contains: search, mode: "insensitive" };
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        trigger: { select: { type: true, keywords: true } },
        igAccount: { select: { igUsername: true } },
      },
      orderBy: { capturedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    leads,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
