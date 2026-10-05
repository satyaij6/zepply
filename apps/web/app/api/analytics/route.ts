import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Fetch analytics by date range
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "7d";

  let daysBack = 7;
  if (range === "30d") daysBack = 30;
  if (range === "90d") daysBack = 90;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  // Get user's IG accounts
  const igAccounts = await prisma.instagramAccount.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const igAccountIds = igAccounts.map((a) => a.id);

  // Analytics data
  const analytics = await prisma.analytics.findMany({
    where: {
      igAccountId: { in: igAccountIds },
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  // Triggers by type breakdown
  const triggersByType = await prisma.trigger.groupBy({
    by: ["type"],
    where: { igAccountId: { in: igAccountIds } },
    _sum: { hitCount: true },
  });

  // Top triggers
  const topTriggers = await prisma.trigger.findMany({
    where: {
      igAccountId: { in: igAccountIds },
      hitCount: { gt: 0 },
    },
    include: {
      _count: { select: { leads: true } },
    },
    orderBy: { hitCount: "desc" },
    take: 5,
  });

  // Totals for the period
  const totals = analytics.reduce(
    (acc, a) => ({
      triggersHit: acc.triggersHit + a.triggersHit,
      leadsCaptured: acc.leadsCaptured + a.leadsCaptured,
      dmsSent: acc.dmsSent + a.dmsSent,
    }),
    { triggersHit: 0, leadsCaptured: 0, dmsSent: 0 }
  );

  // Most triggered keyword
  const allTriggers = await prisma.trigger.findMany({
    where: {
      igAccountId: { in: igAccountIds },
      hitCount: { gt: 0 },
    },
    select: { keywords: true, hitCount: true },
    orderBy: { hitCount: "desc" },
    take: 1,
  });

  const topKeyword =
    allTriggers[0]?.keywords?.[0] || "N/A";

  return NextResponse.json({
    daily: analytics,
    triggersByType,
    topTriggers,
    totals: { ...totals, topKeyword },
  });
}
