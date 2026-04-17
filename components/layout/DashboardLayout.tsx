"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  igAccount?: {
    igUsername: string;
    igProfilePic?: string | null;
  } | null;
}

export function DashboardLayout({ children, igAccount }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile nav */}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content area */}
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        )}
      >
        <TopBar
          onMenuClick={() => setMobileNavOpen(true)}
          igAccount={igAccount}
        />
        <main className="p-4 lg:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
