"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { X, LayoutDashboard, Zap, Users, BarChart3, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/triggers", label: "Triggers", icon: Zap },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
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
      <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-gray-950 z-50 lg:hidden">
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Zepply</span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
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
