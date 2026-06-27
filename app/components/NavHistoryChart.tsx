"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
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
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="ts"
          tickFormatter={fmt}
          tick={{ fill: "var(--color-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-line)",
            borderRadius: "6px",
            fontSize: 11,
          }}
          labelFormatter={(v) => fmt(v as number)}
          formatter={(v: number) => [v.toFixed(4), "NAV"]}
        />
        {hwm && (
          <ReferenceLine
            y={hwm}
            stroke="var(--color-gold)"
            strokeDasharray="3 3"
            label={{ value: "HWM", fill: "var(--color-gold)", fontSize: 10 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
