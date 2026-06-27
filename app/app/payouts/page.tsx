"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BarChart, Bar, ResponsiveContainer } from "recharts";
import { Server, DollarSign, Clock, CheckCircle, RotateCcw } from "lucide-react";

const RESERVE_DATA = [120,140,200,180,220,260,280,320,290,340,360].map((v,i) => ({ v, i }));
const PAYOUT_DATA  = [80,120,160,140,200,180,220,260,240].map((v,i) => ({ v, i }));
const TIME_DATA    = [1.2,1.5,1.8,2.1,1.6,1.9,1.4,1.7].map((v,i) => ({ v, i }));

const RECENT_PAYOUTS = [
  { date: "1 Feb 26",  account: "E1", status: "Pending", hash: "0x3...211", amount: "5,200 USD" },
  { date: "31 Jan 26", account: "E2", status: "Paid",    hash: "0x4...fd1", amount: "6,810 USD" },
  { date: "12 Dec 25", account: "E1", status: "Paid",    hash: "0x4...92D", amount: "1,867 USD" },
  { date: "26 Nov 25", account: "E2", status: "Paid",    hash: "0x4...151", amount: "1,899 USD" },
  { date: "20 Nov 25", account: "E1", status: "Paid",    hash: "0x4...x0A", amount: "1,899 USD" },
];

const STEPS = [
  { label: "Create Account",      done: true  },
  { label: "Update Equity",       done: true  },
  { label: "Pass Evaluation",     done: true  },
  { label: "Sign Agreement",      done: true  },
  { label: "Process Withdrawal",  done: false },
];

function MiniBar({ data }: { data: { v: number; i: number }[] }) {
  const W = 80, H = 40;
  const max = Math.max(...data.map(d => d.v));
  const barW = 5;
  const gap = (W - barW * data.length) / (data.length - 1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.v / max) * (H - 4));
        const x = i * (barW + gap);
        const y = H - barH;
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH} rx={1} fill="var(--color-purple-bright)" opacity={0.7 + (i / data.length) * 0.3} />
        );
      })}
    </svg>
  );
}

export default function PayoutsPage() {
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);
  const MAX = 10000;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = () => {
    if (!amount) return;
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setDone(true); }, 2000);
  };

  const profit_split = 10;
  const post_split = parseFloat(amount || "0") * (1 - profit_split / 100);
  const equity_after = 22000 + post_split;

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--color-ink)" }}>Payouts</h1>
        <p className="text-xs mb-5" style={{ color: "var(--color-faint)" }}>
          Get payouts on funded accounts anytime, instantly to your wallet.
        </p>

        {/* Top stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Payout Reserve */}
          <div className="rounded p-4 card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Server size={13} style={{ color: "var(--color-purple-bright)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Payout Reserve</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-green)" }}>On-chain ↗</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black tnum" style={{ color: "var(--color-ink)" }}>$742,414</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>On-chain and verifiable payout reserve</p>
              </div>
              <MiniBar data={RESERVE_DATA} />
            </div>
          </div>

          {/* Total Payouts */}
          <div className="rounded p-4 card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <DollarSign size={13} style={{ color: "var(--color-green)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Total Payouts Issued</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black tnum" style={{ color: "var(--color-ink)" }}>$28,592</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>All time</p>
              </div>
              <MiniBar data={PAYOUT_DATA} />
            </div>
          </div>

          {/* Avg Payout Time */}
          <div className="rounded p-4 card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: "var(--color-gold)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Avg. Payout Time</p>
              </div>
              <div className="flex gap-2 text-[10px]" style={{ color: "var(--color-faint)" }}>
                <span>1.6x</span><span style={{ color: "var(--color-ink)" }}>1.8s</span><span>2.1x</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black tnum" style={{ color: "var(--color-ink)" }}>1.8s</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>All time</p>
              </div>
              <MiniBar data={TIME_DATA} />
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded p-4 card">
            <div className="flex items-center gap-1.5 mb-2">
              <Server size={12} style={{ color: "var(--color-purple-bright)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Sub-Account Profit</p>
            </div>
            <p className="text-2xl font-black tnum" style={{ color: "var(--color-green)" }}>$14,414.13</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>All-time sub-account gains</p>
          </div>
          <div className="rounded p-4 card">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle size={12} style={{ color: "var(--color-green)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Withdrawable Profits</p>
            </div>
            <p className="text-2xl font-black tnum" style={{ color: "var(--color-ink)" }}>$10,000</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>Ready for instant payout</p>
          </div>
          <div className="rounded p-4 card">
            <div className="flex items-center gap-1.5 mb-2">
              <RotateCcw size={12} style={{ color: "var(--color-muted)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>On-chain State Updates</p>
            </div>
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {STEPS.map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: s.done ? "rgba(34,197,94,0.1)" : "rgba(124,58,237,0.1)",
                      color: s.done ? "var(--color-green)" : "var(--color-purple-bright)",
                      border: `1px solid ${s.done ? "rgba(34,197,94,0.2)" : "rgba(124,58,237,0.2)"}`,
                    }}
                  >
                    {s.done ? "✓ Done" : "↻ In Progress"}
                    <span className="font-medium ml-0.5">{s.label} ↗</span>
                  </div>
                  {i < STEPS.length - 1 && <span style={{ color: "var(--color-line)" }}>—</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Request + Recent */}
        <div className="grid grid-cols-2 gap-4">
          {/* Request Payout */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-ink)" }}>Request Payout</p>
            <div className="rounded card p-4">
              <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--color-faint)" }}>Enter USDC Amount</p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setPct(Math.round(parseFloat(e.target.value || "0") / MAX * 100)); }}
                  placeholder="Amount..."
                  className="flex-1 rounded px-3 py-2 text-sm outline-none tnum"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                />
                <span className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
                  {(MAX / 1000).toFixed(3)} USD
                </span>
              </div>
              <div className="flex gap-2 mb-4">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => { const v = MAX * p / 100; setAmount(v.toString()); setPct(p); }}
                    className="text-[10px] px-2 py-1 rounded font-medium"
                    style={{
                      background: pct === p ? "var(--color-purple)" : "var(--color-panel-2)",
                      color: pct === p ? "#fff" : "var(--color-faint)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>

              {/* Payout details */}
              <div className="rounded p-4" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--color-muted)" }}>📋 Payout details</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--color-faint)" }}>Hypernova profit split:</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>{profit_split}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--color-faint)" }}>Payout post profit split</span>
                    <span className="text-xs font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      ${post_split > 0 ? post_split.toFixed(0) : "2,700"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--color-faint)" }}>Equity after payout:</span>
                    <span className="text-xs font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      ${equity_after > 22000 ? equity_after.toLocaleString() : "22,000"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={submitting || done || !amount}
                className="w-full py-2.5 rounded text-sm font-semibold mt-4 transition-all disabled:opacity-50"
                style={{ background: "var(--color-purple)", color: "#fff" }}
              >
                {done ? "✓ Payout Requested" : submitting ? "Processing…" : "Confirm Payout"}
              </button>
            </div>
          </div>

          {/* Recent Payouts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Recent Payouts</p>
              <select
                className="text-[10px] px-2 py-1 rounded outline-none"
                style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}
              >
                <option>This Account ▾</option>
              </select>
            </div>
            <div className="rounded card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                    {["Date ↑","Account","Status","TX Hash","Amount"].map((h) => (
                      <th key={h} className="py-2.5 px-3 text-left font-medium" style={{ color: "var(--color-faint)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_PAYOUTS.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-[var(--color-panel-2)] transition-colors"
                      style={{ borderBottom: "1px solid var(--color-line)" }}
                    >
                      <td className="py-2.5 px-3 tnum" style={{ color: "var(--color-muted)" }}>{r.date}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--color-panel-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}>
                          {r.account}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-semibold"
                          style={{
                            background: r.status === "Pending" ? "rgba(124,58,237,0.12)" : "rgba(34,197,94,0.12)",
                            color: r.status === "Pending" ? "var(--color-purple-bright)" : "var(--color-green)",
                            border: `1px solid ${r.status === "Pending" ? "rgba(124,58,237,0.25)" : "rgba(34,197,94,0.25)"}`,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono" style={{ color: "var(--color-purple-bright)" }}>{r.hash}</td>
                      <td className="py-2.5 px-3 tnum font-semibold" style={{ color: "var(--color-ink)" }}>
                        {r.amount} <span className="text-[10px]">↑</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
