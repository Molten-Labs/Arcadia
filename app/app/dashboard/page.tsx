"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { formatUSD } from "@/lib/types";

/* ── Mock data ──────────────────────────────────────────────────── */
const ACCOUNT = {
  name: "Eval #4821",
  status: "Active Funded",
  size: 25000,
  equity: 27311,
  cum_pnl: -2311,
  win_rate: 52,
  trades: 41,
  risk: "Medium",
};

function genEquity(days: number) {
  let eq = 9500; let hwm = 9500; let mdd = 0;
  const data = [];
  for (let i = 0; i < days; i++) {
    eq = eq + (Math.random() - 0.46) * 120;
    eq = Math.max(8500, eq);
    hwm = Math.max(hwm, eq);
    const dd = hwm > 0 ? ((hwm - eq) / hwm) * 100 : 0;
    mdd = Math.max(mdd, dd);
    const target = 9500 + i * 30;
    data.push({
      day: i + 1,
      equity: Math.round(eq),
      target: Math.round(target),
      daily_dd: -Math.round(dd * 10) / 10,
      max_dd: -Math.round(mdd * 10) / 10,
    });
  }
  return data;
}

const EQUITY_DATA = genEquity(30);

function genPnl(days: number) {
  let v = 10000;
  return Array.from({ length: days }, (_, i) => {
    v += (Math.random() - 0.48) * 300;
    return { day: i + 1, pnl: Math.round(v) };
  });
}
const PNL_DATA = genPnl(30);

const POSITIONS = [
  { coin: "$LINK", color: "#2563eb", dir: "Short", size: 15352, entry: "303.30 USD", mark: "23.19 USD", rpnl: "+$3.69", upnl: "-$93.69", opened: "2h 14m" },
  { coin: "$TRON", color: "#ef4444", dir: "Long",  size: 15352, entry: "443.50 USD", mark: "4.28 USD",  rpnl: "+$2.45", upnl: "+$22.45", opened: "2h 14m" },
  { coin: "$HYPE", color: "#f59e0b", dir: "Short", size: 18352, entry: "502.00 USD", mark: "58.99 USD", rpnl: "-$1.69", upnl: "-$13.69", opened: "2h 14m" },
];

const MARCH_DAYS = [
  { d: 1,  pnl: 61.94,   trades: 12 }, { d: 2,  pnl: 61.22,   trades: 6 },
  { d: 3,  pnl: 12.76,   trades: 5  }, { d: 4,  pnl: 41.11,   trades: 7 },
  { d: 5,  pnl: -99.39,  trades: 12 }, { d: 6,  pnl: -212.00, trades: 12 },
  { d: 7,  pnl: 190.75,  trades: 20 }, { d: 8,  pnl: 215.88,  trades: 25 },
  { d: 9,  pnl: 95.41,   trades: 35 }, { d: 10, pnl: null,    trades: 0  },
  { d: 11, pnl: null,    trades: 0  }, { d: 12, pnl: 220.69,  trades: 25 },
  { d: 13, pnl: -23.45,  trades: 3  }, { d: 14, pnl: null,    trades: 0  },
  { d: 15, pnl: null,    trades: 0  }, { d: 16, pnl: 100.55,  trades: 25 },
  { d: 17, pnl: -141.41, trades: 35 }, { d: 18, pnl: 23.56,   trades: 7  },
  { d: 19, pnl: null,    trades: 0  }, { d: 20, pnl: 10.45,   trades: 4  },
  { d: 21, pnl: null,    trades: 0  }, { d: 22, pnl: null,    trades: 0  },
  { d: 23, pnl: null,    trades: 0  }, { d: 24, pnl: null,    trades: 0  },
  { d: 25, pnl: null,    trades: 0  }, { d: 26, pnl: null,    trades: 0  },
  { d: 27, pnl: null,    trades: 0  }, { d: 28, pnl: null,    trades: 0  },
  { d: 29, pnl: null,    trades: 0  }, { d: 30, pnl: null,    trades: 0  },
  { d: 31, pnl: null,    trades: 0  },
];

const STREAK = ["L","L","W","W","W","L","W","W","W","L","L"];

/* ── Sub-components ─────────────────────────────────────────────── */
function RightPanel() {
  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-4">
      {/* Risk & Rules */}
      <div className="rounded-xl p-5 card bg-gradient-to-b from-[var(--color-panel)] to-[var(--color-panel-2)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>Risk &amp; Rules</p>
          <span className="text-[9px] font-mono font-medium" style={{ color: "var(--color-faint)" }}>
            Reset 21:42:08
          </span>
        </div>

        <p className="text-[10px] uppercase tracking-widest mb-1.5 font-bold" style={{ color: "var(--color-faint)" }}>
          Daily Drawdown
        </p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-black" style={{ color: "var(--color-ink)" }}>20%</span>
        </div>
        <div className="progress-track mb-1.5 h-1.5">
          <div className="progress-fill-mint" style={{ width: "35%" }} />
        </div>
        <div className="flex justify-between text-[10px] font-medium mb-5" style={{ color: "var(--color-faint)" }}>
          <span>-$200.00 today</span>
          <span style={{ color: "var(--color-muted)" }}>$800.00 left</span>
        </div>

        <p className="text-[10px] uppercase tracking-widest mb-1.5 font-bold" style={{ color: "var(--color-faint)" }}>
          Max Drawdown
        </p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-black" style={{ color: "var(--color-ink)" }}>2%</span>
        </div>
        <div className="progress-track mb-1.5 h-1.5">
          <div className="progress-fill-red" style={{ width: "8%" }} />
        </div>
        <div className="flex justify-between text-[10px] font-medium mb-6" style={{ color: "var(--color-faint)" }}>
          <span>$0.0 total</span>
          <span style={{ color: "var(--color-muted)" }}>$3,000 left</span>
        </div>

        <div className="rounded-lg p-3.5 border border-[var(--color-line)] bg-[var(--color-bg)]">
          <p className="text-[9px] uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--color-faint)" }}>
            Withdrawn
          </p>
          <p className="text-lg font-black tracking-tight" style={{ color: "var(--color-green)" }}>
            +$12,480
          </p>
          <p className="text-[9px] mt-1 font-medium flex items-center justify-between" style={{ color: "var(--color-faint)" }}>
            Lifetime 
            <span style={{ color: "var(--color-green)", display: "flex", alignItems: "center", gap: "2px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-green)]" /> Paid out
            </span>
          </p>
        </div>
      </div>

      {/* Account Stats */}
      <div className="rounded-xl p-5 card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>Statistics</p>
          <div className="flex gap-1">
            <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)] transition-colors border border-[var(--color-line)]">
              <ChevronRight size={12} style={{ color: "var(--color-faint)", transform: "rotate(180deg)" }} />
            </button>
            <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)] transition-colors border border-[var(--color-line)]">
              <ChevronRight size={12} style={{ color: "var(--color-faint)" }} />
            </button>
          </div>
        </div>
        <div className="space-y-3 text-xs">
          {[
            ["Avg Win",           "+$131.00", "var(--color-green)"],
            ["Avg Loss",          "-$180.00", "var(--color-red)"],
            ["Profit Factor",     "2.09",     "var(--color-ink)"],
            ["Expectancy",        "+$65.00",  "var(--color-green)"],
            ["Avg Hold",          "69m",      "var(--color-ink)"],
            ["Best Day",          "-$419.00", "var(--color-red)"],
            ["Worst Day",         "-$706.00", "var(--color-red)"],
            ["Risk / Reward",     "1:0.73",   "var(--color-ink)"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="flex items-center justify-between pb-2 border-b border-[var(--color-line)] last:border-0 last:pb-0">
              <span className="font-medium" style={{ color: "var(--color-faint)" }}>{k}</span>
              <span className="font-bold tnum" style={{ color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Streak */}
      <div className="rounded-xl p-5 card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>Streak</p>
          <span className="text-xs font-black px-2 py-0.5 rounded" style={{ color: "var(--color-red)", background: "rgba(239,68,68,0.12)" }}>2L</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STREAK.map((s, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold transition-transform hover:scale-110"
              style={{
                background: s === "W" ? "var(--color-green-dim)" : "var(--color-red-dim)",
                color: s === "W" ? "var(--color-green)" : "var(--color-red)",
                border: `1px solid ${s === "W" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { connected } = useWallet();
  const [chartTab, setChartTab] = useState<"equity" | "pnl" | "days">("equity");
  const [posTab, setPosTab] = useState<"open" | "history">("open");

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(79,158,255,0.1)]">
          <Zap size={24} style={{ color: "var(--color-mint)" }} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-[var(--color-ink)]">Connect your wallet</h2>
        <p className="text-[var(--color-muted)] mb-8 text-center max-w-md">Connect your Phantom or Solflare wallet to access your dashboard, view performance metrics, and manage your account.</p>
        <button className="btn-primary px-8 py-3 text-sm">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="px-8 py-8 max-w-screen-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: "var(--color-ink)" }}>Dashboard</h1>
          <p className="text-sm font-medium" style={{ color: "var(--color-faint)" }}>Track and analyze your trading performance</p>
        </div>

        {/* Account row */}
        <div className="rounded-xl p-5 mb-6 card flex items-center gap-8 flex-wrap bg-gradient-to-r from-[var(--color-panel)] to-[var(--color-bg)] border-l-4 border-l-[var(--color-mint)]">
          <div className="min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--color-faint)" }}>Account</p>
            <p className="text-lg font-black tracking-tight" style={{ color: "var(--color-ink)" }}>{ACCOUNT.name}</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--color-muted)" }}>{ACCOUNT.status}</p>
          </div>
          {[
            { label: "Size",     value: `$${(ACCOUNT.size/1000).toFixed(0)}k`,    color: undefined },
            { label: "Equity",   value: `$${ACCOUNT.equity.toLocaleString()}`,    color: undefined },
            { label: "Cum. PnL", value: `-$${Math.abs(ACCOUNT.cum_pnl).toLocaleString()}`, color: "var(--color-red)" },
            { label: "Win Rate", value: `${ACCOUNT.win_rate}%`,                   color: undefined },
            { label: "Trades",   value: `${ACCOUNT.trades}`,                      color: undefined },
            { label: "Risk",     value: ACCOUNT.risk,                             color: undefined },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col border-l border-[var(--color-line)] pl-8 first:border-0 first:pl-0">
              <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-faint)" }}>{label}</span>
              <span className="text-lg font-black tnum tracking-tight" style={{ color: color ?? "var(--color-ink)" }}>{value}</span>
            </div>
          ))}
          <div className="ml-auto">
            <span
              className="text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-[0_0_10px_rgba(79,158,255,0.15)]"
              style={{ background: "var(--color-mint-dim)", color: "var(--color-mint)", border: "1px solid rgba(79,158,255,0.3)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] animate-pulse" /> Active
            </span>
          </div>
        </div>

        {/* Main content + right panel */}
        <div className="flex gap-6 flex-col xl:flex-row">
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* Chart card */}
            <div className="rounded-xl card overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-[var(--color-line)] bg-[var(--color-panel-2)]">
                <div className="flex gap-6">
                  {(["equity", "pnl", "days"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartTab(t)}
                      className="pb-3 text-xs font-bold uppercase tracking-widest relative transition-colors"
                      style={{
                        color: chartTab === t ? "var(--color-ink)" : "var(--color-faint)",
                      }}
                    >
                      {t === "equity" ? "Account Equity" : t === "pnl" ? "PnL" : "Trading Days"}
                      {chartTab === t && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-mint)] shadow-[0_0_8px_var(--color-mint)]" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 pb-3">
                  {["1D","7D","30D","ALL"].map((p) => (
                    <button
                      key={p}
                      className="text-[10px] px-2.5 py-1 rounded-md font-bold transition-colors"
                      style={{
                        background: p === "30D" ? "var(--color-mint-dim)" : "transparent",
                        color: p === "30D" ? "var(--color-mint)" : "var(--color-muted)",
                        border: p === "30D" ? "1px solid rgba(79,158,255,0.3)" : "1px solid transparent",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {chartTab === "days" ? (
                /* Calendar grid */
                <div className="p-6">
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                      <div key={d} className="text-[10px] text-center font-bold uppercase tracking-widest py-1" style={{ color: "var(--color-faint)" }}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {/* offset for March starting on Saturday — offset 5 */}
                    {Array(5).fill(null).map((_, i) => <div key={`e${i}`} className="bg-[var(--color-bg)] rounded-lg opacity-20 border border-[var(--color-line)]" />)}
                    {MARCH_DAYS.map((day) => (
                      <div
                        key={day.d}
                        className="rounded-lg p-2.5 min-h-[70px] transition-transform hover:scale-105"
                        style={{
                          background: day.pnl == null
                            ? "var(--color-bg)"
                            : day.pnl > 0
                            ? "var(--color-green-dim)"
                            : "var(--color-red-dim)",
                          border: day.pnl == null
                            ? "1px solid var(--color-line)"
                            : day.pnl > 0
                            ? "1px solid rgba(34,197,94,0.3)"
                            : "1px solid rgba(239,68,68,0.3)",
                        }}
                      >
                        <p className="text-[10px] font-bold mb-1" style={{ color: "var(--color-muted)" }}>{day.d}</p>
                        {day.pnl != null && (
                          <>
                            <p className="text-[11px] font-black tnum tracking-tight" style={{ color: day.pnl > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                              {day.pnl > 0 ? "+" : ""}${Math.abs(day.pnl).toFixed(2)}
                            </p>
                            {day.trades > 0 && (
                              <p className="text-[9px] font-medium mt-1" style={{ color: "var(--color-faint)" }}>{day.trades} Trades</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={260}>
                    {chartTab === "equity" ? (
                      <AreaChart data={EQUITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="eqMint" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-mint)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-mint)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-faint)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--color-faint)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "rgba(15,17,23,0.9)", backdropFilter: "blur(8px)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 12, fontWeight: "bold" }}
                          itemStyle={{ color: "var(--color-mint)" }}
                          labelStyle={{ color: "var(--color-muted)", marginBottom: 4 }}
                        />
                        <Area type="monotone" dataKey="equity" stroke="var(--color-mint)" strokeWidth={2} fill="url(#eqMint)" name="Equity" activeDot={{ r: 4, fill: "var(--color-mint)", stroke: "var(--color-bg)", strokeWidth: 2 }} />
                        <Line type="monotone" dataKey="target" stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Profit Target" />
                        <Line type="monotone" dataKey="daily_dd" stroke="var(--color-gold)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Daily DD" />
                        <Line type="monotone" dataKey="max_dd" stroke="var(--color-red)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Max DD" />
                      </AreaChart>
                    ) : (
                      <LineChart data={PNL_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-faint)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--color-faint)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "rgba(15,17,23,0.9)", backdropFilter: "blur(8px)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 12, fontWeight: "bold" }}
                          itemStyle={{ color: "var(--color-mint)" }}
                          labelStyle={{ color: "var(--color-muted)", marginBottom: 4 }}
                        />
                        <ReferenceLine y={10000} stroke="var(--color-line)" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="pnl" stroke="var(--color-mint)" strokeWidth={2} dot={false} name="PnL" activeDot={{ r: 4, fill: "var(--color-mint)", stroke: "var(--color-bg)", strokeWidth: 2 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  {chartTab === "equity" && (
                    <div className="flex gap-5 mt-4 justify-center">
                      {[
                        { color: "var(--color-mint)", label: "Equity" },
                        { color: "var(--color-accent)", label: "Profit Target", dashed: true },
                        { color: "var(--color-gold)", label: "Daily Drawdown", dashed: true },
                        { color: "var(--color-red)", label: "Max Drawdown", dashed: true },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-2">
                          <div className="w-5 h-0.5 flex-shrink-0" style={{ background: l.color, opacity: l.dashed ? 0.7 : 1 }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Positions */}
            <div className="rounded-xl card overflow-hidden flex-1">
              <div className="flex items-center gap-6 px-5 pt-4 pb-0 border-b border-[var(--color-line)] bg-[var(--color-panel-2)]">
                {(["open", "history"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPosTab(t)}
                    className="pb-3 text-xs font-bold uppercase tracking-widest relative transition-colors"
                    style={{
                      color: posTab === t ? "var(--color-ink)" : "var(--color-faint)",
                    }}
                  >
                    {t === "open" ? "Open Positions" : "Historical Trades"}
                    {posTab === t && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-mint)] shadow-[0_0_8px_var(--color-mint)]" />
                    )}
                  </button>
                ))}
                <div className="ml-auto pb-3">
                  <select
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md outline-none cursor-pointer"
                    style={{ background: "var(--color-panel)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
                  >
                    <option>All Assets</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg)]">
                      {["Position", "Net Size", "Entry Price", "Mark Price", "Realized PnL", "Unrealized PnL", "Time Opened"].map((h) => (
                        <th key={h} className="py-3 px-5 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)", fontSize: "9px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {POSITIONS.map((p, i) => {
                      const isShort = p.dir === "Short";
                      return (
                        <tr key={i} className="border-b border-[var(--color-line)] hover:bg-[var(--color-panel-2)] transition-colors group">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
                                {p.coin.replace("$","")[0]}
                              </div>
                              <div>
                                <p className="font-bold text-sm tracking-tight" style={{ color: "var(--color-ink)" }}>{p.coin}</p>
                                <p
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: isShort ? "var(--color-red)" : "var(--color-green)" }}
                                >
                                  {p.dir}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 tnum font-bold">{p.size.toLocaleString()}</td>
                          <td className="py-4 px-5 tnum" style={{ color: "var(--color-muted)" }}>{p.entry}</td>
                          <td className="py-4 px-5 tnum" style={{ color: "var(--color-ink)" }}>{p.mark}</td>
                          <td className="py-4 px-5 tnum font-bold" style={{ color: p.rpnl.startsWith("-") ? "var(--color-red)" : "var(--color-green)" }}>{p.rpnl}</td>
                          <td className="py-4 px-5 tnum font-black" style={{ color: p.upnl.startsWith("-") ? "var(--color-red)" : "var(--color-green)" }}>{p.upnl}</td>
                          <td className="py-4 px-5 tnum font-mono" style={{ color: "var(--color-faint)" }}>{p.opened}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}