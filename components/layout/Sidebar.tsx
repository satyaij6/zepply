"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/triggers", label: "Triggers", icon: Zap },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 z-40 transition-all duration-300 hidden lg:flex flex-col",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Zepply</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-purple-600 dark:text-purple-400")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Free Plan</p>
            <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Upgrade for AI replies</p>
            <Link
              href="/dashboard/upgrade"
              className="mt-2 block text-center text-xs font-medium bg-purple-600 text-white rounded-md py-1.5 hover:bg-purple-700 transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
