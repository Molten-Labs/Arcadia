"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, ExternalLink, Loader2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataRow,
  EnvChip,
  MicroLabel,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/pages/trader/trader-ui";
import { apiFetch } from "@/lib/utils";
import { useMe } from "@/lib/hooks";
import { formatUSD, type TraderProfile, type VaultInfo } from "@/lib/types";
import { useArcadiaVault } from "@/lib/use-arcadia-vault";

const PENDING_PHASES = ["checking", "init-investor", "signing", "confirming"];

export default function ManagePage() {
  const { connected, publicKey } = useWallet();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const handle = me?.handle;
  const profile = me?.profile;

  const [selfFundAmount, setSelfFundAmount] = useState("");
  const [togglePending, setTogglePending] = useState(false);

  const { deposit, txState, resetTx } = useArcadiaVault();

  const { data: trader } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  const { data: vault } = useQuery<VaultInfo>({
    queryKey: ["vault", profile],
    queryFn: () => apiFetch(`/vaults/${profile}`),
    enabled: !!profile,
  });

  const score = trader?.score ?? 0;
  const capacity = score * 1000;
  const aum = trader?.aum ?? 0;
  const selfFunded = trader?.trader_self_funded ?? 0;
  const depositsOpen = vault?.deposits_open ?? true;
  const capacityLeft = capacity - aum;
  const navPerShare = vault ? `$${(vault.nav_per_share / 1_000_000).toFixed(6)}` : "—";

  const isPending = PENDING_PHASES.includes(txState.phase);
  const isSuccess = txState.phase === "success";
  const isError = txState.phase === "error";

  const handleSelfFund = async () => {
    const amount = parseFloat(selfFundAmount);
    if (!amount || amount <= 0) return;
    resetTx();
    const ok = await deposit(publicKey?.toBase58() ?? "", amount);
    if (ok) setSelfFundAmount("");
  };

  const handleToggleDeposits = async () => {
    if (!profile) return;
    setTogglePending(true);
    try {
      await apiFetch(`/vaults/${profile}/deposits`, {
        method: "PATCH",
        body: JSON.stringify({ open: !depositsOpen }),
        headers: { "Content-Type": "application/json" },
      } as RequestInit);
      queryClient.invalidateQueries({ queryKey: ["vault", profile] });
    } catch (e) {
      console.error("Failed to toggle deposits:", e);
    } finally {
      setTogglePending(false);
    }
  };

  if (!connected) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <Panel className="max-w-sm p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={24} className="text-acid" />
          </div>
          <p className="mb-2 text-base font-semibold text-ink">Connect wallet</p>
          <p className="text-sm text-faint">Connect your wallet to manage your vault.</p>
        </Panel>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="min-h-full bg-void">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <PageHeader title="Manage Vault">
            <EnvChip live>Solana devnet</EnvChip>
          </PageHeader>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Panel key={i} className="p-5">
                <Skeleton className="mb-3 h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </Panel>
            ))}
          </div>
          <Panel className="mt-6 p-10 text-center text-sm text-faint">
            No vault data available yet.
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Manage Vault">
          <EnvChip live>Solana devnet</EnvChip>
        </PageHeader>

        {/* Capacity formula callout */}
        <Panel className="group acid-int mb-6 flex flex-wrap items-center gap-4 border-acid/20 p-4">
          <div className="font-mono text-2xl font-bold tabular-nums text-acid">{score}</div>
          <div className="text-lg font-bold text-faint">×</div>
          <div>
            <MicroLabel>Score × $1,000</MicroLabel>
            <p className="text-sm font-bold text-ink">
              {formatUSD(capacity, 0)} vault capacity
            </p>
          </div>
          <div className="ml-auto text-right">
            <MicroLabel>Utilized</MicroLabel>
            <p className="font-mono text-base font-bold tabular-nums text-acid">
              {capacity > 0 ? Math.round((aum / capacity) * 100) : 0}%
            </p>
          </div>
        </Panel>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="AUM" value={formatUSD(aum, 0)} />
          <StatTile label="Capacity" value={formatUSD(capacity, 0)} />
          <StatTile label="Capacity Left" value={formatUSD(capacityLeft, 0)} />
          <StatTile label="Self-funded" value={formatUSD(selfFunded, 0)} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Self-fund */}
          <Panel className="p-5">
            <MicroLabel className="mb-2">Self-fund Vault</MicroLabel>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              Deposit your own USDC as a trader-own position. Signals skin-in-the-game to
              investors. Withdraws via the normal path.
            </p>

            <label
              htmlFor="self-fund-amount"
              className="mb-1 block text-xs text-faint"
            >
              Amount (USDC)
            </label>
            <Input
              id="self-fund-amount"
              type="number"
              value={selfFundAmount}
              onChange={(e) => setSelfFundAmount(e.target.value)}
              placeholder="0.00"
              disabled={isPending}
              className="mb-3 tabular-nums"
            />

            {capacityLeft <= 0 ? (
              <div className="w-full rounded-lg border border-white/10 bg-panel-2 py-2 text-center text-sm font-semibold text-faint">
                Vault at capacity
              </div>
            ) : (
              <Button
                onClick={handleSelfFund}
                disabled={isPending || !selfFundAmount}
                size="lg"
                className="w-full"
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {isPending ? "Signing transaction…" : "Deposit (own)"}
              </Button>
            )}

            {isPending && (
              <div className="mt-3 flex items-center gap-2 text-xs text-faint">
                <Clock size={12} />
                {txState.message}
              </div>
            )}

            {isSuccess && (
              <div className="mt-3 rounded-lg border border-success/25 bg-success/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle size={13} className="text-success" />
                  <span className="text-xs font-bold text-success">
                    {txState.simulated
                      ? "Self-fund simulated (vault not live on devnet)"
                      : "Self-fund confirmed"}
                  </span>
                </div>
                {txState.sig && (
                  <a
                    href={`https://solscan.io/tx/${txState.sig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-[0.65rem] text-cyan transition-opacity hover:opacity-70"
                  >
                    <span>
                      {txState.sig.slice(0, 8)}…{txState.sig.slice(-6)}
                    </span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}

            {isError && (
              <div className="mt-3 rounded-lg border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                {txState.message}
              </div>
            )}
          </Panel>

          {/* Vault status */}
          <Panel className="group acid-int p-5">
            <MicroLabel className="mb-4">Vault Controls</MicroLabel>
            <div className="mb-6 space-y-0 text-xs">
              <DataRow label="Status">{vault?.status === "active" ? "Active" : vault?.status ?? "—"}</DataRow>
              <DataRow label="Score">{score}</DataRow>
              <DataRow label="Capacity formula">
                {score} × $1,000 = {formatUSD(capacity, 0)}
              </DataRow>
              <DataRow label="Deposits open">{depositsOpen ? "Yes" : "No"}</DataRow>
              <DataRow label="Capacity left">{formatUSD(capacityLeft, 0)}</DataRow>
              <DataRow label="NAV / Share">{navPerShare}</DataRow>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink">Accept Deposits</p>
                <p className="text-[0.65rem] text-faint">
                  Open / close your vault to investors
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={depositsOpen}
                aria-label="Accept deposits"
                onClick={handleToggleDeposits}
                disabled={togglePending}
                className={`relative h-6 w-12 shrink-0 rounded-full border border-white/10 transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
                  depositsOpen ? "bg-acid" : "bg-panel-2"
                }`}
              >
                <span
                  className={`absolute top-[2px] size-5 rounded-full transition-all duration-300 ${
                    depositsOpen ? "bg-void" : "bg-white"
                  }`}
                  style={{ left: depositsOpen ? "calc(100% - 22px)" : "2px" }}
                />
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
