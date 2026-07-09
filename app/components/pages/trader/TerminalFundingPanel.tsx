"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

import { usePhoenix } from "@/lib/phoenix-context";

export function TerminalFundingPanel({ symbol }: { symbol: string }) {
  const { fundingRate } = usePhoenix();
  const fr = fundingRate[symbol];
  // Lazy init keeps Date.now() out of the render body (purity).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!fr) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <Activity size={18} className="text-faint opacity-50" />
        <p className="text-xs text-faint">No funding data</p>
      </div>
    );
  }

  const nextFunding = fr.fundingTime ?? 0;
  const diff = Math.max(0, nextFunding - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const countdown = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const apr = fr.funding * 24 * 365 * 100;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-[10px] font-medium text-faint">Current Funding Rate</span>
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: fr.funding >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {(fr.funding * 100).toFixed(4)}%
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-[10px] font-medium text-faint">Est. Annual APR</span>
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: apr >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {apr >= 0 ? "+" : ""}
          {apr.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-[10px] font-medium text-faint">Next Funding</span>
        <span className="text-sm font-black tabular-nums text-ink">{countdown}</span>
      </div>
      <div className="rounded-lg border border-line bg-panel-2 p-2.5">
        <p className="text-[9px] leading-relaxed text-faint">
          Funding payments are exchanged between long and short positions every hour.
          {fr.funding > 0
            ? " Longs pay shorts."
            : fr.funding < 0
              ? " Shorts pay longs."
              : " No payment due."}
        </p>
      </div>
    </div>
  );
}
