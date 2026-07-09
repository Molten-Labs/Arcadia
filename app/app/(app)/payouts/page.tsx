"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Server, DollarSign, Clock, CheckCircle,
  ExternalLink, Zap, ArrowRight,
} from "lucide-react";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { formatUSD } from "@/lib/types";

const DEMO = MOCK_TRADERS[0];
const TIER_SPLIT: Record<string, number> = {
  Elite: 35, Advanced: 30, Established: 25, Verified: 20,
};

const RESERVE_DATA  = [120,140,200,180,220,260,280,320,290,340,360].map((v,i) => ({ v, i }));
const PAYOUT_DATA   = [80,120,160,140,200,180,220,260,240].map((v,i) => ({ v, i }));
const TIME_DATA     = [1.2,1.5,1.8,2.1,1.6,1.9,1.4,1.7].map((v,i) => ({ v, i }));

const RECENT_PAYOUTS = [
  { date: "1 Jun 26",  status: "Pending", hash: "5Nn7x3KqBz…R4mP", amount: 5200 },
  { date: "12 May 26", status: "Paid",    hash: "4PqRtLv9Xw…M3kN", amount: 6810 },
  { date: "28 Apr 26", status: "Paid",    hash: "3WmKpTs8Yq…V7jL", amount: 1867 },
  { date: "15 Mar 26", status: "Paid",    hash: "2VnLrTu6Xp…K2hM", amount: 1899 },
  { date: "3 Feb 26",  status: "Paid",    hash: "7JtMvPq4Wr…N8fK", amount: 1899 },
];

/* On-chain state steps */
const ON_CHAIN_STEPS = [
  { label: "Update Account", status: "done"       },
  { label: "Update Equity",  status: "done"       },
  { label: "Pass Evaluation",status: "done"       },
  { label: "Sign Agreement", status: "done"       },
  { label: "Process Withdrawal", status: "pending" },
];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeSig() {
  return Array.from({ length: 88 }, () => B58[Math.floor(Math.random() * 58)]).join("");
}

function MiniBar({ data, color = "var(--color-mint)" }: { data: { v: number; i: number }[]; color?: string }) {
  const W = 80, H = 36;
  const max = Math.max(...data.map(d => d.v));
  const barW = 5;
  const gap = (W - barW * data.length) / (data.length - 1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.v / max) * (H - 4));
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - barH}
            width={barW}
            height={barH}
            rx={1.5}
            fill={color}
            opacity={0.35 + (i / data.length) * 0.65}
          />
        );
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

  const traderSplit  = TIER_SPLIT[DEMO.tier] ?? 20;
  const platformSplit = 5;
  const MAX_WITHDRAWABLE = 10000;
  const SUB_ACCOUNT_PROFIT = 14414.13;

  const grossAmount    = parseFloat(amount || "0");
  const traderPayout   = grossAmount * (traderSplit / 100);
  const platformFee    = grossAmount * (platformSplit / 100);
  const investorPayout = grossAmount - traderPayout - platformFee;

  const handleConfirm = () => {
    if (!amount) return;
    setSubmitting(true);
    setTxHash(null);
    setTimeout(() => { setSubmitting(false); setTxHash(fakeSig()); }, 1800);
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--color-panel)", border: "1px solid var(--color-line)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Zap size={22} style={{ color: "var(--color-mint)" }} />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-ink)", marginBottom: 8 }}>Connect your wallet</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", textAlign: "center", maxWidth: 320 }}>
          Connect to view payouts, on-chain payout reserve, and request profit settlements.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)" }}>
      <div style={{ padding: "1.75rem clamp(1.25rem, 4vw, 2.5rem)", maxWidth: 1200 }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-ink)", letterSpacing: "-0.04em", marginBottom: 4 }}>
            Payouts
          </h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-faint)" }}>
            Get payouts on funded accounts anytime, instantly to your wallet.
          </p>
        </div>

        {/* ── Top stat cards (3-col) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
          {/* Payout Reserve */}
          <div className="card" style={{ padding: "1.125rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Server size={13} style={{ color: "var(--color-mint)" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-ink)" }}>Payout Reserve</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <a href="#" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-green)", textDecoration: "none" }}>
                  On-chain <ExternalLink size={8} />
                </a>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 900, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>$742,414</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", marginTop: 3 }}>On-chain and verifiable payout reserve</p>
              </div>
              <MiniBar data={RESERVE_DATA} color="var(--color-mint)" />
            </div>
          </div>

          {/* Total Payouts */}
          <div className="card" style={{ padding: "1.125rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "0.75rem" }}>
              <DollarSign size={13} style={{ color: "var(--color-green)" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-ink)" }}>Total Payouts Issued</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 900, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>$28,592</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", marginTop: 3 }}>All time</p>
              </div>
              <MiniBar data={PAYOUT_DATA} color="var(--color-green)" />
            </div>
          </div>

          {/* Avg Payout Time */}
          <div className="card" style={{ padding: "1.125rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "0.75rem" }}>
              <Clock size={13} style={{ color: "var(--color-gold)" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-ink)" }}>Avg. Payout Time</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 900, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>1.8s</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", marginTop: 3 }}>All time · Solana native speed</p>
              </div>
              <MiniBar data={TIME_DATA} color="var(--color-gold)" />
            </div>
          </div>
        </div>

        {/* ── Big stats: Sub-Account Profit + Withdrawable + On-chain steps ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
          {/* Sub-Account Profit */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "0.5rem" }}>
              Sub-Account Profit
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: "clamp(1.25rem, 2vw, 1.75rem)", color: "var(--color-green)", letterSpacing: "-0.04em" }}>
              +{formatUSD(SUB_ACCOUNT_PROFIT)}
            </p>
            <p style={{ fontSize: "0.6875rem", color: "var(--color-faint)", marginTop: 4 }}>All-time sub-account gains</p>
          </div>

          {/* Withdrawable Profits */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "0.5rem" }}>
              Withdrawable Profits
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: "clamp(1.25rem, 2vw, 1.75rem)", color: "var(--color-ink)", letterSpacing: "-0.04em" }}>
              {formatUSD(MAX_WITHDRAWABLE)}
            </p>
            <p style={{ fontSize: "0.6875rem", color: "var(--color-faint)", marginTop: 4 }}>
              Ready for instant payout · Above HWM
            </p>
          </div>

          {/* On-chain State Updates */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "0.875rem" }}>
              On-chain State Updates
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {ON_CHAIN_STEPS.map((step, i) => (
                <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step.status === "done" ? "var(--color-green-dim)" : "var(--color-panel-2)",
                    border: `1px solid ${step.status === "done" ? "rgba(34,197,94,0.3)" : "var(--color-line)"}`,
                  }}>
                    {step.status === "done"
                      ? <CheckCircle size={10} style={{ color: "var(--color-green)" }} />
                      : <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-gold)" }} />
                    }
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    color: step.status === "done" ? "var(--color-muted)" : "var(--color-ink)",
                    fontWeight: step.status !== "done" ? 700 : 400,
                  }}>
                    {step.label}
                  </span>
                  {i < ON_CHAIN_STEPS.length - 1 && step.status === "done" && (
                    <ArrowRight size={8} style={{ color: "var(--color-faint)", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tier row ── */}
        <div className="card" style={{
          padding: "0.875rem 1.25rem",
          display: "flex", alignItems: "center", gap: "2rem",
          flexWrap: "wrap", marginBottom: "1.25rem",
        }}>
          {[
            { label: "Your tier",    value: `${DEMO.tier} · Score ${DEMO.score}`,      color: "var(--color-ink)"   },
            { label: "Trader split", value: `${traderSplit}% of profit above HWM`,      color: "var(--color-mint)"  },
            { label: "Platform fee", value: `${platformSplit}%`,                         color: "var(--color-muted)" },
            { label: "Investor gets",value: `${100 - traderSplit - platformSplit}%`,    color: "var(--color-ink)"   },
          ].map((item, i) => (
            <div key={item.label} style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
              {i > 0 && <div style={{ width: 1, height: 28, background: "var(--color-line)", flexShrink: 0 }} />}
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 3 }}>
                  {item.label}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 800, color: item.color, letterSpacing: "-0.02em" }}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Request + Recent ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

          {/* Request Payout */}
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)", marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
              Request Payout
            </p>
            <div className="card" style={{ padding: "1.25rem" }}>
              <p style={{ fontSize: "0.6875rem", color: "var(--color-faint)", marginBottom: "0.875rem" }}>
                Profit above HWM:{" "}
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--color-green)" }}>
                  {formatUSD(MAX_WITHDRAWABLE)}
                </span>
              </p>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", display: "block", marginBottom: 6 }}>
                  Enter USDC Amount
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setPct(Math.round(parseFloat(e.target.value || "0") / MAX_WITHDRAWABLE * 100));
                    }}
                    placeholder="0.00"
                    className="input-dark"
                    style={{ flex: 1, padding: "9px 12px", fontSize: "0.875rem" }}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-muted)", flexShrink: 0 }}>USDC</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => { const v = MAX_WITHDRAWABLE * p / 100; setAmount(v.toString()); setPct(p); }}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 6,
                      background: pct === p ? "var(--color-mint)" : "var(--color-panel-2)",
                      color: pct === p ? "#ffffff" : "var(--color-faint)",
                      border: `1px solid ${pct === p ? "rgba(79,158,255,0.4)" : "var(--color-line)"}`,
                      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>

              {/* Breakdown */}
              {grossAmount > 0 && (
                <div style={{
                  borderRadius: 8, padding: "1rem", marginBottom: "1rem",
                  background: "var(--color-panel-2)", border: "1px solid var(--color-line)",
                  animation: "fade-in 0.2s ease",
                }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "0.75rem" }}>
                    Payout details
                  </p>
                  {[
                    { label: `${DEMO.tier} profit split`, value: `${traderSplit}%`, valueStr: formatUSD(traderPayout), positive: true },
                    { label: `Payout post profit split`, value: null, valueStr: formatUSD(grossAmount - traderPayout), positive: false },
                    { label: `Equity after payout`,      value: null, valueStr: formatUSD(22000),                       positive: false },
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                        {r.label}:
                        {r.value && <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-faint)", marginLeft: 4 }}>{r.value}</span>}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: r.positive ? "var(--color-mint)" : "var(--color-ink)" }}>
                        {r.positive ? "+" : ""}{r.valueStr}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 8, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)" }}>Platform fee ({platformSplit}%)</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-red)" }}>
                        -{formatUSD(platformFee)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {txHash ? (
                <div style={{ borderRadius: 8, padding: "1rem", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span className="t-success-check" data-state="in">
                      <CheckCircle size={14} style={{ color: "var(--color-green)" }} />
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-green)" }}>Payout sent (devnet)</span>
                  </div>
                  <a href={`https://solscan.io/tx/${txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-mint)", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
                    {txHash.slice(0, 8)}…{txHash.slice(-6)} <ExternalLink size={9} />
                  </a>
                  <button onClick={() => { setTxHash(null); setAmount(""); setPct(0); }} style={{
                    width: "100%", padding: "7px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 600,
                    background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-faint)", cursor: "pointer",
                  }}>
                    Request another
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={submitting || !amount || grossAmount <= 0}
                  style={{
                    width: "100%", padding: "11px", borderRadius: 8,
                    background: "var(--color-mint)", color: "#ffffff",
                    fontWeight: 700, fontSize: "0.875rem", border: "none",
                    cursor: submitting || !amount ? "not-allowed" : "pointer",
                    opacity: submitting || !amount || grossAmount <= 0 ? 0.5 : 1,
                    transition: "opacity 0.15s, background 0.15s",
                    boxShadow: grossAmount > 0 ? "0 0 20px rgba(79,158,255,0.2)" : "none",
                  }}
                  onMouseEnter={(e) => { if (grossAmount > 0) e.currentTarget.style.background = "var(--color-mint-bright)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-mint)"; }}
                >
                  {submitting ? "Processing…" : "Confirm Payout"}
                </button>
              )}
            </div>
          </div>

          {/* Recent Payouts */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.01em" }}>
                Recent Payouts
              </p>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                This Account
              </span>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {/* Table headers */}
              <div style={{
                display: "grid", gridTemplateColumns: "4rem 1fr 4rem 4.5rem 5.5rem",
                gap: "0.5rem", padding: "0.625rem 1rem",
                borderBottom: "1px solid var(--color-line)", background: "var(--color-panel-2)",
              }}>
                {["Date", "Account", "Status", "TX Hash", "Amount"].map((h) => (
                  <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                    {h}
                  </span>
                ))}
              </div>

              {RECENT_PAYOUTS.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "4rem 1fr 4rem 4.5rem 5.5rem",
                    gap: "0.5rem", padding: "0.75rem 1rem",
                    borderBottom: i < RECENT_PAYOUTS.length - 1 ? "1px solid var(--color-line)" : "none",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-faint)" }}>{r.date}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-muted)" }}>E1</span>
                  <span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                      padding: "2px 7px", borderRadius: 4,
                      background: r.status === "Pending" ? "var(--color-mint-dim)" : "rgba(34,197,94,0.1)",
                      color: r.status === "Pending" ? "var(--color-mint)" : "var(--color-green)",
                      border: `1px solid ${r.status === "Pending" ? "rgba(79,158,255,0.25)" : "rgba(34,197,94,0.25)"}`,
                    }}>
                      {r.status === "Paid" ? "✓ Paid" : r.status}
                    </span>
                  </span>
                  <span>
                    <a href={`https://solscan.io/tx/${r.hash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-mint)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none", transition: "opacity 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {r.hash.slice(0, 6)} <ExternalLink size={8} />
                    </a>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-green)", textAlign: "right" }}>
                    +{formatUSD(r.amount, 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
