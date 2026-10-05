"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Sparkles, X } from "lucide-react";
import { useShellUser } from "./DashboardLayout";
import { FOOTER_NAV, MAIN_NAV, SOON_NAV, isActive, type NavItem } from "./nav";

/** Desktop sidebar: fixed on the left, expanded (260px) or collapsed to icons (84px). */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 ease-out lg:block ${collapsed ? "w-[84px]" : "w-[260px]"}`}>
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}

/** The sidebar's contents, shared with the mobile drawer. */
export function SidebarContent({ collapsed = false, onToggle, onClose, onNavigate }: { collapsed?: boolean; onToggle?: () => void; onClose?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useShellUser();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-app-side px-3 pb-4 pt-5 [scrollbar-width:none]">
      <div className={`flex h-10 items-center ${collapsed ? "justify-center" : "justify-between pl-3"}`}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="Zepply home" className="flex items-center">
          {collapsed ? (
            <Image src="/icons/sidebar/zepply-logo.png" alt="" width={20} height={28} />
          ) : (
            <span className="text-[26px] leading-none text-white" style={{ fontFamily: "'Glitz', 'Poppins', sans-serif" }}>
              Zepply
            </span>
          )}
        </Link>
        {onClose ? (
          <IconButton label="Close menu" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        ) : (
          !collapsed &&
          onToggle && (
            <IconButton label="Collapse sidebar" onClick={onToggle}>
              <ChevronsLeft className="h-4 w-4" />
            </IconButton>
          )
        )}
      </div>
      {collapsed && onToggle && (
        <div className="mt-3 flex justify-center">
          <IconButton label="Expand sidebar" onClick={onToggle}>
            <ChevronsRight className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      <nav aria-label="Main" className="mt-8 space-y-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-8">
        {!collapsed && <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">Coming soon</p>}
        <ul className="space-y-1">
          {SOON_NAV.map(({ label, icon: Icon }) => (
            <li
              key={label}
              title={collapsed ? `${label} — coming soon` : undefined}
              className={`flex h-10 cursor-default items-center gap-3 rounded-xl text-[15px] text-zinc-600 ${collapsed ? "justify-center" : "px-3"}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              {collapsed && <span className="sr-only">{label}, coming soon</span>}
              {!collapsed && (
                <>
                  {label}
                  <span className="ml-auto rounded-full border border-white/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">Soon</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto space-y-1 pt-8">
        {!collapsed && user && <PlanCard plan={user.plan} onNavigate={onNavigate} />}
        <div className={`${!collapsed && user ? "mt-4 border-t border-white/[0.07] pt-4" : ""} space-y-1`}>
          {FOOTER_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} quiet />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, active, collapsed, onNavigate, quiet = false }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void; quiet?: boolean }) {
  const { href, label, icon: Icon } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 rounded-xl font-medium transition ${quiet ? "h-10 text-sm" : "h-11 text-[15px]"} ${collapsed ? "justify-center" : "px-3"} ${
        active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {active && <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-electric" />}
      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      {!collapsed && label}
    </Link>
  );
}

function PlanCard({ plan, onNavigate }: { plan: "FREE" | "PRO"; onNavigate?: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles className="h-4 w-4 text-[#7FA8FF]" />
        {plan === "PRO" ? "Pro plan" : "Free plan"}
      </p>
      {plan === "PRO" ? (
        <p className="mt-1.5 text-[13px] leading-snug text-zinc-400">Thanks for being on Pro.</p>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-zinc-400">Upgrade to Pro when you&apos;re ready to grow.</p>
          <Link href="/dashboard/upgrade" onClick={onNavigate} className="mt-3.5 flex h-10 items-center justify-center rounded-xl bg-white text-sm font-semibold text-app-ink transition hover:bg-zinc-200">
            Upgrade plan
          </Link>
        </>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-400 transition hover:bg-white/[0.1] hover:text-white">
      {children}
    </button>
  );
}
