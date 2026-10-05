/** Shape of GET /api/dashboard/home — everything the Home page shows, in one request. */

export type TriggerKind = "COMMENT" | "DM_KEYWORD" | "STORY_REPLY" | "NEW_FOLLOWER";

/** One calendar day (UTC) of activity across the user's accounts. */
export type DayStat = { date: string; dmsSent: number; leadsCaptured: number; triggersHit: number };

export type HomeAutomation = { id: string; name: string | null; type: TriggerKind; keywords: string[]; isActive: boolean; hitCount: number };

export type HomeLead = { id: string; igUsername: string; capturedAt: string; trigger: { type: TriggerKind; keywords: string[] } | null };

export type HomeData = {
  igAccount: { igUsername: string; igProfilePic: string | null; followerCount: number } | null;
  /** The last 30 days, oldest first, with empty days filled in as zeros. */
  days: DayStat[];
  totals: { leads: number; automations: number; activeAutomations: number };
  /** Up to 5 automations: active first, then most fired. */
  automations: HomeAutomation[];
  /** Up to 6 most recent leads. */
  recentLeads: HomeLead[];
  onboarding: { connectInstagram: boolean; createAutomation: boolean; firstLead: boolean };
};
