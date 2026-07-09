"use client";

import { useState } from "react";

import { Marquee } from "@/components/acid/Marquee";
import { LiveDot } from "@/components/pages/trader/trader-ui";

const EXTRA_TICKERS = [
  { sym: "HYPE", price: 28.41, chg: -0.84 },
  { sym: "MNT", price: 0.56, chg: 5.21 },
  { sym: "LINK", price: 13.19, chg: 2.44 },
  { sym: "TRON", price: 0.28, chg: -1.33 },
  { sym: "OP", price: 1.72, chg: 3.87 },
  { sym: "AVAX", price: 22.14, chg: -2.1 },
  { sym: "INJ", price: 14.88, chg: 7.32 },
  { sym: "WIF", price: 1.05, chg: -4.56 },
  { sym: "PEPE", price: 0.0000121, chg: 12.3 },
  { sym: "JUP", price: 0.58, chg: 1.98 },
  { sym: "BONK", price: 0.000021, chg: -3.44 },
  { sym: "W", price: 0.31, chg: 8.11 },
];

type TickerTab = "top" | "gainers" | "losers";

export function TerminalTickerBar({
  marketStats,
}: {
  marketStats: Record<string, { markPx: number; prevDayPx: number }>;
}) {
  const [tab, setTab] = useState<TickerTab>("top");
  const apiItems = Object.entries(marketStats).map(([sym, s]) => {
    const chg = s.prevDayPx ? ((s.markPx - s.prevDayPx) / s.prevDayPx) * 100 : 0;
    return { sym, price: s.markPx, chg };
  });
  const all = [...apiItems, ...EXTRA_TICKERS];
  const displayed =
    tab === "gainers"
      ? [...all].sort((a, b) => b.chg - a.chg).slice(0, 10)
      : tab === "losers"
        ? [...all].sort((a, b) => a.chg - b.chg).slice(0, 10)
        : all;

  return (
    <div className="flex h-[26px] shrink-0 items-center overflow-hidden border-t border-line bg-panel">
      <div className="flex h-full shrink-0 items-center border-r border-line">
        {(
          [
            ["top", "Top"],
            ["gainers", "▲ Gainers"],
            ["losers", "▼ Losers"],
          ] as [TickerTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="h-full border-r border-line px-2.5 text-[9px] font-bold whitespace-nowrap transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
            style={{
              color: tab === t ? "var(--color-ink)" : "var(--color-faint)",
              background: tab === t ? "var(--color-panel-2)" : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative flex h-full flex-1 items-center overflow-hidden">
        <Marquee speed={50} pauseOnHover={false} className="h-full">
          {displayed.map((item, i) => {
            const pos = item.chg >= 0;
            const fmt =
              item.price < 0.0001
                ? item.price.toFixed(7)
                : item.price < 1
                  ? item.price.toFixed(4)
                  : item.price < 100
                    ? item.price.toFixed(3)
                    : item.price.toFixed(2);
            return (
              <span
                key={`${item.sym}-${i}`}
                className="inline-flex h-full items-center gap-1.5 border-r border-line px-3.5 text-[10px]"
              >
                <span className="font-bold text-ink">{item.sym}</span>
                <span className="tabular-nums text-muted">{fmt}</span>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: pos ? "var(--color-success)" : "var(--color-danger)" }}
                >
                  {pos ? "+" : ""}
                  {item.chg.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </Marquee>
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-0 w-8"
          style={{ background: "linear-gradient(to right, var(--color-panel), transparent)" }}
        />
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-0 w-8"
          style={{ background: "linear-gradient(to left, var(--color-panel), transparent)" }}
        />
      </div>

      <div className="flex h-full shrink-0 items-center gap-2 border-l border-line px-3">
        <LiveDot />
        <span className="text-[9px] font-bold text-acid">Phoenix LIVE</span>
      </div>
    </div>
  );
}
