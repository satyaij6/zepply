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
  purple: "border-[#E9D5FF] bg-[#F3E8FF] text-[#7C3AED]",
  blue: "border-[#BFDBFE] bg-[#EEF2FF] text-[#3D7EFF]",
  green: "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]",
  orange: "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
};

const selectedColorMap: Record<string, string> = {
  purple: "border-[#7C3AED] bg-[#EDE9FE] text-[#6D28D9]",
  blue: "border-[#3D7EFF] bg-[#DBEAFE] text-[#1D4ED8]",
  green: "border-[#22C55E] bg-[#DCFCE7] text-[#15803D]",
  orange: "border-[#EA580C] bg-[#FFEDD5] text-[#C2410C]",
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
