"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AlertCircle, CheckCircle, ExternalLink, Loader2, X, Zap } from "lucide-react";

import { useArcadiaVault, type VaultTxPhase } from "@/lib/use-arcadia-vault";
import type { TraderProfile } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import { TierChip, TraderAvatar } from "@/components/pages/investor/tier";
import { cn } from "@/lib/utils";

const PRESETS = [100, 500, 1_000, 5_000, 10_000];

const STEP_ORDER: VaultTxPhase[] = ["checking", "init-investor", "signing", "confirming", "success"];

interface DepositModalProps {
  trader: TraderProfile;
  onClose: () => void;
}

export function DepositModal({ trader, onClose }: DepositModalProps) {
  const { publicKey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { deposit, txState, resetTx } = useArcadiaVault();
  const [amount, setAmount] = useState("");

  // Escape-to-close (additive a11y; deposit logic unchanged).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const handleDeposit = () => {
    if (!isConnected || !isValid) return;
    void deposit(trader.wallet, parsedAmount);
  };

  // Primary CTA: connect the wallet when disconnected (opens the wallet-adapter
  // modal, which layers above this dialog), otherwise submit the deposit.
  const handlePrimary = () => {
    if (!isConnected) {
      setWalletModalVisible(true);
      return;
    }
    handleDeposit();
  };

  const STEPS: { key: VaultTxPhase; label: string }[] = [
    { key: "init-investor", label: "Init investor account" },
    { key: "signing", label: "Sign transaction" },
    { key: "confirming", label: "Confirming on Solana" },
    { key: "success", label: "Deposit confirmed" },
  ];
  const relevantSteps =
    phase === "init-investor" || currentStepIdx >= STEP_ORDER.indexOf("init-investor")
      ? STEPS
      : STEPS.filter((s) => s.key !== "init-investor");

  const stats: { label: string; value: string; className: string }[] = [
    { label: "Score", value: trader.score.toString(), className: "text-ink" },
    { label: "30d Return", value: `+${trader.metrics.return_30d.toFixed(1)}%`, className: "text-success" },
    { label: "Cap. Left", value: formatUSD(capacityLeft, 0), className: "text-ink" },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-void/90 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Fund @${trader.handle} vault`}
        className="acid-sheen w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_120px_rgba(0,0,0,0.9)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-panel-2 px-5 py-4">
          <div className="flex items-center gap-3">
            <TraderAvatar handle={trader.handle} tier={trader.tier} size={38} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-ink">@{trader.handle}</span>
                <TierChip tier={trader.tier} />
              </div>
              <p className="mt-0.5 font-mono text-[0.5rem] tracking-[0.2em] text-faint uppercase">
                Fund Vault · Solana Devnet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-faint transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 border-b border-line">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("px-3 py-3 text-center", i < 2 && "border-r border-line")}>
              <p className="mb-1 font-mono text-[0.5rem] tracking-[0.2em] text-faint uppercase">{s.label}</p>
              <p className={cn("font-mono text-sm font-extrabold tracking-tight tabular-nums", s.className)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Form (idle) */}
          {!isActive && (
            <>
              <p className="mb-2 font-mono text-[0.5625rem] tracking-[0.2em] text-faint uppercase">USDC Amount</p>
              <div className="relative mb-3.5">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-2xl font-bold text-faint"
                >
                  $
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  autoFocus
                  aria-label="Deposit amount in USDC"
                  className="w-full rounded-lg border border-line bg-void py-3 pr-3.5 pl-7 font-mono text-[1.625rem] font-extrabold tracking-tight text-ink outline-none transition-colors focus-visible:border-acid/60 focus-visible:ring-2 focus-visible:ring-acid/30"
                />
              </div>

              <div className="mb-5 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const selected = parsedAmount === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(p))}
                      className={cn(
                        "rounded-md border px-3 py-1.5 font-mono text-[0.625rem] font-bold transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
                        selected
                          ? "border-acid/40 bg-acid/12 text-acid"
                          : "border-line bg-white/[0.03] text-muted hover:border-acid/25 hover:text-ink",
                      )}
                    >
                      ${p >= 1000 ? `${p / 1000}k` : p}
                    </button>
                  );
                })}
              </div>

              {!isConnected && (
                <div className="mb-3.5 rounded-lg border border-tier-advanced/20 bg-tier-advanced/[0.06] px-3 py-2 text-center font-mono text-xs text-tier-advanced">
                  Connect wallet to deposit
                </div>
              )}

              <button
                type="button"
                onClick={handlePrimary}
                disabled={isConnected && !isValid}
                className={cn(
                  "w-full rounded-lg py-3 text-[0.9375rem] font-extrabold tracking-tight transition-all focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.98] motion-reduce:transform-none",
                  !isConnected || isValid
                    ? "bg-acid text-void shadow-[0_0_28px_rgba(204,255,0,0.28)] hover:bg-acid/90"
                    : "cursor-not-allowed bg-panel-2 text-faint",
                )}
              >
                {!isConnected
                  ? "Connect Wallet"
                  : !isValid
                    ? "Enter Amount"
                    : `Deposit ${parsedAmount > 0 ? formatUSD(parsedAmount, 0) : ""} USDC`}
              </button>
            </>
          )}

          {/* In-progress steps */}
          {inProgress && (
            <div className="flex flex-col gap-2.5 py-1">
              {relevantSteps.map((s, idx) => {
                const sIdx = STEP_ORDER.indexOf(s.key);
                const done = sIdx < currentStepIdx;
                const current = s.key === phase;
                const pending = !done && !current;
                return (
                  <div key={s.key} className={cn("flex items-center gap-3 transition-opacity", pending && "opacity-30")}>
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        done
                          ? "border-success/35 bg-success/12"
                          : current
                            ? "border-acid/40 bg-acid/12"
                            : "border-line bg-white/[0.03]",
                      )}
                    >
                      {done ? (
                        <CheckCircle className="size-3.5 text-success" />
                      ) : current ? (
                        <Loader2 className="size-3.5 text-acid motion-safe:animate-spin" />
                      ) : (
                        <span className="font-mono text-[0.5rem] font-bold text-faint">{idx + 1}</span>
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm",
                          done ? "font-semibold text-success" : current ? "font-semibold text-ink" : "text-faint",
                        )}
                      >
                        {s.label}
                      </p>
                      {current && <p className="mt-0.5 font-mono text-[0.5625rem] text-muted">{txState.message}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Success */}
          {isDone && (
            <div className="py-1 text-center">
              <div className="mx-auto mb-4 flex size-[52px] items-center justify-center rounded-full border border-success/30 bg-success/10">
                <CheckCircle className="size-6 text-success" />
              </div>
              <p className="mb-1.5 text-base font-extrabold text-ink">
                {formatUSD(parsedAmount, 0)} USDC {txState.simulated ? "deposit simulated" : "deposited"}
              </p>
              <p className="mx-auto mb-5 max-w-[320px] text-[0.8125rem] leading-relaxed text-muted">
                {txState.simulated
                  ? "Simulated flow — the vault program is not live on devnet, so no on-chain transaction was sent."
                  : `Your position in @${trader.handle}'s vault is live`}
              </p>
              {txState.sig && (
                <a
                  href={`https://solscan.io/tx/${txState.sig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-acid/25 bg-acid/[0.07] px-3.5 py-1.5 font-mono text-[0.625rem] text-acid hover:bg-acid/12"
                >
                  <Zap className="size-2.5" />
                  {txState.sig.slice(0, 8)}…{txState.sig.slice(-4)}
                  <ExternalLink className="size-2.5" />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="block w-full rounded-lg border border-success/25 bg-success/[0.08] py-3 text-sm font-bold text-success transition-colors hover:bg-success/15 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.98] motion-reduce:transform-none"
              >
                Done — View Portfolio
              </button>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="py-1 text-center">
              <div className="mx-auto mb-4 flex size-[52px] items-center justify-center rounded-full border border-danger/25 bg-danger/[0.08]">
                <AlertCircle className="size-6 text-danger" />
              </div>
              <p className="mb-2 text-sm font-bold text-danger">Transaction failed</p>
              <p className="mx-auto mb-5 max-w-[320px] text-xs leading-relaxed break-words text-muted">
                {txState.message}
              </p>
              <button
                type="button"
                onClick={resetTx}
                className="block w-full rounded-lg border border-line bg-transparent py-3 text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.98] motion-reduce:transform-none"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isActive && (
          <div className="flex items-center justify-center gap-1.5 border-t border-line px-5 py-2.5">
            <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-success" />
            <span className="font-mono text-[0.5rem] tracking-[0.18em] text-faint uppercase">
              Non-custodial · Solana devnet · USDC
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
