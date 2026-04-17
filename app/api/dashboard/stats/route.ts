import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Dashboard stats for today
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const igAccounts = await prisma.instagramAccount.findMany({
    where: { userId: session.user.id },
    select: { id: true, igUsername: true, igProfilePic: true, followerCount: true },
  });

  const igAccountIds = igAccounts.map((a) => a.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's analytics
  const todayAnalytics = await prisma.analytics.findMany({
    where: {
      igAccountId: { in: igAccountIds },
      date: { gte: today },
    },
  });

  const triggersToday = todayAnalytics.reduce((s, a) => s + a.triggersHit, 0);
  const dmsToday = todayAnalytics.reduce((s, a) => s + a.dmsSent, 0);

  // Total leads
  const totalLeads = await prisma.lead.count({
    where: { igAccountId: { in: igAccountIds } },
  });

  // Active triggers
  const activeTriggers = await prisma.trigger.count({
    where: {
      igAccountId: { in: igAccountIds },
      isActive: true,
    },
  });

  // Recent activity (last 10 leads = last 10 trigger events)
  const recentActivity = await prisma.lead.findMany({
    where: { igAccountId: { in: igAccountIds } },
    include: {
      trigger: { select: { type: true, keywords: true } },
    },
    orderBy: { capturedAt: "desc" },
    take: 10,
  });

  // Onboarding status
  const hasIgAccount = igAccounts.length > 0;
  const hasTriger = activeTriggers > 0;
  const hasLead = totalLeads > 0;

  return NextResponse.json({
    stats: {
      triggersToday,
      totalLeads,
      dmsToday,
      activeTriggers,
    },
    igAccount: igAccounts[0] || null,
    recentActivity,
    onboarding: {
      connectInstagram: hasIgAccount,
      createTrigger: hasTriger,
      getFirstLead: hasLead,
      upgradePro: false,
    },
  });
}
