"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Users, Trophy, LayoutDashboard, BarChart2,
  TrendingUp, Shield, DollarSign, Settings, Briefcase, ArrowLeftRight,
  Crown, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole, type ArcadiaRole } from "@/lib/role-context";
import { useWallet } from "@solana/wallet-adapter-react";

const TRADER_NAV = [
  { href: "/terminal",    icon: Terminal,        label: "Terminal",     primary: true  },
  { href: "/analytics",   icon: TrendingUp,      label: "Analytics",    primary: true  },
  { href: "/reputation",  icon: Shield,          label: "Reputation",   primary: true  },
  { href: "/payouts",     icon: DollarSign,      label: "Payouts",      primary: true  },
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard",    primary: true  },
  { href: "/manage",      icon: BarChart2,       label: "Manage Vault", primary: true  },
  { href: "/traders",     icon: Users,           label: "Traders",      primary: false },
  { href: "/leaderboard", icon: Trophy,          label: "Leaderboard",  primary: false },
];

const INVESTOR_NAV = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard",   primary: true  },
  { href: "/portfolio",   icon: Briefcase,       label: "Portfolio",   primary: true  },
  { href: "/investments", icon: TrendingUp,      label: "Investments", primary: true  },
  { href: "/returns",     icon: ArrowLeftRight,  label: "Returns",     primary: true  },
  { href: "/traders",     icon: Users,           label: "Traders",     primary: false },
  { href: "/leaderboard", icon: Trophy,          label: "Leaderboard", primary: false },
];

const GUEST_NAV = [
  { href: "/traders",     icon: Users,           label: "Traders",      primary: true  },
  { href: "/leaderboard", icon: Trophy,          label: "Leaderboard",  primary: true  },
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard",    primary: false },
  { href: "/terminal",    icon: Terminal,        label: "Terminal",     primary: false },
  { href: "/analytics",   icon: TrendingUp,      label: "Analytics",    primary: false },
  { href: "/reputation",  icon: Shield,          label: "Reputation",   primary: false },
  { href: "/payouts",     icon: DollarSign,      label: "Payouts",      primary: false },
  { href: "/portfolio",   icon: Briefcase,       label: "Portfolio",    primary: false },
  { href: "/returns",     icon: ArrowLeftRight,  label: "Returns",      primary: false },
];

const BOTTOM_LINKS = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

function getNavLinks(role: ArcadiaRole, connected: boolean) {
  if (!connected) return GUEST_NAV;
  if (role === "trader") return TRADER_NAV;
  if (role === "investor") return INVESTOR_NAV;
  return GUEST_NAV;
}

function getHomeHref(role: ArcadiaRole, connected: boolean) {
  if (!connected || !role) return "/";
  return role === "trader" ? "/terminal" : "/dashboard";
}

function NavItem({
  href, icon: Icon, label, active, dimmed,
}: { href: string; icon: React.ElementType; label: string; active: boolean; dimmed?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group w-full",
        active
          ? "text-[var(--color-ink)]"
          : dimmed
            ? "text-[var(--color-faint)] hover:text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-panel-2)]"
      )}
      style={active ? { background: "rgba(79,158,255,0.10)", color: "var(--color-ink)" } : {}}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
          style={{ background: "var(--color-mint)" }}
        />
      )}
      <Icon
        size={15}
        strokeWidth={active ? 2.2 : 1.8}
        style={{ color: active ? "var(--color-mint)" : undefined, flexShrink: 0 }}
      />
      <span
        className="text-xs font-semibold tracking-wide whitespace-nowrap"
        style={{ letterSpacing: "-0.01em" }}
      >
        {label}
      </span>
    </Link>
  );
}

function RoleBadge({ role }: { role: ArcadiaRole }) {
  if (!role) return null;
  const isTrader = role === "trader";
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1"
      style={{
        background: isTrader ? "rgba(79,158,255,0.08)" : "rgba(240,180,41,0.08)",
        border: `1px solid ${isTrader ? "rgba(79,158,255,0.18)" : "rgba(240,180,41,0.18)"}`,
      }}
    >
      {isTrader
        ? <TrendingUp size={11} style={{ color: "var(--color-mint)", flexShrink: 0 }} />
        : <Crown size={11} style={{ color: "var(--color-gold)", flexShrink: 0 }} />
      }
      <span
        className="text-[10px] font-black uppercase tracking-[0.12em]"
        style={{ color: isTrader ? "var(--color-mint)" : "var(--color-gold)" }}
      >
        {isTrader ? "Trader" : "Investor"}
      </span>
    </div>
  );
}

function MobileNavItem({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 flex-1 py-2 transition-colors"
      style={{ color: active ? "var(--color-mint)" : "var(--color-faint)" }}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { role } = useRole();
  const { connected, publicKey } = useWallet();

  useEffect(() => setMounted(true), []);

  const navLinks = getNavLinks(role, connected);
  const homeHref = getHomeHref(role, connected);

  const primaryLinks = navLinks.filter((l) => l.primary);
  const secondaryLinks = navLinks.filter((l) => !l.primary);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const shortKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : "devnet";

  if (!mounted || !connected) return null;

  const mobilePrimary = primaryLinks.slice(0, 5);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-48 z-40 flex-col py-3 hidden md:flex"
        style={{ background: "var(--color-panel)", borderRight: "1px solid var(--color-line)" }}
      >
        <Link href={homeHref} className="flex items-center gap-2.5 px-4 mb-5 mt-1 group">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-transform group-hover:scale-105"
            style={{ background: "var(--color-mint)" }}
          >
            <span className="text-[9px] font-black tracking-wider" style={{ color: "#ffffff" }}>ARC</span>
          </div>
          <span
            className="text-sm font-black tracking-tight"
            style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
          >
            Arcadia
          </span>
        </Link>

        <div className="mx-4 mb-3" style={{ borderTop: "1px solid var(--color-line)" }} />

        <nav className="flex flex-col gap-0.5 flex-1 px-2.5 overflow-y-auto">
          {primaryLinks.map((l) => (
            <NavItem key={l.href} {...l} active={isActive(l.href)} />
          ))}
          {secondaryLinks.length > 0 && (
            <>
              <div className="mx-1 my-2" style={{ borderTop: "1px solid var(--color-line)" }} />
              {secondaryLinks.map((l) => (
                <NavItem key={l.href} {...l} active={isActive(l.href)} dimmed />
              ))}
            </>
          )}
        </nav>

        <div className="mx-4 my-2" style={{ borderTop: "1px solid var(--color-line)" }} />

        <div className="flex flex-col gap-1 px-2.5">
          {connected && <RoleBadge role={role} />}
          {BOTTOM_LINKS.map((l) => (
            <NavItem key={l.href} {...l} active={isActive(l.href)} />
          ))}
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{
                background: connected ? "rgba(79,158,255,0.12)" : "var(--color-panel-2)",
                border: connected ? "1px solid rgba(79,158,255,0.25)" : "1px solid var(--color-line)",
                color: connected ? "var(--color-mint)" : "var(--color-faint)",
              }}
            >
              {connected && publicKey ? publicKey.toBase58().slice(0, 1).toUpperCase() : "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-ink)" }}>
                {connected ? shortKey : "Not connected"}
              </p>
              <p className="text-[10px] font-mono truncate" style={{ color: "var(--color-faint)" }}>
                Devnet
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
        style={{ background: "var(--color-panel)", borderTop: "1px solid var(--color-line)" }}
      >
        {mobilePrimary.map((l) => (
          <MobileNavItem key={l.href} {...l} active={isActive(l.href)} />
        ))}
        <MobileNavItem href="/settings" icon={Settings} label="More" active={isActive("/settings")} />
      </nav>
    </>
  );
}
