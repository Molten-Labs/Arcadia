import { Link } from "react-router-dom";
import { Vault, getTrader } from "@/lib/mockData";
import { fmtUSD, fmtPct } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { TierBadge } from "./TierBadge";
import { HealthMeter } from "./HealthMeter";
import { ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const VaultCard = ({ vault }: { vault: Vault }) => {
  const trader = getTrader(vault.traderWallet);
  const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;
  const positive = vault.return30d >= 0;

  return (
    <Link
      to={`/vault/${vault.id}`}
      className="group surface rounded-2xl p-5 shadow-card hover:border-border-strong hover:bg-card-elevated transition-all flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-lg leading-tight truncate">{vault.name}</h3>
          {trader && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground truncate">by {trader.name}</span>
              <TierBadge tier={trader.tier} showIcon={false} className="scale-90 origin-left" />
            </div>
          )}
        </div>
        <StatusBadge status={vault.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-border">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">TVL</div>
          <div className="tabular font-semibold text-sm mt-0.5">${fmtUSD(vault.tvl, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">30d</div>
          <div className={cn("tabular font-semibold text-sm mt-0.5", positive ? "text-success" : "text-destructive")}>
            {fmtPct(vault.return30d)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Junior</div>
          <div className="tabular font-semibold text-sm mt-0.5">{juniorPct}%</div>
        </div>
      </div>

      <HealthMeter health={vault.juniorHealth} />

      <div className="flex flex-wrap gap-1.5">
        {vault.strategyTags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t}</span>
        ))}
        {vault.instantExit && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary inline-flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> Instant exit
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {vault.status === "paper" && vault.paperDaysElapsed != null
            ? `${vault.paperDaysElapsed}/${vault.paperDaysRequired}d paper`
            : vault.graduatedAt
            ? `Graduated ${new Date(vault.graduatedAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
            : ""}
        </span>
        <span className="text-xs text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
          View vault <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
