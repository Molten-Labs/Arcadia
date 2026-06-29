"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { StatCard } from "@/components/StatCard";
import { formatUSD } from "@/lib/types";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { ExternalLink, CheckCircle, Clock } from "lucide-react";

const DEMO_TRADER = MOCK_TRADERS[0];

function fakeTxHash(): string {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 88 }, () => B58[Math.floor(Math.random() * 58)]).join("");
}

export default function ManagePage() {
  const { connected } = useWallet();
  const [selfFundAmount, setSelfFundAmount] = useState("");
  const [txStatus, setTxStatus] = useState<null | { phase: "pending" | "done"; hash?: string }>(null);
  const [depositsOpen, setDepositsOpen] = useState(DEMO_TRADER.deposits_open);

  const score = DEMO_TRADER.score;
  const capacity = score * 1000;
  const aum = DEMO_TRADER.aum;
  const selfFunded = DEMO_TRADER.trader_self_funded;
  const capacityLeft = capacity - aum;

  const handleSelfFund = () => {
    const amount = parseFloat(selfFundAmount);
    if (!amount || amount <= 0) return;
    setTxStatus({ phase: "pending" });
    setTimeout(() => {
      const hash = fakeTxHash();
      setTxStatus({ phase: "done", hash });
      setSelfFundAmount("");
    }, 1800);
  };

  if (!connected) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Connect wallet to manage your vault
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Manage Vault</h1>
          <div
            className="text-[10px] px-3 py-1.5 rounded-lg font-mono"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            devnet simulation
          </div>
        </div>

        {/* Capacity formula callout */}
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-4"
          style={{ background: "var(--color-panel)", border: "1px solid rgba(79,158,255,0.2)" }}
        >
          <div className="text-2xl font-black tnum" style={{ color: "var(--color-accent)" }}>{score}</div>
          <div className="text-lg font-bold" style={{ color: "var(--color-faint)" }}>×</div>
          <div>
            <p className="text-xs font-bold" style={{ color: "var(--color-faint)" }}>Score × $1,000</p>
            <p className="text-sm font-black" style={{ color: "var(--color-ink)" }}>{formatUSD(capacity, 0)} vault capacity</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px]" style={{ color: "var(--color-faint)" }}>Utilized</p>
            <p className="text-base font-black tnum" style={{ color: "var(--color-mint)" }}>
              {Math.round((aum / capacity) * 100)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="AUM" value={formatUSD(aum, 0)} />
          <StatCard label="Capacity" value={formatUSD(capacity, 0)} />
          <StatCard label="Capacity Left" value={formatUSD(capacityLeft, 0)} />
          <StatCard label="Self-funded" value={formatUSD(selfFunded, 0)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Self-fund */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-faint)" }}>
              Self-fund Vault
            </p>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Deposit your own USDC as a trader-own position. Signals skin-in-the-game to investors. Withdraws via the normal path.
            </p>
            <div className="mb-3">
              <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>Amount (USDC)</label>
              <input
                type="number"
                value={selfFundAmount}
                onChange={(e) => setSelfFundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none tnum"
                style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
              />
            </div>

            {capacityLeft <= 0 ? (
              <div className="w-full py-2 rounded-lg text-sm text-center font-semibold" style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}>
                Vault at capacity
              </div>
            ) : (
              <button
                onClick={handleSelfFund}
                disabled={txStatus?.phase === "pending" || !selfFundAmount}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: "var(--color-mint)", color: "#ffffff" }}
              >
                {txStatus?.phase === "pending" ? "Signing transaction…" : "Deposit (own)"}
              </button>
            )}

            {txStatus?.phase === "pending" && (
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--color-faint)" }}>
                <Clock size={12} className="animate-spin" />
                Awaiting devnet confirmation…
              </div>
            )}

            {txStatus?.phase === "done" && txStatus.hash && (
              <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={13} style={{ color: "var(--color-green)" }} />
                  <span className="text-xs font-bold" style={{ color: "var(--color-green)" }}>Self-fund confirmed (devnet)</span>
                </div>
                <a
                  href={`https://solscan.io/tx/${txStatus.hash}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-[10px] transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-mint)" }}
                >
                  <span>{txStatus.hash.slice(0, 8)}…{txStatus.hash.slice(-6)}</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Vault status */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Vault Controls
            </p>
            <div className="space-y-3 text-xs mb-6">
              {[
                ["Status", "Active"],
                ["Score", DEMO_TRADER.score.toString()],
                ["Capacity formula", `${score} × $1,000 = ${formatUSD(capacity, 0)}`],
                ["Deposits open", depositsOpen ? "Yes" : "No"],
                ["Capacity left", formatUSD(capacityLeft, 0)],
                ["NAV / Share", "1.000000"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <span style={{ color: "var(--color-faint)" }}>{k}</span>
                  <span className="tnum font-medium" style={{ color: "var(--color-ink)" }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Accept Deposits</p>
                <p className="text-[10px]" style={{ color: "var(--color-faint)" }}>Open / close your vault to investors</p>
              </div>
              <button
                onClick={() => setDepositsOpen((v) => !v)}
                className="relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0"
                style={{ background: depositsOpen ? "var(--color-mint)" : "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
              >
                <span
                  className="absolute top-[2px] w-5 h-5 rounded-full bg-white transition-all duration-300"
                  style={{ left: depositsOpen ? "calc(100% - 22px)" : "2px" }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
