"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { CreditCard, LogOut, Menu, Plus, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShellUser, type ShellAccount } from "./DashboardLayout";

const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const user = useShellUser();

  return (
    <header className="sticky top-0 z-30 bg-app-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" aria-label="Open menu" onClick={onMenuClick} className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-line bg-app-card text-app-ink lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        {user ? <AccountChip account={user.igAccount} /> : <span className="h-12 w-52 animate-pulse rounded-2xl bg-app-line/70" />}
        <div className="ml-auto">{user && <ProfileMenu name={user.name ?? user.igAccount?.igUsername ?? "You"} picture={user.igAccount?.igProfilePic} />}</div>
      </div>
    </header>
  );
}

/** The connected Instagram account, or a prompt to connect one. */
function AccountChip({ account }: { account: ShellAccount | null }) {
  if (!account) {
    return (
      <a href="/api/instagram/connect" className="flex h-11 items-center gap-2 rounded-2xl bg-app-ink px-4 text-sm font-semibold text-white transition hover:bg-black">
        <Plus className="h-4 w-4" /> Connect Instagram
      </a>
    );
  }
  return (
    <Link href="/dashboard/settings" className="flex min-w-0 items-center gap-3 rounded-2xl border border-app-line bg-app-card py-1.5 pl-1.5 pr-4 transition hover:border-[#D8D5CD]">
      <Avatar name={account.igUsername} picture={account.igProfilePic} className="h-9 w-9 rounded-xl" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">@{account.igUsername}</span>
        <span className="block text-xs text-app-muted">Instagram{account.followerCount ? ` · ${compact(account.followerCount)} followers` : ""}</span>
      </span>
    </Link>
  );
}

function ProfileMenu({ name, picture }: { name: string; picture?: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-app-ink transition hover:bg-app-bg";

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-full ring-2 ring-transparent transition hover:ring-app-line">
        <Avatar name={name} picture={picture} className="h-11 w-11 rounded-full" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-60 rounded-2xl border border-app-line bg-app-card p-1.5 shadow-[0_20px_50px_-20px_rgba(20,20,30,0.35)]">
          <p className="truncate px-3 pb-2 pt-2.5 text-sm font-semibold">{name}</p>
          <Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)} className={item}>
            <Settings className="h-4 w-4 text-app-muted" /> Settings
          </Link>
          <Link role="menuitem" href="/dashboard/upgrade" onClick={() => setOpen(false)} className={item}>
            <CreditCard className="h-4 w-4 text-app-muted" /> Plan & billing
          </Link>
          <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={item}>
            <LogOut className="h-4 w-4 text-app-muted" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, picture, className }: { name: string; picture?: string | null; className: string }) {
  if (picture) return <Image src={picture} alt="" width={44} height={44} className={`${className} object-cover`} />;
  return <span className={`${className} flex items-center justify-center bg-electric-wash text-sm font-semibold uppercase text-electric-deep`}>{name.replace("@", "").charAt(0)}</span>;
}
