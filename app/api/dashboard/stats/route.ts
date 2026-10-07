import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GET — Dashboard stats for today
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prismaModule = await import("@/lib/prisma");
    const db = prismaModule.default;

    const igAccounts = await db.instagramAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, igUsername: true, igProfilePic: true, followerCount: true },
    });

    const igAccountIds = igAccounts.map((a: any) => a.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAnalytics = await db.analytics.findMany({
      where: {
        igAccountId: { in: igAccountIds },
        date: { gte: today },
      },
    });

    const triggersToday = todayAnalytics.reduce((s: number, a: any) => s + a.triggersHit, 0);
    const dmsToday = todayAnalytics.reduce((s: number, a: any) => s + a.dmsSent, 0);

    const totalLeads = await db.lead.count({
      where: { igAccountId: { in: igAccountIds } },
    });

    const activeTriggers = await db.trigger.count({
      where: {
        igAccountId: { in: igAccountIds },
        isActive: true,
      },
    });

    const recentActivity = await db.lead.findMany({
      where: { igAccountId: { in: igAccountIds } },
      include: {
        trigger: { select: { type: true, keywords: true } },
      },
      orderBy: { capturedAt: "desc" },
      take: 10,
    });

    const hasIgAccount = igAccounts.length > 0;
    const hasTrigger = activeTriggers > 0;
    const hasLead = totalLeads > 0;

    return NextResponse.json({
      stats: { triggersToday, totalLeads, dmsToday, activeTriggers },
      igAccount: igAccounts[0] || null,
      recentActivity,
      onboarding: {
        connectInstagram: hasIgAccount,
        createTrigger: hasTrigger,
        getFirstLead: hasLead,
        upgradePro: false,
      },
    });
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
