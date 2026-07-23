"use client";

import { useState } from "react";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Clock, DollarSign, Server, Wallet } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EnvChip,
  MicroLabel,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/pages/trader/trader-ui";
import { apiFetch, cn } from "@/lib/utils";
import { useMe } from "@/lib/hooks";
import { formatUSD, type TraderProfile, type VaultInfo } from "@/lib/types";
import { useArcadiaVault } from "@/lib/use-arcadia-vault";

const TIER_SPLIT: Record<string, number> = {
  Elite: 35,
  Advanced: 30,
  Established: 25,
  Verified: 20,
};

type SparkTone = "cyan" | "success" | "amber";
const SPARK_FILL: Record<SparkTone, string> = {
  cyan: "var(--color-cyan)",
  success: "var(--color-success)",
  amber: "var(--color-tier-advanced)",
};

function SparkBars({ data, tone }: { data: number[]; tone: SparkTone }) {
  const W = 80;
  const H = 36;
  const max = Math.max(...data);
  const barW = 5;
  const gap = (W - barW * data.length) / (data.length - 1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * (H - 4));
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - barH}
            width={barW}
            height={barH}
            rx={1.5}
            fill={SPARK_FILL[tone]}
            opacity={0.35 + (i / data.length) * 0.65}
          />
        );
      })}
    </svg>
  );
}

interface PayoutRecord {
  signature: string;
  amount_usd: string;
  shares: string;
  ts: string;
}

export default function PayoutsPage() {
  const { connected } = useWalletCompat();
  const { data: me } = useMe();
  const handle = me?.handle;

  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [payoutResult, setPayoutResult] = useState<string | null>(null);

  const { withdrawProfit, txState, resetTx } = useArcadiaVault();

  const { data: trader } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  const { data: vault } = useQuery<VaultInfo>({
    queryKey: ["vault", trader?.profile],
    queryFn: () => apiFetch(`/vaults/${trader!.profile}`),
    enabled: !!trader?.profile,
  });

  const { data: payouts } = useQuery<PayoutRecord[]>({
    queryKey: ["payouts", handle],
    queryFn: () => apiFetch(`/traders/${handle}/payouts`),
    enabled: !!handle,
  });

  const traderSplit = TIER_SPLIT[trader?.tier ?? "Verified"] ?? 20;
  const platformSplit = 5;
  const maxWithdrawable = vault?.trader_claimable ?? 0;
  const subAccountProfit = trader?.aum ?? 0;

  const grossAmount = parseFloat(amount || "0");
  const traderPayout = grossAmount * (traderSplit / 100);
  const platformFee = grossAmount * (platformSplit / 100);

  const handleConfirm = async () => {
    if (!amount || grossAmount <= 0) return;
    setSubmitting(true);
    setPayoutResult(null);
    resetTx();
    const ok = await withdrawProfit(grossAmount);
    setSubmitting(false);
    if (ok) {
      setPayoutResult(`$${grossAmount.toFixed(2)} profit withdrawal request submitted.`);
      setAmount("");
      setPct(0);
    }
  };

  if (!connected) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <Panel className="max-w-sm p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={22} className="text-acid" />
          </div>
          <p className="mb-2 text-lg font-bold text-ink">Connect your wallet</p>
          <p className="text-sm text-faint">
            Connect to view payouts, on-chain payout reserve, and request profit settlements.
          </p>
        </Panel>
      </div>
    );
  }

  const tierLabel = trader?.tier ?? "Verified";
  const scoreLabel = trader?.score ?? 0;
  const pending = submitting || txState.phase === "signing" || txState.phase === "checking";

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8">
        <PageHeader title="Payouts">
          <EnvChip live>Solana devnet</EnvChip>
        </PageHeader>
        <p className="-mt-3 mb-6 text-[0.8rem] text-faint">
          Get payouts on funded accounts anytime, instantly to your wallet.
        </p>

        {/* Big stats row */}
        <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Panel className="group acid-int p-4">
            <MicroLabel className="mb-2">Sub-Account Profit</MicroLabel>
            <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-success">
              +{formatUSD(subAccountProfit)}
            </p>
            <p className="mt-1 text-[0.7rem] text-faint">All-time sub-account gains</p>
          </Panel>
          <StatTile
            label="Withdrawable Profits"
            value={formatUSD(maxWithdrawable)}
            sub="Ready for instant payout · Above HWM"
          />
          <Panel className="group acid-int p-5">
            <MicroLabel className="mb-3.5">Payout Status</MicroLabel>
            <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-ink">
              {vault?.status ?? "—"}
            </p>
            <p className="mt-1 text-[0.7rem] text-faint">
              Vault status · {payouts?.length ?? 0} total payouts
            </p>
          </Panel>
        </div>

        {/* Tier row */}
        <Panel className="group acid-int mb-5 flex flex-wrap items-center gap-6 px-5 py-3.5">
          {[
            { label: "Your tier", value: `${tierLabel} · Score ${scoreLabel}`, tone: "text-ink" },
            { label: "Trader split", value: `${traderSplit}% of profit above HWM`, tone: "text-acid" },
            { label: "Platform fee", value: `${platformSplit}%`, tone: "text-muted" },
            {
              label: "Investor gets",
              value: `${100 - traderSplit - platformSplit}%`,
              tone: "text-ink",
            },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-6">
              {i > 0 && <div className="h-7 w-px shrink-0 bg-white/10" />}
              <div>
                <MicroLabel className="mb-0.5 text-[0.5rem]">{item.label}</MicroLabel>
                <p className={cn("font-mono text-sm font-extrabold tracking-tight", item.tone)}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </Panel>

        {/* Request + Recent */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Request payout */}
          <div>
            <p className="mb-3 text-xs font-bold text-ink">Request Payout</p>
            <Panel className="p-5">
              <p className="mb-3.5 text-[0.7rem] text-faint">
                Profit above HWM:{" "}
                <span className="font-mono font-extrabold text-success">
                  {formatUSD(maxWithdrawable)}
                </span>
              </p>

              <label htmlFor="payout-amount" className="mb-1.5 block">
                <MicroLabel>Enter USDC Amount</MicroLabel>
              </label>
              <div className="mb-3 flex items-center gap-2">
                <Input
                  id="payout-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPct(
                      Math.round((parseFloat(e.target.value || "0") / Math.max(maxWithdrawable, 1)) * 100),
                    );
                  }}
                  placeholder="0.00"
                  className="flex-1 tabular-nums"
                />
                <span className="shrink-0 font-mono text-xs font-bold text-muted">USDC</span>
              </div>

              <div className="mb-4 flex gap-1.5">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const v = (Math.max(maxWithdrawable, 1) * p) / 100;
                      setAmount(v.toString());
                      setPct(p);
                    }}
                    className={cn(
                      "flex-1 rounded-md border py-1.5 font-mono text-[0.6rem] font-bold transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
                      pct === p
                        ? "border-acid/40 bg-acid/15 text-acid"
                        : "border-white/10 bg-panel-2 text-faint hover:text-muted",
                    )}
                  >
                    {p === 100 ? "Max" : `${p}%`}
                  </button>
                ))}
              </div>

              {grossAmount > 0 && (
                <div className="mb-4 rounded-lg border border-white/10 bg-panel-2 p-4">
                  <MicroLabel className="mb-3">Payout details</MicroLabel>
                  {[
                    {
                      label: `${tierLabel} profit split`,
                      value: `${traderSplit}%`,
                      valueStr: formatUSD(traderPayout),
                      positive: true,
                    },
                    {
                      label: "Payout post profit split",
                      value: null,
                      valueStr: formatUSD(grossAmount - traderPayout),
                      positive: false,
                    },
                  ].map((r) => (
                    <div key={r.label} className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-muted">
                        {r.label}:
                        {r.value && (
                          <span className="ml-1 font-mono text-faint">{r.value}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          r.positive ? "text-acid" : "text-ink",
                        )}
                      >
                        {r.positive ? "+" : ""}
                        {r.valueStr}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        Platform fee ({platformSplit}%)
                      </span>
                      <span className="font-mono text-xs font-bold text-danger">
                        -{formatUSD(platformFee)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {payoutResult ? (
                <div className="rounded-lg border border-success/25 bg-success/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle size={14} className="text-success" />
                    <span className="text-xs font-bold text-success">
                      {txState.simulated ? "Payout simulated · devnet" : "Payout submitted"}
                    </span>
                  </div>
                  <p className="mb-2 font-mono text-[0.6rem] text-faint">{payoutResult}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutResult(null);
                      resetTx();
                    }}
                    className="w-full rounded-md border border-white/10 bg-panel-2 py-1.5 text-xs font-semibold text-faint transition-colors hover:text-muted"
                  >
                    Request another
                  </button>
                </div>
              ) : (
                <Button
                  onClick={handleConfirm}
                  disabled={pending || !amount || grossAmount <= 0}
                  size="lg"
                  className="w-full"
                >
                  {pending ? "Processing…" : "Confirm Payout"}
                </Button>
              )}

              {txState.phase === "error" && (
                <div className="mt-3 rounded-lg border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                  {txState.message}
                </div>
              )}
            </Panel>
          </div>

          {/* Recent payouts */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-ink">Recent Payouts</p>
              <MicroLabel className="text-[0.5rem]">This Account</MicroLabel>
            </div>
            <Panel className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Date", "Account", "Status", "Ref", "Amount"].map((h) => (
                      <TableHead key={h} className={h === "Amount" ? "text-right" : ""}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!payouts || payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-faint">
                        No payouts yet
                      </TableCell>
                    </TableRow>
                  ) : payouts.map((r) => {
                    const ts = r.ts ? new Date(r.ts).toLocaleDateString() : "—";
                    return (
                      <TableRow key={r.signature} className="group">
                        <TableCell className="text-[0.7rem] text-faint">{ts}</TableCell>
                        <TableCell className="text-[0.7rem] font-bold text-muted">Trader</TableCell>
                        <TableCell>
                          <span className="rounded border border-success/25 bg-success/10 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold tracking-wider text-success">
                            ✓ Paid
                          </span>
                        </TableCell>
                        <TableCell className="text-[0.6rem] text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                          {r.signature.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-right font-bold text-success">
                          +{formatUSD(parseFloat(r.amount_usd), 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
