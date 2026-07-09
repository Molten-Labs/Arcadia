"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, X } from "lucide-react";

import type { ArcadiaRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

type NotificationType = "score" | "deposit" | "payout" | "system";

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: NotificationType;
}

const TRADER_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Score updated",
    body: "Your Arcadia Score increased: 847 -> 863. Approaching Advanced tier.",
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

/** Acid-quiet type accents: acid for score, cyan/success for money, muted for system. */
const TYPE_DOT: Record<NotificationType, string> = {
  score: "bg-acid",
  deposit: "bg-cyan",
  payout: "bg-success",
  system: "bg-muted",
};

function seedFor(role: ArcadiaRole, connected: boolean): Notification[] {
  if (!connected) return [];
  return role === "trader" ? TRADER_NOTIFICATIONS : INVESTOR_NOTIFICATIONS;
}

/**
 * Topbar notification bell + dropdown. Read/dismiss state is local and ephemeral;
 * the parent remounts this via `key` when role/connection changes, which reseeds
 * the list without a `setState`-in-effect. Mock feed, mirroring the legacy shell.
 */
export function Notifications({ role, connected }: { role: ArcadiaRole; connected: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>(() => seedFor(role, connected));
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function dismissOne(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "group relative flex size-11 items-center justify-center rounded-lg transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
          open ? "bg-panel-2 text-acid" : "text-muted hover:bg-white/5 hover:text-ink",
        )}
      >
        <Bell className="size-4 origin-top transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-rotate-[9deg] group-focus-visible:-rotate-[9deg] motion-reduce:transition-none motion-reduce:transform-none" aria-hidden />
        <span className="t-badge" data-open={unread > 0 ? "true" : "false"}>
          <span className="t-badge-dot">{unread > 9 ? "9+" : unread}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                Notifications
              </span>
              {unread > 0 && (
                <span className="rounded-full border border-acid/25 bg-acid/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-acid">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
              >
                Mark all read
              </button>
            )}
          </div>

          {!connected ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8">
              <Bell className="size-5 text-faint" aria-hidden />
              <p className="text-center text-xs text-muted">
                Connect your wallet to receive notifications
              </p>
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8">
              <Bell className="size-5 text-faint" aria-hidden />
              <p className="text-xs text-muted">You are all caught up</p>
            </div>
          ) : (
            notifs.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group flex items-start gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-white/[0.03] motion-reduce:transition-none",
                  !n.read && "bg-acid/[0.03]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 block size-1.5 shrink-0 rounded-full",
                    n.read ? "bg-faint" : TYPE_DOT[n.type],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-tight text-ink">{n.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{n.body}</p>
                  <p className="mt-1 font-mono text-[9px] text-faint">{n.time}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissOne(n.id)}
                  className="mt-1 shrink-0 rounded opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid group-hover:opacity-100"
                  aria-label={`Dismiss ${n.title}`}
                >
                  <X className="size-2.5 text-faint" aria-hidden />
                </button>
              </div>
            ))
          )}

          <div className="flex justify-end border-t border-line px-4 py-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
            >
              All activity <ArrowUpRight className="size-2.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
