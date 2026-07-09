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

interface NavHistoryChartProps {
  data: EquityPoint[];
  hwm?: number;
  height?: number;
}

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NavHistoryChart({ data, hwm, height = 100 }: NavHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-acid)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-acid)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          tickFormatter={fmt}
          tick={{ fill: "var(--color-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "color-mix(in srgb, var(--color-panel) 90%, transparent)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--color-line)",
            borderRadius: "8px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            padding: "8px 12px"
          }}
          itemStyle={{ color: "var(--color-acid)" }}
          labelStyle={{ color: "var(--color-faint)", marginBottom: "4px" }}
          labelFormatter={(v) => fmt(v as number)}
          formatter={(v: number) => [v.toFixed(4), "NAV"]}
          cursor={{ stroke: "var(--color-line)", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        {hwm && (
          <ReferenceLine
            y={hwm}
            stroke="var(--color-cyan)"
            strokeDasharray="4 4"
            label={{ value: "HWM", fill: "var(--color-cyan)", fontSize: 10, position: "insideTopLeft", fontFamily: "var(--font-mono)" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-acid)"
          strokeWidth={2}
          fill="url(#navGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-acid)", stroke: "var(--color-void)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}