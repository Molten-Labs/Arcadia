"use client";

import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect, useRef } from "react";
import { Bell, Settings, X, ArrowUpRight, TrendingUp, Crown } from "lucide-react";
import { useRole } from "@/lib/role-context";

const ROUTE_LABELS: Record<string, string> = {
  "/":             "Home",
  "/traders":      "Trader Marketplace",
  "/leaderboard":  "Leaderboard",
  "/dashboard":    "Dashboard",
  "/terminal":     "Terminal",
  "/analytics":    "Analytics",
  "/reputation":   "Reputation",
  "/payouts":      "Payouts",
  "/portfolio":    "Portfolio",
  "/investments":  "Investments",
  "/returns":      "Returns",
  "/settings":     "Settings",
  "/manage":       "Vault Management",
  "/trade":        "Trade",
  "/vault":        "Vault",
  "/t/":           "Trader Profile",
};

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "score" | "deposit" | "payout" | "system";
}

const TRADER_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Score updated",
    body: "Your Arcadia Score increased: 847 → 863. Approaching Advanced tier.",
    time: "2m ago",
    read: false,
    type: "score",
  },
  {
    id: "n2",
    title: "New deposit received",
    body: "An investor deposited $2,400 USDC into your vault.",
    time: "18m ago",
    read: false,
    type: "deposit",
  },
  {
    id: "n3",
    title: "Funding payment",
    body: "Funding rate payment received: +$24.50 USDC settled.",
    time: "1h ago",
    read: false,
    type: "payout",
  },
];

const INVESTOR_NOTIFICATIONS: Notification[] = [
  {
    id: "i1",
    title: "NAV update",
    body: "@nova vault NAV increased to 1.187 USDC/share (+2.3% this week).",
    time: "5m ago",
    read: false,
    type: "deposit",
  },
  {
    id: "i2",
    title: "Deposit confirmed",
    body: "Your $3,000 USDC deposit to @vega vault is confirmed.",
    time: "1h ago",
    read: false,
    type: "deposit",
  },
  {
    id: "i3",
    title: "Settlement complete",
    body: "Performance fees crystallised. Your net position updated.",
    time: "3h ago",
    read: true,
    type: "payout",
  },
];

const TYPE_COLOR: Record<Notification["type"], string> = {
  score:   "var(--color-mint)",
  deposit: "var(--color-green)",
  payout:  "var(--color-mint)",
  system:  "var(--color-muted)",
};

export function Topbar() {
  const pathname      = usePathname();
  const { connected } = useWallet();
  const { role }      = useRole();

  const [mounted, setMounted]   = useState(false);
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState<Notification[]>([]);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!connected) { setNotifs([]); return; }
    setNotifs(role === "trader" ? TRADER_NOTIFICATIONS : INVESTOR_NOTIFICATIONS);
  }, [connected, role]);

  const unread    = notifs.filter((n) => !n.read).length;
  const badgeOpen = unread > 0;

  const label = Object.entries(ROUTE_LABELS).find(([k]) =>
    k === "/" ? pathname === "/" : pathname.startsWith(k)
  )?.[1] ?? "Arcadia";

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function dismissOne(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div
      className="flex items-center justify-between h-12 px-5 sticky top-0 z-30 flex-shrink-0"
      style={{
        background: "rgba(0,0,0,0.90)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-line)",
      }}
    >
      {/* Left — route label + network badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold" style={{ color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
          {label}
        </span>
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            background: "rgba(34,197,94,0.10)",
            border: "1px solid rgba(34,197,94,0.2)",
            color: "var(--color-green)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)", animation: "glow-pulse 2s ease-in-out infinite" }} />
          Devnet
        </span>

        {/* Role chip */}
        {mounted && connected && role && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: role === "trader" ? "rgba(79,158,255,0.08)" : "rgba(240,180,41,0.08)",
              border: `1px solid ${role === "trader" ? "rgba(79,158,255,0.18)" : "rgba(240,180,41,0.18)"}`,
              color: role === "trader" ? "var(--color-mint)" : "var(--color-gold)",
            }}
          >
            {role === "trader"
              ? <TrendingUp size={9} />
              : <Crown size={9} />
            }
            {role === "trader" ? "Trader" : "Investor"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Bell with notification badge */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Notifications"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: open ? "var(--color-panel-2)" : "transparent" }}
          >
            <Bell
              size={14}
              style={{
                color: open ? "var(--color-mint)" : "var(--color-muted)",
                transition: "color 0.15s",
              }}
            />
            <span className="t-badge" data-open={badgeOpen ? "true" : "false"}>
              <span className="t-badge-dot">{unread > 9 ? "9+" : unread}</span>
            </span>
          </button>

          {open && (
            <div
              className="absolute right-0 top-10 w-80 rounded-xl overflow-hidden shadow-2xl"
              style={{
                background: "var(--color-panel)",
                border: "1px solid var(--color-line)",
                zIndex: 50,
                animation: "fade-in 0.15s ease",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-line)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "var(--color-ink)" }}>
                    Notifications
                  </span>
                  {unread > 0 && (
                    <span className="badge-mint">{unread} new</span>
                  )}
                </div>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-semibold transition-colors hover:opacity-70"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {!connected ? (
                <div className="px-4 py-8 flex flex-col items-center gap-2">
                  <Bell size={20} style={{ color: "var(--color-faint)" }} />
                  <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
                    Connect your wallet to receive notifications
                  </p>
                </div>
              ) : notifs.length === 0 ? (
                <div className="px-4 py-8 flex flex-col items-center gap-2">
                  <Bell size={20} style={{ color: "var(--color-faint)" }} />
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    You&apos;re all caught up
                  </p>
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 group transition-colors"
                    style={{
                      borderBottom: "1px solid var(--color-line)",
                      background: n.read ? "transparent" : "rgba(79,158,255,0.025)",
                    }}
                  >
                    <div className="pt-1.5 flex-shrink-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full block"
                        style={{ background: n.read ? "var(--color-faint)" : TYPE_COLOR[n.type] }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold leading-tight" style={{ color: "var(--color-ink)" }}>
                        {n.title}
                      </p>
                      <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: "var(--color-muted)" }}>
                        {n.body}
                      </p>
                      <p className="text-[9px] font-mono mt-1" style={{ color: "var(--color-faint)" }}>
                        {n.time}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissOne(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
                      aria-label="Dismiss"
                    >
                      <X size={10} style={{ color: "var(--color-faint)" }} />
                    </button>
                  </div>
                ))
              )}

              <div
                className="px-4 py-2.5 flex justify-end"
                style={{ borderTop: "1px solid var(--color-line)" }}
              >
                <button
                  className="inline-flex items-center gap-1 text-[10px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-muted)" }}
                >
                  All activity <ArrowUpRight size={10} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Wallet */}
        {mounted && <WalletMultiButton />}

        {/* Role avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: role === "trader"
              ? "rgba(79,158,255,0.12)"
              : role === "investor"
                ? "rgba(240,180,41,0.12)"
                : "var(--color-panel-2)",
            border: role === "trader"
              ? "1px solid rgba(79,158,255,0.3)"
              : role === "investor"
                ? "1px solid rgba(240,180,41,0.25)"
                : "1px solid var(--color-line)",
          }}
        >
          {role === "trader"
            ? <TrendingUp size={12} style={{ color: "var(--color-mint)" }} />
            : role === "investor"
              ? <Crown size={12} style={{ color: "var(--color-gold)" }} />
              : <span className="text-[10px] font-black" style={{ color: "var(--color-faint)" }}>?</span>
          }
        </div>
      </div>
    </div>
  );
}
