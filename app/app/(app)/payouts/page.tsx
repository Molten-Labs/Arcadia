"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight, CheckCircle, Clock, DollarSign, Server, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { MOCK_TRADERS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/types";

const DEMO = MOCK_TRADERS[0];
const TIER_SPLIT: Record<string, number> = {
  Elite: 35,
  Advanced: 30,
  Established: 25,
  Verified: 20,
};

const RESERVE_DATA = [120, 140, 200, 180, 220, 260, 280, 320, 290, 340, 360];
const PAYOUT_DATA = [80, 120, 160, 140, 200, 180, 220, 260, 240];
const TIME_DATA = [1.2, 1.5, 1.8, 2.1, 1.6, 1.9, 1.4, 1.7];

const RECENT_PAYOUTS = [
  { date: "1 Jun 26", status: "Pending", hash: "5Nn7x3KqBz…R4mP", amount: 5200 },
  { date: "12 May 26", status: "Paid", hash: "4PqRtLv9Xw…M3kN", amount: 6810 },
  { date: "28 Apr 26", status: "Paid", hash: "3WmKpTs8Yq…V7jL", amount: 1867 },
  { date: "15 Mar 26", status: "Paid", hash: "2VnLrTu6Xp…K2hM", amount: 1899 },
  { date: "3 Feb 26", status: "Paid", hash: "7JtMvPq4Wr…N8fK", amount: 1899 },
];

const ON_CHAIN_STEPS = [
  { label: "Update Account", status: "done" },
  { label: "Update Equity", status: "done" },
  { label: "Pass Evaluation", status: "done" },
  { label: "Sign Agreement", status: "done" },
  { label: "Process Withdrawal", status: "pending" },
];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeRef() {
  return Array.from({ length: 88 }, () => B58[Math.floor(Math.random() * 58)]).join("");
}

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

export default function PayoutsPage() {
  const { connected } = useWallet();
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [payoutRef, setPayoutRef] = useState<string | null>(null);

  const traderSplit = TIER_SPLIT[DEMO.tier] ?? 20;
  const platformSplit = 5;
  const MAX_WITHDRAWABLE = 10000;
  const SUB_ACCOUNT_PROFIT = 14414.13;

  const grossAmount = parseFloat(amount || "0");
  const traderPayout = grossAmount * (traderSplit / 100);
  const platformFee = grossAmount * (platformSplit / 100);

  const handleConfirm = () => {
    if (!amount) return;
    setSubmitting(true);
    setPayoutRef(null);
    setTimeout(() => {
      setSubmitting(false);
      setPayoutRef(fakeRef());
    }, 1800);
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

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8">
        <PageHeader title="Payouts">
          <EnvChip live>Solana devnet</EnvChip>
        </PageHeader>
        <p className="-mt-3 mb-6 text-[0.8rem] text-faint">
          Get payouts on funded accounts anytime, instantly to your wallet.
        </p>

        {/* Top stat cards */}
        <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Panel className="group acid-int p-[1.125rem]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Server size={13} className="text-cyan" />
                <span className="text-xs font-semibold text-ink">Payout Reserve</span>
              </div>
              <span className="flex items-center gap-1 font-mono text-[0.6rem] text-success">
                On-chain
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-ink">
                  $742,414
                </p>
                <p className="mt-1 font-mono text-[0.55rem] text-faint">
                  On-chain and verifiable payout reserve
                </p>
              </div>
              <SparkBars data={RESERVE_DATA} tone="cyan" />
            </div>
          </Panel>

          <Panel className="group acid-int p-[1.125rem]">
            <div className="mb-3 flex items-center gap-1.5">
              <DollarSign size={13} className="text-success" />
              <span className="text-xs font-semibold text-ink">Total Payouts Issued</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-ink">
                  $28,592
                </p>
                <p className="mt-1 font-mono text-[0.55rem] text-faint">All time</p>
              </div>
              <SparkBars data={PAYOUT_DATA} tone="success" />
            </div>
          </Panel>

          <Panel className="group acid-int p-[1.125rem]">
            <div className="mb-3 flex items-center gap-1.5">
              <Clock size={13} className="text-tier-advanced" />
              <span className="text-xs font-semibold text-ink">Avg. Payout Time</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-ink">
                  1.8s
                </p>
                <p className="mt-1 font-mono text-[0.55rem] text-faint">
                  All time · Solana native speed
                </p>
              </div>
              <SparkBars data={TIME_DATA} tone="amber" />
            </div>
          </Panel>
        </div>

        {/* Big stats row */}
        <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Panel className="group acid-int p-4">
            <MicroLabel className="mb-2">Sub-Account Profit</MicroLabel>
            <p className="font-mono text-2xl font-black tracking-tight tabular-nums text-success">
              +{formatUSD(SUB_ACCOUNT_PROFIT)}
            </p>
            <p className="mt-1 text-[0.7rem] text-faint">All-time sub-account gains</p>
          </Panel>
          <StatTile
            label="Withdrawable Profits"
            value={formatUSD(MAX_WITHDRAWABLE)}
            sub="Ready for instant payout · Above HWM"
          />
          <Panel className="group acid-int p-5">
            <MicroLabel className="mb-3.5">On-chain State Updates</MicroLabel>
            <div className="flex flex-col gap-1.5">
              {ON_CHAIN_STEPS.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "grid size-[18px] shrink-0 place-items-center rounded-full border",
                      step.status === "done"
                        ? "border-success/30 bg-success/10"
                        : "border-white/10 bg-panel-2",
                    )}
                  >
                    {step.status === "done" ? (
                      <CheckCircle size={10} className="text-success" />
                    ) : (
                      <span className="size-[5px] rounded-full bg-tier-advanced" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[0.6rem]",
                      step.status === "done" ? "text-muted" : "font-bold text-ink",
                    )}
                  >
                    {step.label}
                  </span>
                  {i < ON_CHAIN_STEPS.length - 1 && step.status === "done" && (
                    <ArrowRight size={8} className="shrink-0 text-faint" />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Tier row */}
        <Panel className="group acid-int mb-5 flex flex-wrap items-center gap-6 px-5 py-3.5">
          {[
            { label: "Your tier", value: `${DEMO.tier} · Score ${DEMO.score}`, tone: "text-ink" },
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
                  {formatUSD(MAX_WITHDRAWABLE)}
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
                      Math.round((parseFloat(e.target.value || "0") / MAX_WITHDRAWABLE) * 100),
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
                      const v = (MAX_WITHDRAWABLE * p) / 100;
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
                      label: `${DEMO.tier} profit split`,
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
                    {
                      label: "Equity after payout",
                      value: null,
                      valueStr: formatUSD(22000),
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

              {payoutRef ? (
                <div className="rounded-lg border border-success/25 bg-success/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle size={14} className="text-success" />
                    <span className="text-xs font-bold text-success">
                      Payout simulated · devnet
                    </span>
                  </div>
                  <p className="mb-2 font-mono text-[0.6rem] text-faint">
                    Ref {payoutRef.slice(0, 8)}…{payoutRef.slice(-6)} · simulation only, no real
                    signature
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutRef(null);
                      setAmount("");
                      setPct(0);
                    }}
                    className="w-full rounded-md border border-white/10 bg-panel-2 py-1.5 text-xs font-semibold text-faint transition-colors hover:text-muted"
                  >
                    Request another
                  </button>
                </div>
              ) : (
                <Button
                  onClick={handleConfirm}
                  disabled={submitting || !amount || grossAmount <= 0}
                  size="lg"
                  className="w-full"
                >
                  {submitting ? "Processing…" : "Confirm Payout"}
                </Button>
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
                  {RECENT_PAYOUTS.map((r) => (
                    <TableRow key={r.hash} className="group">
                      <TableCell className="text-[0.7rem] text-faint">{r.date}</TableCell>
                      <TableCell className="text-[0.7rem] font-bold text-muted">E1</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5 font-mono text-[0.55rem] font-bold tracking-wider",
                            r.status === "Pending"
                              ? "border-acid/25 bg-acid/10 text-acid"
                              : "border-success/25 bg-success/10 text-success",
                          )}
                        >
                          {r.status === "Paid" ? "✓ Paid" : r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[0.6rem] text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{r.hash}</TableCell>
                      <TableCell className="text-right font-bold text-success">
                        +{formatUSD(r.amount, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
