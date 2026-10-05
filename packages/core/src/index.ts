// Product rules shared by web, mobile and the API (spec §5.7: "same words,
// same states"). Never hard-code these in an app.

export const workspaceTypes = ["creator", "business"] as const;
export type WorkspaceType = (typeof workspaceTypes)[number];

export const contentTypes = ["post", "carousel", "story", "reel", "clip"] as const;
export type ContentType = (typeof contentTypes)[number];

// Lifecycle from spec §6.2.
export const contentStatuses = [
  "draft",
  "generating",
  "in_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "failed",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: "Draft",
  generating: "Generating",
  in_review: "Waiting for approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
  failed: "Failed",
};

export const memberRoles = ["owner", "admin", "editor", "viewer"] as const;
export type MemberRole = (typeof memberRoles)[number];

// Roles that may spend credits or approve content (spec M1 acceptance criteria).
export function canSpendCredits(role: MemberRole): boolean {
  return role !== "viewer";
}
