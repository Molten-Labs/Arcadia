import {
  BarChart2,
  Briefcase,
  DollarSign,
  Home,
  LayoutDashboard,
  Settings,
  Shield,
  Terminal,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ArcadiaRole } from "@/lib/role-context";

/**
 * Single source of truth for app-shell navigation. Pure data + pure helpers,
 * hoisted to module scope so client chrome (Sidebar / MobileNav / Topbar) reads
 * one shared config with no per-render allocation. Plain ASCII copy only.
 */

export type NavLink = {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Primary links head the sidebar and seed the mobile bar; secondary are dimmed. */
  primary: boolean;
};

const TRADER_NAV: NavLink[] = [
  { href: "/terminal", icon: Terminal, label: "Terminal", primary: true },
  { href: "/analytics", icon: TrendingUp, label: "Analytics", primary: true },
  { href: "/reputation", icon: Shield, label: "Reputation", primary: true },
  { href: "/payouts", icon: DollarSign, label: "Payouts", primary: true },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", primary: true },
  { href: "/manage", icon: BarChart2, label: "Manage Vault", primary: true },
  { href: "/traders", icon: Users, label: "Traders", primary: false },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard", primary: false },
];

const INVESTOR_NAV: NavLink[] = [
  { href: "/portfolio", icon: Briefcase, label: "Portfolio", primary: true },
  { href: "/traders", icon: Users, label: "Traders", primary: false },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard", primary: false },
];

const GUEST_NAV: NavLink[] = [
  { href: "/traders", icon: Users, label: "Traders", primary: true },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard", primary: true },
];

/** Persistent sidebar footer links (shown when connected). */
export const BOTTOM_LINKS: NavLink[] = [
  { href: "/settings", icon: Settings, label: "Settings", primary: true },
];

/** Minimal guest mobile bar: Home + the two public routes. */
const GUEST_MOBILE_NAV: NavLink[] = [
  { href: "/", icon: Home, label: "Home", primary: true },
  { href: "/traders", icon: Users, label: "Traders", primary: true },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard", primary: true },
];

/** Trailing "More" tab on the connected mobile bar -> settings. */
const MORE_LINK: NavLink = { href: "/settings", icon: Settings, label: "More", primary: true };

export function getNavLinks(role: ArcadiaRole, connected: boolean): NavLink[] {
  if (!connected) return GUEST_NAV;
  if (role === "trader") return TRADER_NAV;
  if (role === "investor") return INVESTOR_NAV;
  return GUEST_NAV;
}

/** Role-aware home target: traders land on the terminal, investors on their portfolio. */
export function getHomeHref(role: ArcadiaRole, connected: boolean): string {
  if (!connected || !role) return "/";
  return role === "trader" ? "/terminal" : "/portfolio";
}

/** Mobile bottom-bar items: guests get 3, connected get 4 primary + More. */
export function getMobileLinks(role: ArcadiaRole, connected: boolean): NavLink[] {
  if (!connected) return GUEST_MOBILE_NAV;
  const primary = getNavLinks(role, connected)
    .filter((l) => l.primary)
    .slice(0, 4);
  return [...primary, MORE_LINK];
}

/** Prefix-match active detection (exact for the landing route). */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/traders": "Trader Marketplace",
  "/leaderboard": "Leaderboard",
  "/dashboard": "Dashboard",
  "/terminal": "Terminal",
  "/analytics": "Analytics",
  "/reputation": "Reputation",
  "/payouts": "Payouts",
  "/portfolio": "Portfolio",
  "/investments": "Investments",
  "/returns": "Returns",
  "/settings": "Settings",
  "/manage": "Vault Management",
  "/vault": "Vault",
  "/t/": "Trader Profile",
};

/** Resolve the current route's display label for the topbar. */
export function routeLabel(pathname: string): string {
  const match = Object.entries(ROUTE_LABELS).find(([key]) =>
    key === "/" ? pathname === "/" : pathname.startsWith(key),
  );
  return match?.[1] ?? "Arcadia";
}
