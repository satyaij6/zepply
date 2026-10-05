"use client";

import { timeAgo } from "@/lib/utils";
import { MessageCircle, AtSign, BookOpen, UserPlus } from "lucide-react";

interface ActivityItem {
  id: string;
  igUsername: string;
  capturedAt: string;
  trigger?: {
    type: string;
    keywords: string[];
  } | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  COMMENT: <MessageCircle className="w-4 h-4 text-purple-500" />,
  DM_KEYWORD: <AtSign className="w-4 h-4 text-blue-500" />,
  STORY_REPLY: <BookOpen className="w-4 h-4 text-green-500" />,
  NEW_FOLLOWER: <UserPlus className="w-4 h-4 text-orange-500" />,
};

const typeLabels: Record<string, string> = {
  COMMENT: "comment",
  DM_KEYWORD: "DM",
  STORY_REPLY: "story reply",
  NEW_FOLLOWER: "follow",
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
        No activity yet. Create a trigger to get started!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const type = item.trigger?.type || "COMMENT";
        const keyword = item.trigger?.keywords?.[0] || "";

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              {typeIcons[type] || typeIcons.COMMENT}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                Replied to{" "}
                <span className="font-semibold">@{item.igUsername}</span>
                &apos;s {typeLabels[type] || "interaction"}
                {keyword && (
                  <>
                    {" "}with keyword{" "}
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {keyword}
                    </span>
                  </>
                )}
              </p>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {timeAgo(item.capturedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
