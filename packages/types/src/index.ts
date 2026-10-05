// One definition of each entity and API payload, used by web, mobile and the
// API (spec §6). Add entities here as their tickets land.
import { z } from "zod";
import { contentStatuses, contentTypes, memberRoles, workspaceTypes } from "@zepply/core";

export const WorkspaceSchema = z.object({
  id: z.uuid(),
  type: z.enum(workspaceTypes),
  name: z.string().min(1),
  primaryLanguages: z.array(z.string()).default(["en"]),
  timezone: z.string().default("Asia/Kolkata"),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const MemberSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.string(),
  role: z.enum(memberRoles),
});
export type Member = z.infer<typeof MemberSchema>;

export const ContentItemSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  type: z.enum(contentTypes),
  status: z.enum(contentStatuses),
  caption: z.string().default(""),
  language: z.string().default("en"),
  scheduledAt: z.iso.datetime().nullable().default(null),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;
