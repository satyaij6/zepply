"use client";

import { cn } from "@/lib/utils";
import { MessageCircle, AtSign, BookOpen, UserPlus } from "lucide-react";

const types = [
  { value: "COMMENT", label: "Comment", icon: MessageCircle, color: "purple" },
  { value: "DM_KEYWORD", label: "DM Keyword", icon: AtSign, color: "blue" },
  { value: "STORY_REPLY", label: "Story Reply", icon: BookOpen, color: "green" },
  { value: "NEW_FOLLOWER", label: "New Follower", icon: UserPlus, color: "orange" },
] as const;

const colorMap: Record<string, string> = {
  purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  green: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
};

const selectedColorMap: Record<string, string> = {
  purple: "border-purple-500 bg-purple-100 text-purple-800 dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200",
  blue: "border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-200",
  green: "border-green-500 bg-green-100 text-green-800 dark:border-green-400 dark:bg-green-900/40 dark:text-green-200",
  orange: "border-orange-500 bg-orange-100 text-orange-800 dark:border-orange-400 dark:bg-orange-900/40 dark:text-orange-200",
};

interface TriggerTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TriggerTypeSelector({ value, onChange }: TriggerTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {types.map((type) => {
        const isSelected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium",
              isSelected ? selectedColorMap[type.color] : colorMap[type.color]
            )}
          >
            <type.icon className="w-4 h-4" />
            {type.label}
          </button>
        );
      })}
    </div>
  );
}

// Small badge for list views
export function TriggerTypeBadge({ type }: { type: string }) {
  const config = types.find((t) => t.value === type);
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        colorMap[config.color]
      )}
    >
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
