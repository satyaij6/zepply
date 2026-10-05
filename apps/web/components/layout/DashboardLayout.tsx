"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";

interface IgAccount {
  igUsername: string;
  igProfilePic?: string | null;
  followerCount?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  igAccount?: IgAccount | null;
}

// Module-level cache — survives page navigations, cleared on full reload
let cachedIgAccount: IgAccount | null = null;
let fetchPromise: Promise<void> | null = null;

function fetchAndCache(set: (v: IgAccount) => void) {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/settings")
    .then((r) => r.ok ? r.json() : null)
    .then((user) => {
      if (user?.igAccounts?.[0]) {
        cachedIgAccount = {
          igUsername: user.igAccounts[0].igUsername,
          igProfilePic: user.igAccounts[0].igProfilePic,
          followerCount: user.igAccounts[0].followerCount,
        };
        set(cachedIgAccount);
      }
    })
    .catch(() => {})
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

export function DashboardLayout({ children, igAccount: propIgAccount }: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [igAccount, setIgAccount] = useState<IgAccount | null>(propIgAccount || cachedIgAccount || null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (propIgAccount) {
      cachedIgAccount = propIgAccount;
      setIgAccount(propIgAccount);
    } else if (!cachedIgAccount) {
      fetchAndCache(setIgAccount);
    }
  }, [propIgAccount]);

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Sidebar
        igAccount={igAccount}
        pinned={pinned}
        onPinToggle={() => setPinned((p) => !p)}
      />
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content: shifts right when sidebar is pinned */}
      <div
        style={{
          marginLeft: pinned ? 240 : 72,
          transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className="hidden lg:block"
      >
        <TopBar onMenuClick={() => setMobileNavOpen(true)} igAccount={igAccount} />
        <main className="px-10 pb-8 max-w-[1400px] mx-auto">{children}</main>
      </div>

      {/* Mobile: no sidebar offset */}
      <div className="lg:hidden">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} igAccount={igAccount} />
        <main className="px-4 pb-8">{children}</main>
      </div>
    </div>
  );
}
