"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { X, ExternalLink, CheckCircle, AlertCircle, Zap, Loader2 } from "lucide-react";
import { useArcadiaVault, type VaultTxPhase } from "@/lib/use-arcadia-vault";
import type { TraderProfile } from "@/lib/types";
import { formatUSD, tierColor } from "@/lib/types";
import { TierBadge } from "./TierBadge";

const PRESETS = [100, 500, 1_000, 5_000, 10_000];

const STEP_ORDER: VaultTxPhase[] = ["checking", "init-investor", "signing", "confirming", "success"];

interface DepositModalProps {
  trader: TraderProfile;
  onClose: () => void;
}

export function DepositModal({ trader, onClose }: DepositModalProps) {
  const { publicKey } = useWallet();
  const { deposit, txState, resetTx } = useArcadiaVault();
  const [amount, setAmount] = useState("");

  const isConnected = !!publicKey;
  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount >= 1;

  const { phase } = txState;
  const isActive = phase !== "idle";
  const isDone = phase === "success";
  const isError = phase === "error";
  const inProgress = isActive && !isDone && !isError;
  const currentStepIdx = STEP_ORDER.indexOf(phase);

  const capacityLeft = trader.capacity.total - trader.capacity.used;
  const tc = tierColor(trader.tier);

  const handleDeposit = () => {
    if (!isConnected || !isValid) return;
    void deposit(trader.wallet, parsedAmount);
  };

  const STEPS: { key: VaultTxPhase; label: string }[] = [
    { key: "init-investor", label: "Init investor account" },
    { key: "signing",       label: "Sign transaction"      },
    { key: "confirming",    label: "Confirming on Solana"  },
    { key: "success",       label: "Deposit confirmed"     },
  ];
  const relevantSteps = phase === "init-investor" || currentStepIdx >= STEP_ORDER.indexOf("init-investor")
    ? STEPS
    : STEPS.filter(s => s.key !== "init-investor");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#080808",
          border: "1px solid #1e1e1e",
          borderRadius: 18,
          width: "100%", maxWidth: 440,
          overflow: "hidden",
          boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)",
          animation: "fade-in 0.16s ease",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "1.125rem 1.375rem",
          borderBottom: "1px solid #151515",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, #0c0620 0%, #080c1c 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: `${tc}18`,
              border: `1px solid ${tc}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 900, color: tc, flexShrink: 0,
            }}>
              {trader.handle.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#f0f0f0" }}>@{trader.handle}</span>
                <TierBadge tier={trader.tier} size="sm" />
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3a3a3a", margin: 0 }}>
                Fund Vault · Solana Devnet
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#404040", padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #151515" }}>
          {[
            { label: "Score",        value: trader.score.toString(),                     color: "#f0f0f0" },
            { label: "30d Return",   value: `+${trader.metrics.return_30d.toFixed(1)}%`, color: "#22c55e" },
            { label: "Cap. Left",    value: formatUSD(capacityLeft, 0),                  color: "#f0f0f0" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "0.7rem 0.875rem", borderRight: i < 2 ? "1px solid #151515" : "none", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#383838", marginBottom: 3 }}>{s.label}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "1.375rem" }}>

          {/* ── Form (idle) ── */}
          {!isActive && (
            <>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#383838", marginBottom: 8 }}>USDC Amount</p>
              <div style={{ position: "relative", marginBottom: "0.875rem" }}>
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontFamily: "var(--font-mono)", fontSize: "1.375rem", fontWeight: 700, color: "#383838",
                  pointerEvents: "none",
                }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  autoFocus
                  style={{
                    width: "100%", padding: "13px 14px 13px 30px",
                    background: "#050505", border: "1px solid #1e1e1e",
                    borderRadius: 10, color: "#f0f0f0",
                    fontFamily: "var(--font-mono)", fontSize: "1.625rem", fontWeight: 800,
                    letterSpacing: "-0.03em", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(79,158,255,0.45)")}
                  onBlur={e => (e.target.style.borderColor = "#1e1e1e")}
                />
              </div>

              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: "1.25rem" }}>
                {PRESETS.map(p => {
                  const selected = parsedAmount === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setAmount(String(p))}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                        padding: "5px 12px", borderRadius: 6,
                        background: selected ? "rgba(79,158,255,0.12)" : "rgba(255,255,255,0.03)",
                        border: selected ? "1px solid rgba(79,158,255,0.4)" : "1px solid #1a1a1a",
                        color: selected ? "#4f9eff" : "#555",
                        cursor: "pointer", transition: "all 0.12s",
                      }}
                    >
                      ${p >= 1000 ? `${p / 1000}k` : p}
                    </button>
                  );
                })}
              </div>

              {!isConnected && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#f59e0b",
                  background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                  padding: "8px 12px", borderRadius: 8, textAlign: "center", marginBottom: "0.875rem",
                }}>
                  Connect wallet to deposit
                </div>
              )}

              <button
                onClick={handleDeposit}
                disabled={!isConnected || !isValid}
                style={{
                  width: "100%", padding: "13px",
                  background: isConnected && isValid ? "#4f9eff" : "#111",
                  border: "none", borderRadius: 10,
                  color: isConnected && isValid ? "#fff" : "#333",
                  fontWeight: 800, fontSize: "0.9375rem",
                  letterSpacing: "-0.01em",
                  cursor: isConnected && isValid ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                  boxShadow: isConnected && isValid ? "0 0 28px rgba(79,158,255,0.28)" : "none",
                }}
                onMouseEnter={e => { if (isConnected && isValid) (e.currentTarget as HTMLButtonElement).style.background = "#74b5ff"; }}
                onMouseLeave={e => { if (isConnected && isValid) (e.currentTarget as HTMLButtonElement).style.background = "#4f9eff"; }}
              >
                {!isConnected
                  ? "Connect Wallet"
                  : !isValid
                  ? "Enter Amount"
                  : `Deposit ${parsedAmount > 0 ? formatUSD(parsedAmount, 0) : ""} USDC`}
              </button>
            </>
          )}

          {/* ── In-progress steps ── */}
          {inProgress && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0.25rem 0" }}>
              {relevantSteps.map((s, idx) => {
                const sIdx = STEP_ORDER.indexOf(s.key);
                const done = sIdx < currentStepIdx;
                const current = s.key === phase;
                const pending = !done && !current;
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, opacity: pending ? 0.28 : 1, transition: "opacity 0.3s" }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "rgba(34,197,94,0.12)" : current ? "rgba(79,158,255,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${done ? "rgba(34,197,94,0.35)" : current ? "rgba(79,158,255,0.4)" : "#1a1a1a"}`,
                    }}>
                      {done
                        ? <CheckCircle size={13} style={{ color: "#22c55e" }} />
                        : current
                        ? <Loader2 size={13} className="animate-spin" style={{ color: "#4f9eff" }} />
                        : <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#333", fontWeight: 700 }}>{idx + 1}</span>}
                    </div>
                    <div>
                      <p style={{ fontSize: "0.8125rem", fontWeight: done || current ? 600 : 400, color: done ? "#22c55e" : current ? "#f0f0f0" : "#444", margin: 0 }}>
                        {s.label}
                      </p>
                      {current && (
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#404040", margin: 0, marginTop: 1 }}>
                          {txState.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Success ── */}
          {isDone && (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1rem",
              }}>
                <CheckCircle size={22} style={{ color: "#22c55e" }} />
              </div>
              <p style={{ fontWeight: 800, fontSize: "1rem", color: "#f0f0f0", marginBottom: 5 }}>
                {formatUSD(parsedAmount, 0)} USDC {txState.simulated ? "deposit simulated" : "deposited"}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#5a5a5a", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                {txState.simulated ? (
                  <>
                    Simulated flow — the vault program is not live on devnet, so no
                    on-chain transaction was sent.
                  </>
                ) : (
                  <>Your position in @{trader.handle}&apos;s vault is live</>
                )}
              </p>
              {txState.sig && (
                <a
                  href={`https://solscan.io/tx/${txState.sig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "#4f9eff",
                    background: "rgba(79,158,255,0.07)", border: "1px solid rgba(79,158,255,0.2)",
                    padding: "7px 14px", borderRadius: 7, textDecoration: "none",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Zap size={10} />
                  {txState.sig.slice(0, 8)}…{txState.sig.slice(-4)}
                  <ExternalLink size={9} />
                </a>
              )}
              <button
                onClick={onClose}
                style={{
                  display: "block", width: "100%", padding: "12px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)",
                  borderRadius: 10, color: "#22c55e", fontWeight: 700, fontSize: "0.875rem",
                  cursor: "pointer", transition: "background 0.15s",
                }}
              >
                Done — View Portfolio
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {isError && (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1rem",
              }}>
                <AlertCircle size={22} style={{ color: "#ef4444" }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#ef4444", marginBottom: 8 }}>Transaction failed</p>
              <p style={{ fontSize: "0.75rem", color: "#555", marginBottom: "1.25rem", wordBreak: "break-word", lineHeight: 1.6 }}>
                {txState.message}
              </p>
              <button
                onClick={resetTx}
                style={{
                  display: "block", width: "100%", padding: "12px",
                  background: "transparent", border: "1px solid #1e1e1e",
                  borderRadius: 10, color: "#555", fontWeight: 600, fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!isActive && (
          <div style={{
            padding: "0.625rem 1.375rem",
            borderTop: "1px solid #111",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "#2a2a2a" }}>
              Non-custodial · Solana devnet · USDC
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
