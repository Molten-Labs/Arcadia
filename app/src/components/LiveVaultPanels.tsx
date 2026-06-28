import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Circle, ShieldCheck } from "lucide-react";
import { useVaultActivity, useVaultNavHistory, useVaultTrades } from "@/hooks/useVaultLiveData";
import type { VaultView } from "@/hooks/useVaults";
import type { VaultActivityEvent } from "@/lib/realtime";
import { fmtUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LiveVaultPanelsProps {
  vault: VaultView;
  compact?: boolean;
}

export function LiveVaultKpis({ vault, compact = false }: LiveVaultPanelsProps) {
  const { data: navHistory } = useVaultNavHistory(vault.configPubkey);
  const navChange = useMemo(() => {
    const points = navHistory ?? [];
    if (points.length < 2) return 0;
    const first = points[0]?.nav ?? vault.currentNav;
    const last = points[points.length - 1]?.nav ?? vault.currentNav;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [navHistory, vault.currentNav]);

  const originalJunior = Number(vault.originalJuniorDepositLamports) / 1e6 || vault.juniorCapital;
  const juniorUsed = Math.max(0, originalJunior - vault.juniorCapital);
  const juniorUsedPct = originalJunior > 0 ? (juniorUsed / originalJunior) * 100 : 0;
  const investorPrincipal = vault.seniorSharesOutstanding || vault.seniorCapital;
  const investorImpact = Math.max(0, investorPrincipal - vault.seniorCapital);
  const claimableFees = Math.max(0, vault.currentNav - vault.highWaterMark) * (vault.feeBps / 10_000);
  const liquidUsdc = vault.liquidUsdc ?? Math.max(0, vault.seniorCapital * (vault.instantExit ? 0.55 : 0.18));
  const wsolExposure = vault.wsolExposureValue ?? 0;
  const reserveOk = (vault.reserveStatus ?? "ok") === "ok";
  const risk = riskState(vault);

  const items = [
    {
      label: "NAV",
      value: `${fmtUSD(vault.currentNav, { compact: true })}`,
      sub: `${navChange >= 0 ? "+" : ""}${navChange.toFixed(1)}% scenario`,
      tone: navChange >= 0 ? "success" : "danger",
    },
    {
      label: "Liquid USDC",
      value: `${fmtUSD(liquidUsdc, { compact: true })}`,
      sub: vault.executionEnv === "surfpool" ? "Surfpool state" : "available reserve",
      tone: liquidUsdc >= vault.currentNav * 0.1 ? "success" : "warning",
    },
    {
      label: "WSOL exposure",
      value: `${fmtUSD(wsolExposure, { compact: true })}`,
      sub: wsolExposure > 0 ? "SOL leg active" : "no open SOL leg",
      tone: wsolExposure > 0 ? "neutral" : "success",
    },
    {
      label: "Junior buffer",
      value: `${fmtUSD(vault.juniorCapital, { compact: true })}`,
      sub: `${juniorUsedPct.toFixed(0)}% used`,
      tone: vault.juniorHealth >= 50 ? "success" : vault.juniorHealth >= 20 ? "warning" : "danger",
    },
    {
      label: "Investor impact",
      value: investorImpact > 0 ? fmtUSD(investorImpact, { compact: true }) : "0 USDC",
      sub: investorImpact > 0 ? "senior capital impaired" : "senior capital protected",
      tone: investorImpact > 0 ? "danger" : "success",
    },
    {
      label: "Claimable fees",
      value: claimableFees > 0 ? fmtUSD(claimableFees, { compact: true }) : "0 USDC",
      sub: claimableFees > 0 ? "above HWM" : "no fee in drawdown",
      tone: claimableFees > 0 ? "success" : "neutral",
    },
    {
      label: "Reserve pool",
      value: vault.reserveCapital ? `$${fmtUSD(vault.reserveCapital, { compact: true })}` : "—",
      sub: vault.reserveAllocationBps ? `${vault.reserveAllocationBps / 100}% of fees · ${reserveOk ? "OK" : "Watch"}` : "10% liquid rule",
      tone: reserveOk ? "success" : "warning",
    },
    {
      label: "Risk state",
      value: risk.label,
      sub: risk.sub,
      tone: risk.tone,
    },
  ];

  return (
    <div className="surface rounded-[11px] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-semibold">Vault state</h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Live capital lifecycle
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]", toneClass(risk.tone, true))}>
          <Circle className="h-2 w-2 fill-current" /> {risk.label}
        </span>
      </div>
      <div className={cn("grid gap-2.5", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3")}>
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-secondary/35 p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div>
            <div className="mt-1 font-display text-[18px] font-semibold tabular-nums">{item.value}</div>
            <div className={cn("mt-1 flex items-center gap-1 font-mono text-[10px]", toneClass(item.tone))}>
              {item.tone === "success" ? <ArrowUpRight className="h-3 w-3" /> : item.tone === "danger" ? <ArrowDownRight className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {item.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VaultActivityFeed({ vaultConfigPubkey }: { vaultConfigPubkey: string }) {
  const { data: activity } = useVaultActivity(vaultConfigPubkey);
  const { data: trades } = useVaultTrades(vaultConfigPubkey);

  const items = useMemo(() => {
    const liveItems = activity ?? [];
    const tradeItems: VaultActivityEvent[] = (trades ?? []).slice(0, 4).map((trade) => ({
      id: `initial-trade-${trade.occurredAt}-${trade.size}`,
      kind: "trade",
      label: trade.route ?? "Trade executed",
      amount: trade.size,
      tone: "neutral",
      occurredAt: trade.occurredAt,
      detail: "Public trader activity recorded.",
    }));
    return [...liveItems, ...tradeItems]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 10);
  }, [activity, trades]);

  return (
    <div className="surface rounded-[11px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <Activity className="h-4 w-4 text-primary" /> Live activity
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Run the demo flow to stream deposits, trades, withdrawals, risk states, and fees here.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg bg-secondary/25 p-3">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dotClass(item.tone))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-[13px] text-foreground">{item.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{timeLabel(item.occurredAt)}</div>
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</div>
              </div>
              {item.amount !== undefined && (
                <div className="shrink-0 font-mono text-[11px] text-foreground/80">{fmtUSD(item.amount, { compact: true })}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function riskState(vault: VaultView) {
  if (vault.status === "frozen" || vault.juniorHealth <= 0) return { label: "Frozen", sub: "trading disabled", tone: "danger" };
  if (vault.juniorHealth < 20) return { label: "Exit priority", sub: "investor exits emphasized", tone: "warning" };
  if (vault.juniorHealth < 50 || vault.status === "cooldown") return { label: "Caution", sub: "limits reduced", tone: "warning" };
  return { label: "Healthy", sub: "buffer active", tone: "success" };
}

function toneClass(tone: string, soft = false) {
  if (tone === "success") return soft ? "bg-primary/12 text-primary" : "text-primary";
  if (tone === "warning") return soft ? "bg-warning/15 text-warning" : "text-warning";
  if (tone === "danger") return soft ? "bg-destructive/15 text-destructive" : "text-destructive";
  return soft ? "bg-secondary text-muted-foreground" : "text-muted-foreground";
}

function dotClass(tone: string) {
  if (tone === "success") return "bg-primary";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-destructive";
  return "bg-muted-foreground";
}

function timeLabel(timestamp: number) {
  if (!timestamp) return "now";
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
