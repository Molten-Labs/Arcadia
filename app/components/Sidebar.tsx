"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home, Users, Trophy, LayoutDashboard, BarChart2,
  TrendingUp, Shield, DollarSign, Settings, Briefcase, ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",            icon: Home,            label: "Home" },
  { href: "/traders",     icon: Users,           label: "Traders" },
  { href: "/leaderboard", icon: Trophy,          label: "Leaderboard" },
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { href: "/terminal",    icon: BarChart2,       label: "Terminal" },
  { href: "/analytics",   icon: TrendingUp,      label: "Analytics" },
  { href: "/reputation",  icon: Shield,          label: "Reputation" },
  { href: "/payouts",     icon: DollarSign,      label: "Payouts" },
  { href: "/portfolio",   icon: Briefcase,       label: "Portfolio" },
  { href: "/returns",     icon: ArrowLeftRight,  label: "Returns" },
];

const BOTTOM_LINKS = [
  { href: "/settings", icon: Settings, label: "Profile" },
];

function SideIcon({
  href, icon: Icon, label, active,
}: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "group relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-100",
        active
          ? "bg-[var(--color-purple)]"
          : "text-[var(--color-faint)] hover:text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]"
      )}
    >
      <Icon
        size={15}
        strokeWidth={active ? 2.2 : 1.8}
        color={active ? "#fff" : undefined}
      />
      <span
        className="pointer-events-none absolute left-10 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: "var(--color-panel-2)",
          border: "1px solid var(--color-line)",
          color: "var(--color-ink)",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-11 z-40 flex flex-col items-center py-2 gap-0.5"
      style={{ background: "var(--color-panel)", borderRight: "1px solid var(--color-line)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-lg mb-2 mt-1 flex-shrink-0 cursor-pointer"
        style={{ background: "var(--color-purple)" }}
        title="Arcadia"
      >
        <span className="text-[9px] font-black text-white tracking-wider">ARC</span>
      </div>

      {/* Divider */}
      <div className="w-5 mb-1" style={{ borderTop: "1px solid var(--color-line)" }} />

      {/* Nav */}
      <div className="flex flex-col items-center gap-0.5 flex-1 w-full px-1.5">
        {!mounted
          ? null
          : NAV_LINKS.map((l) => (
              <SideIcon key={l.href} {...l} active={isActive(l.href)} />
            ))}
      </div>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1.5 pb-1">
        {mounted &&
          BOTTOM_LINKS.map((l) => (
            <SideIcon key={l.href} {...l} active={isActive(l.href)} />
          ))}
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full mt-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: "var(--color-purple-dim)", border: "1px solid var(--color-purple)", color: "var(--color-purple-bright)" }}
        >
          D
        </div>
      </div>
    </aside>
  );
}
