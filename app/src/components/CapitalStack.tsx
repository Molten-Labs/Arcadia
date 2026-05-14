import { fmtUSD } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";

interface Props {
  junior: number;
  senior: number;
  health: number;
  reserve?: number;
}

export const CapitalStack = ({ junior, senior, health, reserve = 0 }: Props) => {
  const total = junior + reserve + senior;
  const juniorPct  = total > 0 ? (junior  / total) * 100 : 0;
  const reservePct = total > 0 ? (reserve / total) * 100 : 0;
  const seniorPct  = total > 0 ? (senior  / total) * 100 : 0;

  const data = Array.from({ length: 12 }, (_, i) => ({
    day: i,
    senior: Math.max(senior * 0.7, senior - Math.random() * (senior * 0.3)),
    reserve: Math.max(0, reserve * (0.6 + i * 0.04)),
    junior: Math.max(junior * 0.4, junior - Math.random() * (junior * 0.6)),
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Capital stack</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Losses hit the junior layer first, then the reserve, then senior investor capital. The reserve grows automatically from a portion of trader performance fees.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="surface-elevated rounded-2xl p-4 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/55 bg-background/75">
          <div
            className="flex min-h-20 items-center justify-center bg-gradient-senior px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground dark:text-foreground"
            style={{ height: `${Math.max(44, seniorPct)}%` }}
          >
            Investor layer
          </div>
          {reserve > 0 && (
            <div
              className="flex min-h-8 items-center justify-center bg-amber-500/80 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white"
              style={{ height: `${Math.max(20, reservePct)}%` }}
            >
              Reserve layer
            </div>
          )}
          <div
            className="flex min-h-12 items-center justify-center bg-gradient-junior px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground"
            style={{ height: `${Math.max(36, juniorPct)}%` }}
          >
            Trader first-loss layer
          </div>
        </div>

        {/* Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSenior" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorReserve" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.75} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorJunior" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary-deep))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary-deep))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" opacity={0.6} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" opacity={0.6} width={40} />
              <ChartTooltip
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                formatter={(value) => `$${(value as number).toFixed(0)}`}
              />
              <Area type="monotone" dataKey="senior"  stackId="1" stroke="hsl(var(--primary))"       fill="url(#colorSenior)"  isAnimationActive={false} name="Senior (investors)" />
              {reserve > 0 && (
                <Area type="monotone" dataKey="reserve" stackId="1" stroke="#f59e0b"                  fill="url(#colorReserve)" isAnimationActive={false} name="Reserve" />
              )}
              <Area type="monotone" dataKey="junior"  stackId="1" stroke="hsl(var(--primary-deep))"  fill="url(#colorJunior)"  isAnimationActive={false} name="Junior (trader)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className={`grid gap-3 pt-2 border-t border-border ${reserve > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary" />
              <span className="text-xs font-medium">Senior (investors)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(senior, { compact: true })}</span>
          </div>
          {reserve > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-sm bg-amber-500" />
                <span className="text-xs font-medium">Reserve</span>
              </div>
              <span className="text-xs tabular text-muted-foreground">${fmtUSD(reserve, { compact: true })}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary-deep" />
              <span className="text-xs font-medium">Junior (trader skin)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(junior, { compact: true })}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Losses hit the junior layer first, then the reserve, then senior investor capital.
        </p>
      </div>
    </div>
  );
};
