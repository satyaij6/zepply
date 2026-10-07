import { BarChart3, CalendarDays, Home, Inbox, LifeBuoy, Palette, PenLine, Settings, Users, Zap, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Pages that exist today. */
export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/triggers", label: "Automations", icon: Zap },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/create", label: "Create", icon: PenLine },
  { href: "/dashboard/brand-kit", label: "Brand Kit", icon: Palette },
];

/** Planned areas, shown disabled so the roadmap is visible without pretending they work. */
export const SOON_NAV: Omit<NavItem, "href">[] = [
  { label: "Calendar", icon: CalendarDays },
  { label: "Inbox", icon: Inbox },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "mailto:contact@buybloc.com", label: "Help & Support", icon: LifeBuoy },
];

export const isActive = (pathname: string, href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
