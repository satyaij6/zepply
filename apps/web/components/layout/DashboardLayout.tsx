"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";

export interface ShellAccount {
  igUsername: string;
  igProfilePic?: string | null;
  followerCount?: number;
}

export interface ShellUser {
  name?: string | null;
  plan: "FREE" | "PRO";
  igAccount: ShellAccount | null;
}

const COLLAPSE_KEY = "zepply.sidebar.collapsed";

// Module-level cache — survives page navigations, cleared on full reload
let cachedUser: ShellUser | null = null;

const ShellContext = createContext<ShellUser | null>(null);

/** The signed-in user's name, plan and Instagram account (null while loading). */
export const useShellUser = () => useContext(ShellContext);

/** Dev-only: `?demo=1` under `next dev` shows sample data instead of the database. */
export const isDemo = () => process.env.NODE_ENV === "development" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");

function toShellUser(u: { name?: string | null; plan?: string; igAccounts?: ShellAccount[] }): ShellUser {
  const ig = u.igAccounts?.[0];
  return {
    name: u.name ?? ig?.igUsername ?? null,
    plan: u.plan === "PRO" ? "PRO" : "FREE",
    igAccount: ig ? { igUsername: ig.igUsername, igProfilePic: ig.igProfilePic, followerCount: ig.followerCount } : null,
  };
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ShellUser | null>(cachedUser);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Restore the sidebar preference after hydration (storage can be unavailable)
    let stored = false;
    try {
      stored = localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {}
    if (stored) queueMicrotask(() => setCollapsed(true));

    if (cachedUser) return;
    let alive = true;
    const load = isDemo()
      ? import("@/lib/dashboard-demo").then((m) => m.demoShellUser(new URLSearchParams(window.location.search).get("demo")))
      : fetch("/api/settings")
          .then((r) => (r.ok ? r.json() : null))
          .then((u) => (u ? toShellUser(u) : null));
    load
      .then((u) => {
        if (!alive || !u) return;
        cachedUser = u;
        setUser(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }, []);

  return (
    <ShellContext.Provider value={user}>
      <div className="min-h-screen bg-app-bg text-app-ink" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* One copy of the page; the sidebar offset only applies from lg up */}
        <div className={`transition-[padding] duration-300 ease-out ${collapsed ? "lg:pl-[84px]" : "lg:pl-[260px]"}`}>
          <TopBar onMenuClick={() => setMobileOpen(true)} />
          <main className="mx-auto max-w-[1480px] px-4 pb-14 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
