"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { EquityPoint } from "@/lib/types";

interface EquityChartProps {
  data: EquityPoint[];
  benchmarkData?: EquityPoint[];
  costBasis?: number;
  height?: number;
}

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EquityChart({ data, benchmarkData, costBasis, height = 120 }: EquityChartProps) {
  const last        = data[data.length - 1]?.value ?? 1;
  const isUp        = last >= (costBasis ?? data[0]?.value ?? 1);
  const strokeColor = isUp ? "var(--color-mint)" : "var(--color-red)";
  const glowRgba    = isUp ? "rgba(79,158,255,0.5)" : "rgba(239,68,68,0.5)";
  const gradId      = `equityGrad-${isUp ? "up" : "down"}`;
  const filterId    = `equityGlow-${isUp ? "up" : "down"}`;

  const merged = data.map((pt, i) => ({
    ts:        pt.ts,
    value:     pt.value,
    benchmark: benchmarkData?.[i]?.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={merged} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.55} />
            <stop offset="60%"  stopColor={strokeColor} stopOpacity={0.12} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
          <filter id={filterId} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
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
            background:    "rgba(13,13,13,0.95)",
            backdropFilter: "blur(12px)",
            border:         "1px solid var(--color-line)",
            borderRadius:   "10px",
            fontSize:       12,
            fontFamily:     "var(--font-mono)",
            fontWeight:     600,
            boxShadow:      "0 8px 32px rgba(0,0,0,0.6)",
            padding:        "8px 12px",
          }}
          labelStyle={{ color: "var(--color-faint)", marginBottom: "4px" }}
          labelFormatter={(v) => fmt(v as number)}
          formatter={(v: number, name: string) => [
            `$${v.toFixed(4)}`,
            name === "benchmark" ? "BTC HODL" : "Trader",
          ]}
          cursor={{ stroke: "var(--color-line)", strokeWidth: 1, strokeDasharray: "4 4" }}
        />

        {costBasis && (
          <ReferenceLine y={costBasis} stroke="var(--color-faint)" strokeDasharray="3 3" />
        )}

        {/* Wide glow halo — drawn under the crisp line */}
        <Area
          type="monotone"
          dataKey="value"
          stroke={glowRgba}
          strokeWidth={8}
          fill="none"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          legendType="none"
        />

        {/* Crisp fill area */}
        <Area
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor, stroke: "var(--color-bg)", strokeWidth: 2 }}
          animationDuration={800}
          animationEasing="ease-out"
        />

        {benchmarkData && (
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="var(--color-gold)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            strokeOpacity={0.6}
            activeDot={{ r: 3, fill: "var(--color-gold)" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
