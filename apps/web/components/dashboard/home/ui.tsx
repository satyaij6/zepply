import { CircleDot, MessageCircle, MessageSquareText, UserPlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DayStat, TriggerKind } from "@/types/dashboard";

export const KIND: Record<TriggerKind, { label: string; icon: LucideIcon }> = {
  COMMENT: { label: "Comment", icon: MessageCircle },
  DM_KEYWORD: { label: "DM keyword", icon: MessageSquareText },
  STORY_REPLY: { label: "Story reply", icon: CircleDot },
  NEW_FOLLOWER: { label: "New follower", icon: UserPlus },
};

export type Metric = keyof Omit<DayStat, "date">;

export const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const number = (n: number) => n.toLocaleString("en-IN");
export const sum = (days: DayStat[], metric: Metric) => days.reduce((total, d) => total + d[metric], 0);

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-app-line bg-app-card ${className}`}>{children}</section>;
}

export function CardHeader({ title, aside, children }: { title: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}
