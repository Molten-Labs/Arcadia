import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { fmtUSD, fmtDate } from "@/lib/format";

interface Props {
  data: { t: string; nav: number; junior?: number; senior?: number }[];
  showLayers?: boolean;
  height?: number;
}

export const NavChart = ({ data, showLayers = false, height = 280 }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {showLayers ? (
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" tickFormatter={(v) => `$${fmtUSD(v, { compact: true })}`} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card-elevated))", border: "1px solid hsl(var(--border-strong))", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => `$${fmtUSD(v)}`}
            labelFormatter={fmtDate}
          />
          <Area type="monotone" dataKey="nav" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#navGrad)" />
          <Line type="monotone" dataKey="junior" stroke="hsl(var(--primary-glow))" strokeWidth={1} strokeDasharray="3 3" dot={false} />
          <Line type="monotone" dataKey="senior" stroke="hsl(var(--info))" strokeWidth={1} strokeDasharray="3 3" dot={false} />
        </AreaChart>
      ) : (
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="navGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" tickFormatter={(v) => `$${fmtUSD(v, { compact: true })}`} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card-elevated))", border: "1px solid hsl(var(--border-strong))", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => `$${fmtUSD(v)}`}
            labelFormatter={fmtDate}
          />
          <Area type="monotone" dataKey="nav" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#navGrad2)" />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
};
