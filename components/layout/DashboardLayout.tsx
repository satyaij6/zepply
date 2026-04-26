"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  igAccount?: {
    igUsername: string;
    igProfilePic?: string | null;
    followerCount?: number;
  } | null;
}

export function DashboardLayout({ children, igAccount: propIgAccount }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [igAccount, setIgAccount] = useState(propIgAccount || null);

  useEffect(() => {
    if (!propIgAccount) fetchIgAccount();
  }, [propIgAccount]);

  useEffect(() => {
    if (propIgAccount) setIgAccount(propIgAccount);
  }, [propIgAccount]);

  const fetchIgAccount = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const user = await res.json();
        if (user.igAccounts?.[0]) {
          setIgAccount({
            igUsername: user.igAccounts[0].igUsername,
            igProfilePic: user.igAccounts[0].igProfilePic,
            followerCount: user.igAccounts[0].followerCount,
          });
        }
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#F0F4FF]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        igAccount={igAccount}
      />
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:ml-16" : "lg:ml-[240px]")}>
        <TopBar onMenuClick={() => setMobileNavOpen(true)} igAccount={igAccount} />
        <main className="p-6 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
