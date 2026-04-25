import { Link } from "react-router-dom";
import { Trader } from "@/lib/mockData";
import { fmtUSD, fmtPct } from "@/lib/format";
import { TierBadge } from "./TierBadge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const TraderCard = ({ trader }: { trader: Trader }) => {
  const initials = trader.name.split(" ").map(n => n[0]).join("");
  const positive = trader.pnl90d >= 0;

  return (
    <Link
      to={`/trader/${trader.wallet}`}
      className="group surface rounded-2xl p-5 shadow-card hover:border-border-strong hover:bg-card-elevated transition-colors flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-ember flex items-center justify-center text-white font-display font-bold text-lg shrink-0 shadow-ember">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-lg truncate">{trader.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground font-mono">@{trader.handle}</span>
          </div>
        </div>
        <TierBadge tier={trader.tier} />
      </div>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-border">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">90d PnL</div>
          <div className={cn("tabular font-semibold text-sm mt-0.5", positive ? "text-success" : "text-destructive")}>
            {fmtPct(trader.pnl90d)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">AUM</div>
          <div className="tabular font-semibold text-sm mt-0.5">${fmtUSD(trader.totalAUM, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max DD</div>
          <div className="tabular font-semibold text-sm mt-0.5 text-muted-foreground">{fmtPct(trader.maxDrawdown)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          <span className="text-foreground font-semibold">{trader.activeVaults}</span> active ·{" "}
          <span className="text-foreground font-semibold">{trader.graduatedVaults}</span> graduated
        </div>
        <div className="text-muted-foreground">
          <span className="text-foreground font-semibold">{trader.freezeCount}</span> freezes
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {trader.strategyTags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t}</span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Reputation {trader.reputation}</span>
        <span className="text-xs text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-[gap]">
          View profile <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
