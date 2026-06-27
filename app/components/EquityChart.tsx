"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { EquityPoint } from "@/lib/types";

interface EquityChartProps {
  data: EquityPoint[];
  costBasis?: number;
  height?: number;
}

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EquityChart({ data, costBasis, height = 120 }: EquityChartProps) {
  const last = data[data.length - 1]?.value ?? 1;
  const isUp = last >= (costBasis ?? data[0]?.value ?? 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={isUp ? "var(--color-green)" : "var(--color-red)"}
              stopOpacity={0.25}
            />
            <stop
              offset="95%"
              stopColor={isUp ? "var(--color-green)" : "var(--color-red)"}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          tickFormatter={fmt}
          tick={{ fill: "var(--color-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          hide
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-line)",
            borderRadius: "6px",
            fontSize: 11,
          }}
          labelFormatter={(v) => fmt(v as number)}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Value"]}
        />
        {costBasis && (
          <ReferenceLine
            y={costBasis}
            stroke="var(--color-faint)"
            strokeDasharray="3 3"
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={isUp ? "var(--color-green)" : "var(--color-red)"}
          strokeWidth={1.5}
          fill="url(#equityGrad)"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
