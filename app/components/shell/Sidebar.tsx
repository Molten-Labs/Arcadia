"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { LogoMark } from "@/components/landing/LogoMark";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

import { RoleBadge } from "./RoleBadge";
import { WalletButton } from "./WalletButton";
import { useHydrated } from "./use-hydrated";
import {
  BOTTOM_LINKS,
  getHomeHref,
  getNavLinks,
  isActivePath,
  type NavLink,
} from "./nav-items";

/** Sidebar rail width. Kept in sync with AppShell's `md:pl-60` content offset. */

function NavItem({ href, icon: Icon, label, active, dimmed }: NavLink & { active: boolean; dimmed?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
        active
          ? "bg-acid/[0.07] text-ink"
          : dimmed
            ? "text-faint hover:bg-white/[0.04] hover:text-muted"
            : "text-muted hover:bg-white/[0.04] hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 origin-center rounded-full bg-acid transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none",
          active
            ? "scale-y-100"
            : "scale-y-0 group-hover:scale-y-100 group-focus-visible:scale-y-100",
        )}
      />
      <Icon
        className={cn(
          "size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none",
          active ? "text-acid" : "text-current",
        )}
        strokeWidth={active ? 2.2 : 1.8}
        aria-hidden
      />
      <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.11em]">
        {label}
      </span>
    </Link>
  );
}

/**
 * Desktop navigation rail (>= md). Always present on desktop: guests get the
 * public routes (Traders / Leaderboard) plus a connect CTA; connected users get
 * role-aware nav (trader / investor) split into primary + secondary (dimmed)
 * groups, with the active route marked by an acid accent + aria-current.
 */
export function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const wallet = useWallet();
  const { role: rawRole } = useRole();

  const connected = hydrated && wallet.connected;
  const role = hydrated ? rawRole : null;
  const publicKey = hydrated ? wallet.publicKey : null;

  const navLinks = getNavLinks(role, connected);
  const primaryLinks = navLinks.filter((l) => l.primary);
  const secondaryLinks = navLinks.filter((l) => !l.primary);
  const homeHref = getHomeHref(role, connected);

  const base58 = publicKey?.toBase58();
  const shortKey = base58 ? `${base58.slice(0, 4)}...${base58.slice(-4)}` : "Not connected";
  const initial = base58 ? base58.slice(0, 1).toUpperCase() : "?";

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-panel py-3 md:flex"
      aria-label="Sidebar"
    >
      <Link
        href={homeHref}
        className="mb-5 mt-1 flex items-center gap-2.5 rounded-lg px-4 outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        <LogoMark size={24} />
        <span className="font-display text-lg font-extrabold uppercase tracking-[-0.03em] text-ink">
          Arcadia
        </span>
      </Link>

      <div className="mx-4 mb-3 border-t border-line" />

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5">
        <p className="px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
          Menu
        </p>
        {primaryLinks.map((l) => (
          <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} />
        ))}
        {secondaryLinks.length > 0 && (
          <>
            <p className="mt-3 px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
              Explore
            </p>
            {secondaryLinks.map((l) => (
              <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} dimmed />
            ))}
          </>
        )}
      </nav>

      <div className="mx-4 my-2 border-t border-line" />

      <div className="flex flex-col gap-1 px-2.5">
        {connected ? (
          <>
            {role && <RoleBadge role={role} className="mx-1 self-start" />}
            {BOTTOM_LINKS.map((l) => (
              <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} />
            ))}
            <div className="mt-1 flex items-center gap-3 px-3 py-2">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
                  "border-acid/30 bg-acid/10 text-acid",
                )}
                aria-hidden
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-ink">{shortKey}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                  Devnet
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5 px-1 pt-1">
            <p className="px-2 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-faint">
              Connect a wallet to unlock your dashboard, vault, and payouts.
            </p>
            <WalletButton />
          </div>
        )}
      </div>
    </aside>
  );
}
