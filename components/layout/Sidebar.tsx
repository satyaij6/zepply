"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: "/icons/sidebar/dashboard-active.svg", iconSize: 16 },
  { href: "/dashboard/triggers", label: "Automations", icon: "/icons/sidebar/automation.svg" },
  { href: "/dashboard/leads", label: "Leads", icon: "/icons/sidebar/leads.svg" },
  { href: "/dashboard/analytics", label: "AI Automations", icon: "/icons/sidebar/ai-automation.svg", iconSize: 16 },
];

const settingsNav = [
  { href: "/dashboard/upgrade", label: "Billing", icon: "/icons/sidebar/billing.svg" },
  { href: "/dashboard/settings", label: "Settings", icon: "/icons/sidebar/settings.png" },
  { href: "/dashboard/feedback", label: "Feedback", icon: "/icons/sidebar/feedback.png" },
];

interface SidebarProps {
  igAccount?: { igUsername: string; igProfilePic?: string | null } | null;
  pinned?: boolean;
  onPinToggle?: () => void;
}

// Module-level: survives component remounts caused by Next.js page navigation
let _hovered = false;

export function Sidebar({ igAccount, pinned = false, onPinToggle }: SidebarProps) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  // Initialize from the module-level flag so sidebar stays expanded after navigation remount
  const [hovered, setHovered] = useState(_hovered);

  // On remount, verify mouse is still over the sidebar on the first movement.
  useEffect(() => {
    if (!_hovered) return;
    const checkPosition = (e: MouseEvent) => {
      if (!ref.current) return;
      const { left, right, top, bottom } = ref.current.getBoundingClientRect();
      const over = e.clientX >= left && e.clientX <= right
                && e.clientY >= top  && e.clientY <= bottom;
      if (!over) { _hovered = false; setHovered(false); }
    };
    window.addEventListener("mousemove", checkPosition, { once: true });
    return () => window.removeEventListener("mousemove", checkPosition);
  }, []);

  const onEnter = () => { _hovered = true; setHovered(true); };
  const onLeave = () => {
    if (pinned) return;
    _hovered = false;
    setHovered(false);
  };

  // When pinned the sidebar is always expanded regardless of hover
  const expanded = pinned || hovered;

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const avatarLetter = igAccount?.igUsername?.charAt(0).toUpperCase() || "R";

  // Labels: fade in when expanded, disappear instantly when collapsing
  const labelStyle: React.CSSProperties = {
    opacity: expanded ? 1 : 0,
    transition: expanded ? "opacity 0.15s ease 0.06s" : "opacity 0.06s ease",
    whiteSpace: "nowrap",
  };

  return (
    <aside
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed left-0 top-0 h-full bg-white z-40 hidden lg:flex flex-col py-5 overflow-hidden"
      style={{
        width: expanded ? 240 : 72,
        borderRight: "0.5px solid #D9D9D9",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center mb-5 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center flex-1 min-w-0">
          {/* Fixed 72px zone keeps the icon perfectly centered when collapsed */}
          <span className="flex-shrink-0 w-[72px] flex items-center justify-center">
            <Image
              src="/icons/sidebar/zepply-logo.png"
              alt="Zepply"
              width={16}
              height={16}
              className="object-contain"
            />
          </span>
          <span
            className="text-[22px] text-[#1A1A1A]"
            style={{ ...labelStyle, fontFamily: "Glitz, sans-serif", marginLeft: -26, marginTop: 10 }}
          >
            epply
          </span>
        </Link>
        <span
          className="flex-shrink-0 pr-5 flex items-center"
          style={{
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? "auto" : "none",
            transition: expanded ? "opacity 0.2s ease 0.06s" : "opacity 0.08s ease",
          }}
        >
          {pinned ? (
            <PinOff
              size={16}
              onClick={onPinToggle}
              className="text-[#2564FF] hover:text-[#1a4fd6] cursor-pointer transition-all duration-150 active:scale-95"
            />
          ) : (
            <Pin
              size={16}
              onClick={onPinToggle}
              className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer transition-all duration-150 active:scale-95"
            />
          )}
        </span>
      </div>

      {/* ── User Profile ── */}
      <div
        className="flex items-center gap-2.5 rounded-xl mx-3 mb-5 flex-shrink-0"
        style={{
          padding: "8px 10px",
          minWidth: 214,
          background: expanded ? "#F7F7F7" : "transparent",
          transition: "background 0.2s ease",
        }}
      >
        <div className="flex-shrink-0">
          {igAccount?.igProfilePic ? (
            <Image
              src={igAccount.igProfilePic}
              alt={igAccount.igUsername}
              width={34}
              height={34}
              className="rounded-full object-cover"
              style={{ width: 34, height: 34 }}
            />
          ) : (
            <div
              className="rounded-full bg-[#E8D5F5] flex items-center justify-center"
              style={{ width: 34, height: 34 }}
            >
              <span className="text-[13px] font-medium text-[#7C3AED]">{avatarLetter}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0" style={labelStyle}>
          <p className="text-[12.5px] font-semibold text-[#111827] truncate leading-tight">
            {igAccount?.igUsername || "riya.realty"}
          </p>
          <p className="text-[11px] text-[#6B7280] truncate leading-tight mt-0.5">
            {igAccount?.igUsername
              ? `${igAccount.igUsername} | creator`
              : "Riya mehra | content..."}
          </p>
        </div>

        <ChevronDown
          className="flex-shrink-0 text-[#9CA3AF]"
          style={{ ...labelStyle, width: 14, height: 14 }}
        />
      </div>

      {/* ── MAIN label ── */}
      <p
        className="mb-1 flex-shrink-0 text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase"
        style={{ ...labelStyle, paddingLeft: 20, minWidth: 240 }}
      >
        Main
      </p>

      {/* ── Main Nav ── */}
      <nav className="flex flex-col gap-0.5 px-3 flex-shrink-0">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center h-10 rounded-xl transition-colors duration-150",
                active ? "bg-[#CDE0FF]" : "hover:bg-[#F5F5F5]"
              )}
              style={{ paddingLeft: 8, gap: 10, minWidth: 214 }}
            >
              <span className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center">
                <Image
                  src={item.icon}
                  alt={item.label}
                  width={item.iconSize ?? 20}
                  height={item.iconSize ?? 20}
                  className="object-contain"
                  style={
                    active
                      ? { filter: "brightness(0) saturate(100%) invert(44%) sepia(97%) saturate(1030%) hue-rotate(200deg) brightness(108%)" }
                      : { filter: "grayscale(100%) opacity(45%)" }
                  }
                />
              </span>
              <span
                className={cn("text-[13px] font-medium", active ? "text-[#2564FF]" : "text-[#374151]")}
                style={labelStyle}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-5 my-3 border-t border-[#EBEBEB] flex-shrink-0" />

      {/* ── ACCOUNT label ── */}
      <p
        className="mb-1 flex-shrink-0 text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase"
        style={{ ...labelStyle, paddingLeft: 20, minWidth: 240 }}
      >
        Account
      </p>

      {/* ── Settings Nav ── */}
      <nav className="flex flex-col gap-0.5 px-3 flex-shrink-0">
        {settingsNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center h-10 rounded-xl transition-colors duration-150",
                active ? "bg-[#CDE0FF]" : "hover:bg-[#F5F5F5]"
              )}
              style={{ paddingLeft: 8, gap: 10, minWidth: 214 }}
            >
              <span className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center">
                <Image
                  src={item.icon}
                  alt={item.label}
                  width={20}
                  height={20}
                  className="object-contain"
                  style={
                    active
                      ? { filter: "brightness(0) saturate(100%) invert(44%) sepia(97%) saturate(1030%) hue-rotate(200deg) brightness(108%)" }
                      : { filter: "grayscale(100%) opacity(45%)" }
                  }
                />
              </span>
              <span
                className={cn("text-[13px] font-medium", active ? "text-[#2564FF]" : "text-[#374151]")}
                style={labelStyle}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Upgrade section ── */}
      <div className="flex-shrink-0 px-3 pb-2 relative">
        {/* Dark card — visible when expanded */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: "linear-gradient(145deg, #2A62E7 0%, #131726 100%)",
            minWidth: 214,
            opacity: expanded ? 1 : 0,
            transition: expanded ? "opacity 0.2s ease 0.06s" : "opacity 0.08s ease",
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <Image
              src="/icons/sidebar/upgrade-pro.png"
              alt="Pro"
              width={18}
              height={18}
              className="object-contain brightness-0 invert"
            />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white leading-snug">Upgrade to Pro</p>
            <p className="text-[11px] leading-snug mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
              upgrade your account and unlock all the benefits
            </p>
          </div>
          <Link
            href="/dashboard/upgrade"
            className="block py-2.5 rounded-xl text-[12px] font-bold text-center transition-opacity hover:opacity-90"
            style={{
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            UPGRADE PRO
          </Link>
        </div>

        {/* Blue circle — visible when collapsed, top-aligned to match icon position inside card (card p-4) */}
        <div
          className="absolute inset-x-0 top-0 flex justify-center pt-4"
          style={{
            opacity: expanded ? 0 : 1,
            transition: "opacity 0.08s ease",
            pointerEvents: expanded ? "none" : "auto",
          }}
        >
          <Link
            href="/dashboard/upgrade"
            title="Upgrade to Pro"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
            style={{ background: "#2564FF" }}
          >
            <Image
              src="/icons/sidebar/upgrade-pro.png"
              alt="Upgrade"
              width={18}
              height={18}
              className="object-contain brightness-0 invert"
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
