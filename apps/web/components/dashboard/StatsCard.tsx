"use client";

import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  className?: string;
}

export function StatsCard({ label, value, icon, trend, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {trend && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{trend}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
          {icon}
        </div>
      </div>
    </div>
  );
}
