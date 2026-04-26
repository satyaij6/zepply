"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { X, LayoutDashboard, Zap, Users, BarChart2, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/triggers", label: "Automations", icon: Zap },
  { href: "/dashboard/leads", label: "Leads & CRM", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      <div className="fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 lg:hidden flex flex-col">
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#E5E7EB]">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-7 h-7 rounded-lg bg-[#3D7EFF] flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-extrabold text-[#0F1B4C]">
              zep<span className="text-[#3D7EFF]">ply</span>
            </span>
          </Link>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-[#6B7280]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border-l-[3px]",
                  active
                    ? "bg-[#EEF2FF] text-[#3D7EFF] border-[#3D7EFF]"
                    : "text-[#6B7280] hover:bg-[#F9FAFB] border-transparent"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
