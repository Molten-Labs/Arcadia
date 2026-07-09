"use client";

import { useState } from "react";
import type { DailyPnL } from "@/lib/mock-data";

interface Props {
  data: DailyPnL[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pnlColor(pnl: number): string {
  if (pnl === 0) return "var(--color-panel-2)";
  if (pnl > 0) {
    const intensity = Math.min(1, pnl / 3000);
    const pct = (0.15 + intensity * 0.75) * 100;
    return `color-mix(in srgb, var(--color-success) ${pct}%, transparent)`;
  }
  const intensity = Math.min(1, Math.abs(pnl) / 2000);
  const pct = (0.15 + intensity * 0.75) * 100;
  return `color-mix(in srgb, var(--color-danger) ${pct}%, transparent)`;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  const abs = Math.abs(pnl);
  if (abs >= 1000) return `${sign}$${(pnl / 1000).toFixed(1)}k`;
  return `${sign}$${pnl.toFixed(0)}`;
}

export function PnLHeatmap({ data }: Props) {
  const [hovered, setHovered] = useState<DailyPnL | null>(null);

  const byDate: Record<string, number> = {};
  for (const d of data) byDate[d.date] = d.pnl;

  const allYears = [...new Set(data.map((d) => d.date.slice(0, 4)))].sort();
  const latestYear = allYears[allYears.length - 1];
  const [year, setYear] = useState(latestYear);

  const yearData: Record<string, number> = {};
  for (const [date, pnl] of Object.entries(byDate)) {
    if (date.startsWith(year)) yearData[date] = pnl;
  }

  const weekGrid: Array<Array<{ date: string; pnl: number | null }>> = [];
  const startDate = new Date(`${year}-01-01`);
  const startDay = startDate.getDay();

  const totalWeeks = Math.ceil((365 + startDay) / 7) + 1;
  for (let w = 0; w < totalWeeks; w++) weekGrid.push([]);

  const cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() - startDay);

  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const inYear = cursor.getFullYear() === parseInt(year);
      weekGrid[w].push({
        date: inYear ? dateStr : "",
        pnl: inYear ? (yearData[dateStr] ?? null) : null,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const monthPositions: { label: string; col: number }[] = [];
  let monthTrack = -1;
  for (let w = 0; w < weekGrid.length; w++) {
    const firstValid = weekGrid[w].find((c) => c.date);
    if (firstValid?.date) {
      const m = parseInt(firstValid.date.slice(5, 7)) - 1;
      if (m !== monthTrack) {
        monthPositions.push({ label: MONTHS[m], col: w });
        monthTrack = m;
      }
    }
  }

  const totalPnl = Object.values(yearData).reduce((a, b) => a + b, 0);
  const tradingDays = Object.values(yearData).filter((v) => v !== 0).length;
  const winDays = Object.values(yearData).filter((v) => v > 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-3">
          <div className="text-xs">
            <span className="font-medium" style={{ color: "var(--color-faint)" }}>Year P&L </span>
            <span
              className="font-black tnum"
              style={{ color: totalPnl >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {formatPnl(totalPnl)}
            </span>
          </div>
          <div className="text-xs">
            <span className="font-medium" style={{ color: "var(--color-faint)" }}>Win days </span>
            <span className="font-bold tnum" style={{ color: "var(--color-ink)" }}>
              {winDays}/{tradingDays}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {allYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className="text-[10px] font-bold px-2 py-1 rounded transition-all"
              style={{
                background: y === year ? "var(--color-acid)" : "var(--color-panel-2)",
                color: y === year ? "var(--color-void)" : "var(--color-faint)",
                border: "1px solid var(--color-line)",
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {hovered && hovered.date && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-3 border font-mono"
          style={{ background: "var(--color-panel)", borderColor: "var(--color-line)" }}
        >
          <span className="font-mono" style={{ color: "var(--color-faint)" }}>{hovered.date}</span>
          <span
            className="font-black tnum"
            style={{ color: (hovered.pnl ?? 0) >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
          >
            {hovered.pnl != null && hovered.pnl !== 0 ? formatPnl(hovered.pnl) : "No trades"}
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", minWidth: 680 }}>
          <div className="flex mb-1" style={{ marginLeft: 28 }}>
            {monthPositions.map((mp) => (
              <div
                key={mp.label}
                className="text-[9px] font-bold uppercase tracking-widest absolute"
                style={{ left: 28 + mp.col * 13, color: "var(--color-faint)" }}
              >
                {mp.label}
              </div>
            ))}
          </div>

          <div className="flex mt-4">
            <div className="flex flex-col gap-[2px] mr-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-[8px] font-bold text-center leading-none"
                  style={{ height: 11, color: "var(--color-faint)", width: 24 }}
                >
                  {i % 2 === 1 ? d : ""}
                </div>
              ))}
            </div>

            <div className="flex gap-[2px]">
              {weekGrid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      title={cell.date ? `${cell.date}: ${cell.pnl != null && cell.pnl !== 0 ? formatPnl(cell.pnl) : "No trades"}` : ""}
                      onMouseEnter={() => cell.date ? setHovered(cell as DailyPnL) : undefined}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 2,
                        background: cell.date ? pnlColor(cell.pnl ?? 0) : "transparent",
                        border: cell.date ? "1px solid var(--color-line)" : "none",
                        cursor: cell.date ? "default" : "default",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 ml-7">
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Loss</span>
            {[-3000, -1500, 0, 1500, 3000].map((v) => (
              <div
                key={v}
                style={{ width: 11, height: 11, borderRadius: 2, background: pnlColor(v), border: "1px solid var(--color-line)" }}
              />
            ))}
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Win</span>
          </div>
        </div>
      </div>
    </div>
  );
}
