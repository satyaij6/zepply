"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Zap, MessageSquare, Calendar, Users, BarChart2,
  Settings, Link2, CreditCard, ChevronLeft, ChevronRight,
} from "lucide-react";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/triggers", label: "Automations", icon: Zap },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/schedule", label: "Schedule", icon: Calendar },
  { href: "/dashboard/leads", label: "Leads & CRM", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
];

const settingsNav = [
  { href: "/dashboard/settings", label: "Instagram Account", icon: Link2 },
  { href: "/dashboard/upgrade", label: "Billing", icon: CreditCard },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  igAccount?: {
    igUsername: string;
    igProfilePic?: string | null;
    followerCount?: number;
  } | null;
}

export function Sidebar({ collapsed, onToggle, igAccount }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-[#E5E7EB] z-40 transition-all duration-300 hidden lg:flex flex-col",
        collapsed ? "w-16" : "w-[240px]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#3D7EFF] shadow-sm z-10 transition-colors"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />
        }
      </button>

      {/* Logo */}
      <div className={cn("flex items-center gap-2 pt-[22px] pb-4 flex-shrink-0", collapsed ? "px-4 justify-center" : "px-5")}>
        <div className="w-8 h-8 rounded-lg bg-[#3D7EFF] flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {!collapsed && (
          <Link href="/dashboard" className="text-xl font-extrabold text-[#0F1B4C]">
            zep<span className="text-[#3D7EFF]">ply</span>
          </Link>
        )}
      </div>

      {/* Connected account pill */}
      {igAccount && !collapsed && (
        <div className="mx-3 mb-4 px-3 py-2 bg-[#F0FDF4] rounded-xl flex items-center gap-2 overflow-hidden flex-shrink-0">
          <span className="w-2 h-2 bg-[#22C55E] rounded-full flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#0F1B4C] truncate">@{igAccount.igUsername}</p>
            <span className="text-[11px] text-[#22C55E]">Connected ✓</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
        {/* Main group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest px-3 pt-3 pb-1.5">
            Main
          </p>
        )}
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border-l-[3px]",
                isActive(item.href)
                  ? "bg-[#EEF2FF] text-[#3D7EFF] border-[#3D7EFF]"
                  : "text-[#6B7280] hover:bg-[#F9FAFB] border-transparent"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>

        {/* Settings group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest px-3 pt-4 pb-1.5">
            Settings
          </p>
        )}
        <div className="space-y-0.5 mt-2">
          {settingsNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border-l-[3px]",
                isActive(item.href) && item.href === pathname
                  ? "bg-[#EEF2FF] text-[#3D7EFF] border-[#3D7EFF]"
                  : "text-[#6B7280] hover:bg-[#F9FAFB] border-transparent"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-[#E5E7EB] flex items-center gap-2.5 flex-shrink-0 overflow-hidden",
        collapsed ? "p-3 justify-center" : "p-3"
      )}>
        <div className="w-8 h-8 rounded-full bg-[#A78BFA] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {igAccount?.igUsername?.charAt(0).toUpperCase() || "U"}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0F1B4C] truncate">
                {igAccount?.igUsername ? `@${igAccount.igUsername}` : "User"}
              </p>
              <p className="text-[11px] text-[#9CA3AF]">Creator Plan</p>
            </div>
            <Link href="/dashboard/settings" className="text-[#9CA3AF] hover:text-[#0F1B4C] transition-colors">
              <Settings className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
