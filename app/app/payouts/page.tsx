"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Server, DollarSign, Clock, CheckCircle, ExternalLink } from "lucide-react";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { formatUSD } from "@/lib/types";

const DEMO = MOCK_TRADERS[0];
const TIER_SPLIT: Record<string, number> = {
  Elite: 35, Advanced: 30, Established: 25, Verified: 20,
};

const RESERVE_DATA = [120,140,200,180,220,260,280,320,290,340,360].map((v,i) => ({ v, i }));
const PAYOUT_DATA  = [80,120,160,140,200,180,220,260,240].map((v,i) => ({ v, i }));
const TIME_DATA    = [1.2,1.5,1.8,2.1,1.6,1.9,1.4,1.7].map((v,i) => ({ v, i }));

const RECENT_PAYOUTS = [
  { date: "1 Jun 26",  status: "Pending", hash: "5Nn7x3KqBz…R4mP", amount: 5200 },
  { date: "12 May 26", status: "Paid",    hash: "4PqRtLv9Xw…M3kN", amount: 6810 },
  { date: "28 Apr 26", status: "Paid",    hash: "3WmKpTs8Yq…V7jL", amount: 1867 },
  { date: "15 Mar 26", status: "Paid",    hash: "2VnLrTu6Xp…K2hM", amount: 1899 },
  { date: "3 Feb 26",  status: "Paid",    hash: "7JtMvPq4Wr…N8fK", amount: 1899 },
];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeSig() {
  return Array.from({ length: 88 }, () => B58[Math.floor(Math.random() * 58)]).join("");
}

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
        return <rect key={i} x={x} y={y} width={barW} height={barH} rx={1} fill="var(--color-mint)" opacity={0.5 + (i / data.length) * 0.5} />;
      })}
    </svg>
  );
}

export default function PayoutsPage() {
  const { connected } = useWallet();
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const traderSplit = TIER_SPLIT[DEMO.tier] ?? 20;
  const platformSplit = 5;
  const MAX_WITHDRAWABLE = 10000;

  const grossAmount = parseFloat(amount || "0");
  const traderPayout = grossAmount * (traderSplit / 100);
  const platformFee = grossAmount * (platformSplit / 100);
  const investorPayout = grossAmount - traderPayout - platformFee;

  const handleConfirm = () => {
    if (!amount) return;
    setSubmitting(true);
    setTxHash(null);
    setTimeout(() => {
      setSubmitting(false);
      setTxHash(fakeSig());
    }, 1800);
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Connect wallet to view payouts</p>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--color-ink)" }}>Payouts</h1>
        <p className="text-xs mb-5" style={{ color: "var(--color-faint)" }}>
          Request profit share above HWM — instantly to your wallet.
        </p>

        {/* Top stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded p-4 card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Server size={13} style={{ color: "var(--color-mint)" }} />
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

          <div className="rounded p-4 card">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign size={13} style={{ color: "var(--color-green)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Total Payouts Issued</p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black tnum" style={{ color: "var(--color-ink)" }}>$28,592</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>All time</p>
              </div>
              <MiniBar data={PAYOUT_DATA} />
            </div>
          </div>

          <div className="rounded p-4 card">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={13} style={{ color: "var(--color-gold)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Avg. Payout Time</p>
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

        {/* Tier callout */}
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-4"
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
        >
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Your tier</p>
            <p className="text-base font-black" style={{ color: "var(--color-accent)" }}>{DEMO.tier} · Score {DEMO.score}</p>
          </div>
          <div className="h-8 w-px" style={{ background: "var(--color-line)" }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Trader split</p>
            <p className="text-base font-black" style={{ color: "var(--color-mint)" }}>{traderSplit}% of profit above HWM</p>
          </div>
          <div className="h-8 w-px" style={{ background: "var(--color-line)" }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Platform fee</p>
            <p className="text-base font-black" style={{ color: "var(--color-muted)" }}>{platformSplit}%</p>
          </div>
          <div className="h-8 w-px" style={{ background: "var(--color-line)" }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Investor gets</p>
            <p className="text-base font-black" style={{ color: "var(--color-ink)" }}>{100 - traderSplit - platformSplit}%</p>
          </div>
        </div>

        {/* Request + Recent */}
        <div className="grid grid-cols-2 gap-4">
          {/* Request Payout */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-ink)" }}>Request Payout</p>
            <div className="rounded card p-4">
              <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--color-faint)" }}>
                Profit above HWM available: <span className="font-black tnum" style={{ color: "var(--color-green)" }}>{formatUSD(MAX_WITHDRAWABLE)}</span>
              </p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setPct(Math.round(parseFloat(e.target.value || "0") / MAX_WITHDRAWABLE * 100)); }}
                  placeholder="Amount…"
                  className="flex-1 rounded px-3 py-2 text-sm outline-none tnum"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                />
                <span className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>USDC</span>
              </div>
              <div className="flex gap-2 mb-4">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => { const v = MAX_WITHDRAWABLE * p / 100; setAmount(v.toString()); setPct(p); }}
                    className="text-[10px] px-2 py-1 rounded font-medium flex-1"
                    style={{
                      background: pct === p ? "var(--color-mint)" : "var(--color-panel-2)",
                      color: pct === p ? "#ffffff" : "var(--color-faint)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>

              {/* Split breakdown */}
              {grossAmount > 0 && (
                <div className="rounded p-4 mb-4" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
                  <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--color-muted)" }}>Payout breakdown</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--color-faint)" }}>Gross profit above HWM</span>
                      <span className="font-bold tnum" style={{ color: "var(--color-ink)" }}>{formatUSD(grossAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--color-faint)" }}>Your share ({traderSplit}% · {DEMO.tier})</span>
                      <span className="font-black tnum" style={{ color: "var(--color-green)" }}>+{formatUSD(traderPayout)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--color-faint)" }}>Platform fee ({platformSplit}%)</span>
                      <span className="tnum" style={{ color: "var(--color-red)" }}>-{formatUSD(platformFee)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
                      <span className="font-bold" style={{ color: "var(--color-ink)" }}>Investor NAV increase</span>
                      <span className="font-bold tnum" style={{ color: "var(--color-ink)" }}>{formatUSD(investorPayout)}</span>
                    </div>
                  </div>
                </div>
              )}

              {txHash ? (
                <div className="rounded p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} style={{ color: "var(--color-green)" }} />
                    <span className="text-xs font-bold" style={{ color: "var(--color-green)" }}>Payout sent (devnet)</span>
                  </div>
                  <a
                    href={`https://solscan.io/tx/${txHash}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-[10px] transition-opacity hover:opacity-70"
                    style={{ color: "var(--color-mint)" }}
                  >
                    <span>{txHash.slice(0, 8)}…{txHash.slice(-6)}</span>
                    <ExternalLink size={10} />
                  </a>
                  <button
                    onClick={() => { setTxHash(null); setAmount(""); setPct(0); }}
                    className="mt-2 w-full py-1.5 rounded text-xs font-bold"
                    style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}
                  >
                    Request another
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={submitting || !amount || grossAmount <= 0}
                  className="w-full py-2.5 rounded text-sm font-semibold mt-1 transition-all disabled:opacity-50"
                  style={{ background: "var(--color-mint)", color: "#ffffff" }}
                >
                  {submitting ? "Processing…" : "Confirm Payout"}
                </button>
              )}
            </div>
          </div>

          {/* Recent Payouts */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-ink)" }}>Recent Payouts</p>
            <div className="rounded card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                    {["Date", "Status", "Amount", "Verify"].map((h) => (
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
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-semibold"
                          style={{
                            background: r.status === "Pending" ? "var(--color-mint-dim)" : "rgba(34,197,94,0.12)",
                            color: r.status === "Pending" ? "var(--color-mint)" : "var(--color-green)",
                            border: `1px solid ${r.status === "Pending" ? "rgba(79,158,255,0.25)" : "rgba(34,197,94,0.25)"}`,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 tnum font-semibold" style={{ color: "var(--color-ink)" }}>
                        +{formatUSD(r.amount, 0)}
                      </td>
                      <td className="py-2.5 px-3">
                        <a
                          href={`https://solscan.io/tx/${r.hash.replace("…", "AAAA")}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-mono text-[10px] transition-opacity hover:opacity-70"
                          style={{ color: "var(--color-mint)" }}
                        >
                          <span>{r.hash.slice(0, 6)}…</span>
                          <ExternalLink size={9} />
                        </a>
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
