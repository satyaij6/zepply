import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import type { DayStat, HomeData } from "@/types/dashboard";

const DAYS = 30;

/** The last DAYS calendar days (UTC, oldest first), all zero. */
function emptyDays(): DayStat[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    return { date: d.toISOString().slice(0, 10), dmsSent: 0, leadsCaptured: 0, triggersHit: 0 };
  });
}

// GET — Everything the dashboard Home shows, in one request
export async function GET(request: NextRequest) {
  // Dev-only sample data: /dashboard?demo=1 (full) or ?demo=empty (brand-new user)
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("demo")) {
    const { demoHomeData } = await import("@/lib/dashboard-demo");
    return NextResponse.json(demoHomeData(request.nextUrl.searchParams.get("demo")));
  }

  const session = await auth().catch(() => null);
  const days = emptyDays();

  // Try database first
  try {
    const db = (await import("@/lib/prisma")).default;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await db.instagramAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, igUsername: true, igProfilePic: true, followerCount: true },
      orderBy: { createdAt: "asc" },
    });
    const mine = { igAccountId: { in: accounts.map((a) => a.id) } };

    const [analytics, leadCount, automationCount, activeCount, automations, recentLeads] = await Promise.all([
      db.analytics.findMany({
        where: { ...mine, date: { gte: new Date(`${days[0].date}T00:00:00Z`) } },
        select: { date: true, dmsSent: true, leadsCaptured: true, triggersHit: true },
      }),
      db.lead.count({ where: mine }),
      db.trigger.count({ where: mine }),
      db.trigger.count({ where: { ...mine, isActive: true } }),
      db.trigger.findMany({
        where: mine,
        select: { id: true, name: true, type: true, keywords: true, isActive: true, hitCount: true },
        orderBy: [{ isActive: "desc" }, { hitCount: "desc" }],
        take: 5,
      }),
      db.lead.findMany({
        where: mine,
        select: { id: true, igUsername: true, capturedAt: true, trigger: { select: { type: true, keywords: true } } },
        orderBy: { capturedAt: "desc" },
        take: 6,
      }),
    ]);

    // Fold the analytics rows (one per account per day) into the day buckets
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const row of analytics) {
      const day = byDate.get(row.date.toISOString().slice(0, 10));
      if (!day) continue;
      day.dmsSent += row.dmsSent;
      day.leadsCaptured += row.leadsCaptured;
      day.triggersHit += row.triggersHit;
    }

    const ig = accounts[0] ?? null;
    const data: HomeData = {
      igAccount: ig && { igUsername: ig.igUsername, igProfilePic: ig.igProfilePic, followerCount: ig.followerCount },
      days,
      totals: { leads: leadCount, automations: automationCount, activeAutomations: activeCount },
      automations,
      recentLeads: recentLeads.map((l) => ({ ...l, capturedAt: l.capturedAt.toISOString() })),
      onboarding: { connectInstagram: accounts.length > 0, createAutomation: automationCount > 0, firstLead: leadCount > 0 },
    };
    return NextResponse.json(data);
  } catch {
    console.warn("⚠️ Dashboard home: DB unreachable, using cookie fallback");
  }

  // Fallback: read the IG account from the zepply_user cookie set during OAuth callback
  let igAccount: HomeData["igAccount"] = null;
  const userCookie = (await cookies()).get("zepply_user");
  if (userCookie) {
    try {
      const u = JSON.parse(userCookie.value);
      if (u.igUsername) igAccount = { igUsername: u.igUsername, igProfilePic: u.profilePic || null, followerCount: u.followers || 0 };
    } catch {
      // Cookie parse failed
    }
  }

  const data: HomeData = {
    igAccount,
    days,
    totals: { leads: 0, automations: 0, activeAutomations: 0 },
    automations: [],
    recentLeads: [],
    onboarding: { connectInstagram: !!igAccount, createAutomation: false, firstLead: false },
  };
  return NextResponse.json(data);
}
