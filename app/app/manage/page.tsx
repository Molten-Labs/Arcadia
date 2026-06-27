"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { StatCard } from "@/components/StatCard";
import { formatUSD } from "@/lib/types";

export default function ManagePage() {
  const { connected } = useWallet();
  const [selfFundAmount, setSelfFundAmount] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const vault = {
    aum: 387000,
    capacity_usd: 500000,
    trader_shares: 24000,
    trader_self_funded: 25000,
    deposits_open: true,
    total_shares: 342000,
    nav_per_share: 1.18,
  };

  const handleSelfFund = () => {
    setTxStatus("Calling deposit() as trader-own position… (devnet simulation)");
    setTimeout(() => setTxStatus("Self-fund recorded. Trader shares updated."), 2000);
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
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
          Manage Vault
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="AUM" value={formatUSD(vault.aum, 0)} />
          <StatCard label="Capacity" value={formatUSD(vault.capacity_usd, 0)} />
          <StatCard label="Self-funded" value={formatUSD(vault.trader_self_funded, 0)} />
          <StatCard label="Your Shares" value={vault.trader_shares.toLocaleString()} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Self-fund Vault
            </p>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Deposit your own USDC as a trader-own position. This increases AUM and signals skin-in-the-game. Your self-funded position withdraws via the normal withdraw path.
            </p>
            <div className="mb-3">
              <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>Amount (USDC)</label>
              <input
                type="number"
                value={selfFundAmount}
                onChange={(e) => setSelfFundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none tnum"
                style={{
                  background: "var(--color-panel-2)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-ink)",
                }}
              />
            </div>
            <button
              onClick={handleSelfFund}
              className="w-full py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--color-purple)", color: "white" }}
            >
              Deposit (own)
            </button>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Vault Status
            </p>
            <div className="space-y-3 text-xs">
              {[
                ["Status", "Active"],
                ["Deposits open", vault.deposits_open ? "Yes" : "No"],
                ["Capacity left", formatUSD(vault.capacity_usd - vault.aum, 0)],
                ["NAV / Share", vault.nav_per_share.toFixed(6)],
                ["Total Shares", vault.total_shares.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <span style={{ color: "var(--color-faint)" }}>{k}</span>
                  <span className="tnum font-medium" style={{ color: "var(--color-ink)" }}>{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--color-faint)" }}>
              Capacity is set by the platform admin via set_capacity. Max leverage is fixed at initialize_profile time.
            </p>
          </div>
        </div>

        {txStatus && (
          <div
            className="mt-4 rounded-lg p-3 text-xs"
            style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
          >
            {txStatus}
          </div>
        )}
      </div>
    </div>
  );
}
