"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { ScorePoint } from "@/lib/types";

interface Props {
  data: ScorePoint[];
  height?: number;
}

const TIER_BANDS = [
  { lo: 900, hi: 1000, color: "var(--color-tier-elite)",       label: "Elite" },
  { lo: 800, hi: 900,  color: "var(--color-tier-advanced)",    label: "Advanced" },
  { lo: 700, hi: 800,  color: "var(--color-tier-established)", label: "Established" },
  { lo: 600, hi: 700,  color: "var(--color-tier-verified)",    label: "Verified" },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const tier = score >= 900 ? "Elite" : score >= 800 ? "Advanced" : score >= 700 ? "Established" : "Verified";
  const color =
    score >= 900 ? "var(--color-tier-elite)"
    : score >= 800 ? "var(--color-tier-advanced)"
    : score >= 700 ? "var(--color-tier-established)"
    : "var(--color-tier-verified)";
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl border"
      style={{ background: "var(--color-panel)", borderColor: "var(--color-line)" }}
    >
      <p className="font-mono text-[10px] mb-1" style={{ color: "var(--color-faint)" }}>
        {label ? new Date(label * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </p>
      <p className="font-black text-base tnum" style={{ color }}>
        {score}
      </p>
      <p className="text-[10px] font-bold" style={{ color }}>{tier}</p>
    </div>
  );
}

export function ScoreHistoryChart({ data, height = 220 }: Props) {
  const minScore = Math.max(400, Math.min(...data.map((d) => d.score)) - 30);
  const maxScore = Math.min(1000, Math.max(...data.map((d) => d.score)) + 20);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {TIER_BANDS.map((band) =>
          band.hi > minScore && band.lo < maxScore ? (
            <ReferenceArea
              key={band.label}
              y1={Math.max(band.lo, minScore)}
              y2={Math.min(band.hi, maxScore)}
              fill={band.color}
              fillOpacity={0.04}
            />
          ) : null
        )}

        {[700, 800, 900].map((v) =>
          v > minScore && v < maxScore ? (
            <ReferenceLine
              key={v}
              y={v}
              stroke="var(--color-line)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
          ) : null
        )}

        <XAxis
          dataKey="ts"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) =>
            new Date(v * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }
          tick={{ fontSize: 9, fill: "var(--color-faint)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minScore, maxScore]}
          tick={{ fontSize: 9, fill: "var(--color-faint)" }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => v.toString()}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--color-line)", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--color-acid)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-acid)", stroke: "var(--color-void)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
