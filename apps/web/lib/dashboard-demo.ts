/*
 * Sample data for building and reviewing the dashboard without a database.
 * Only reachable under `next dev` with `?demo=1` (an established business) or
 * `?demo=empty` (a brand-new user); both callers check NODE_ENV first.
 */
import type { ShellUser } from "@/components/layout/DashboardLayout";
import type { DayStat, HomeData } from "@/types/dashboard";

const isEmpty = (variant: string | null) => variant === "empty";

export function demoShellUser(variant: string | null): ShellUser {
  return {
    name: "Satya",
    plan: "FREE",
    igAccount: isEmpty(variant) ? null : { igUsername: "thebrewhouse.hyd", igProfilePic: "/landing/latte.jpg", followerCount: 24812 },
  };
}

/** Deterministic pseudo-random numbers, so the sample charts don't change on every reload. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

export function demoHomeData(variant: string | null): HomeData {
  const random = seeded(42);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days: DayStat[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    if (isEmpty(variant)) return { date: d.toISOString().slice(0, 10), dmsSent: 0, leadsCaptured: 0, triggersHit: 0 };
    // A gentle upward trend with weekend bumps and day-to-day noise
    const weekend = [0, 6].includes(d.getUTCDay()) ? 1.35 : 1;
    const dms = Math.round((22 + i * 1.4) * weekend * (0.75 + random() * 0.5));
    return { date: d.toISOString().slice(0, 10), dmsSent: dms, leadsCaptured: Math.round(dms * (0.24 + random() * 0.12)), triggersHit: Math.round(dms * (1.05 + random() * 0.2)) };
  });

  if (isEmpty(variant)) {
    return {
      igAccount: null,
      days,
      totals: { leads: 0, automations: 0, activeAutomations: 0 },
      automations: [],
      recentLeads: [],
      onboarding: { connectInstagram: false, createAutomation: false, firstLead: false },
    };
  }

  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  return {
    igAccount: { igUsername: "thebrewhouse.hyd", igProfilePic: "/landing/latte.jpg", followerCount: 24812 },
    days,
    totals: { leads: 1286, automations: 4, activeAutomations: 3 },
    automations: [
      { id: "a1", name: "Brunch enquiries", type: "COMMENT", keywords: ["brunch", "menu"], isActive: true, hitCount: 412 },
      { id: "a2", name: "Price requests", type: "DM_KEYWORD", keywords: ["price", "cost"], isActive: true, hitCount: 268 },
      { id: "a3", name: "Story replies", type: "STORY_REPLY", keywords: [], isActive: true, hitCount: 131 },
      { id: "a4", name: "Welcome new followers", type: "NEW_FOLLOWER", keywords: [], isActive: false, hitCount: 57 },
    ],
    recentLeads: [
      { id: "l1", igUsername: "priya.s", capturedAt: minutesAgo(4), trigger: { type: "COMMENT", keywords: ["brunch", "menu"] } },
      { id: "l2", igUsername: "rahul_eats", capturedAt: minutesAgo(26), trigger: { type: "DM_KEYWORD", keywords: ["price", "cost"] } },
      { id: "l3", igUsername: "meera.k", capturedAt: minutesAgo(71), trigger: { type: "STORY_REPLY", keywords: [] } },
      { id: "l4", igUsername: "karthik.runs", capturedAt: minutesAgo(180), trigger: { type: "COMMENT", keywords: ["brunch", "menu"] } },
      { id: "l5", igUsername: "sneha.homes", capturedAt: minutesAgo(310), trigger: null },
      { id: "l6", igUsername: "aditi.rao", capturedAt: minutesAgo(1440), trigger: { type: "DM_KEYWORD", keywords: ["price", "cost"] } },
    ],
    onboarding: { connectInstagram: true, createAutomation: true, firstLead: true },
  };
}
