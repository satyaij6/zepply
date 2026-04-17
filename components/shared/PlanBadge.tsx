"use client";

import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: "FREE" | "PRO";
  className?: string;
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        plan === "PRO"
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        className
      )}
    >
      {plan}
    </span>
  );
}
