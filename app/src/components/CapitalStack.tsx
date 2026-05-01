import { fmtUSD } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";

interface Props {
  junior: number;
  senior: number;
  health: number;
}

export const CapitalStack = ({ junior, senior, health }: Props) => {
  const total = junior + senior;
  const juniorPct = total > 0 ? (junior / total) * 100 : 0;

  // Generate historical chart data
  const data = Array.from({ length: 12 }, (_, i) => ({
    day: i,
    senior: Math.max(senior * 0.7, senior - Math.random() * (senior * 0.3)),
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
              Losses are absorbed by junior capital first. Senior (investor) capital is protected as long as the junior buffer holds.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="surface-elevated rounded-lg p-4 space-y-4">
        {/* Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSenior" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorJunior" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary-deep))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary-deep))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                opacity={0.6}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                opacity={0.6}
                width={40}
              />
              <ChartTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value) => `$${(value as number).toFixed(0)}`}
              />
              <Area
                type="monotone"
                dataKey="senior"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="url(#colorSenior)"
                isAnimationActive={false}
                name="Senior (investors)"
              />
              <Area
                type="monotone"
                dataKey="junior"
                stackId="1"
                stroke="hsl(var(--primary-deep))"
                fill="url(#colorJunior)"
                isAnimationActive={false}
                name="Junior (trader)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary" />
              <span className="text-xs font-medium">Senior (investors)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(senior, { compact: true })}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary-deep" />
              <span className="text-xs font-medium">Junior (trader skin)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(junior, { compact: true })}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
          Losses hit the junior layer first. Trader capital absorbs drawdowns before any investor funds are touched.
        </p>
      </div>
    </div>
  );
};
