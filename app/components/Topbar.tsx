"use client";

import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect, useRef } from "react";
import { Bell, Settings, Monitor, X, ArrowUpRight } from "lucide-react";

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
  "/settings":     "Profile",
  "/manage":       "Vault Management",
};

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "score" | "deposit" | "payout" | "system";
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Score updated",
    body: "Your Arcadia Score increased: 847 → 863. You're approaching Advanced tier.",
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
    body: "Funding rate payment received: +$24.50 USDC settled to your account.",
    time: "1h ago",
    read: false,
    type: "payout",
  },
];

const TYPE_COLOR: Record<Notification["type"], string> = {
  score:   "var(--color-accent)",
  deposit: "var(--color-green)",
  payout:  "var(--color-purple-bright)",
  system:  "var(--color-muted)",
};

export function Topbar() {
  const pathname          = usePathname();
  const { connected }     = useWallet();
  const [mounted, setMounted]   = useState(false);
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const unread    = connected ? notifs.filter((n) => !n.read).length : 0;
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
      className="flex items-center justify-between h-9 px-4 sticky top-0 z-30 flex-shrink-0"
      style={{
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-line)",
      }}
    >
      <span className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>

      <div className="flex items-center gap-3">
        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors">
          <Monitor size={13} style={{ color: "var(--color-faint)" }} />
        </button>

        {/* ── Bell with animated badge ─────────────────────── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Notifications"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors"
            style={{ position: "relative" }}
          >
            <Bell
              size={13}
              style={{
                color: open ? "var(--color-accent)" : "var(--color-faint)",
                transition: "color 0.15s",
              }}
            />
            <span className="t-badge" data-open={badgeOpen ? "true" : "false"}>
              <span className="t-badge-dot">{unread > 9 ? "9+" : unread}</span>
            </span>
          </button>

          {/* ── Dropdown panel ────────────────────────────── */}
          {open && (
            <div
              className="absolute right-0 top-8 w-80 rounded-lg overflow-hidden shadow-2xl"
              style={{
                background: "var(--color-panel)",
                border: "1px solid var(--color-line)",
                zIndex: 50,
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-line)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "var(--color-ink)" }}>
                    Notifications
                  </span>
                  {unread > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded"
                      style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
                    >
                      {unread} new
                    </span>
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

              {/* Body */}
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
                      background: n.read ? "transparent" : "rgba(178,255,0,0.025)",
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
                      aria-label="Dismiss notification"
                    >
                      <X size={10} style={{ color: "var(--color-faint)" }} />
                    </button>
                  </div>
                ))
              )}

              {/* Footer */}
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

        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors">
          <Settings size={13} style={{ color: "var(--color-faint)" }} />
        </button>

        {mounted && <WalletMultiButton />}

        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: "var(--color-purple)", color: "#fff" }}
        >
          D
        </div>
      </div>
    </div>
  );
}
