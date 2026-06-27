"use client";

import { tierColor } from "@/lib/types";
import type { ScoreTier } from "@/lib/types";

interface ScoreDialProps {
  score: number;
  max?: number;
  tier: ScoreTier;
  size?: number;
}

export function ScoreDial({ score, max = 1000, tier, size = 96 }: ScoreDialProps) {
  const color = tierColor(tier);
  const r = (size / 2) * 0.72;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const startAngle = -225;
  const sweepAngle = 270;
  const pct = Math.min(1, score / max);
  const fillLen = circumference * (sweepAngle / 360) * pct;

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endDeg = startAngle + sweepAngle * pct;
  const trackEnd = startAngle + sweepAngle;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={describeArc(startAngle, trackEnd, r)}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={size * 0.075}
        strokeLinecap="round"
      />
      <path
        d={describeArc(startAngle, endDeg, r)}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.075}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--color-ink)"
        fontSize={size * 0.22}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + size * 0.22}
        textAnchor="middle"
        fill={color}
        fontSize={size * 0.1}
        fontWeight="600"
        fontFamily="Inter, sans-serif"
        letterSpacing="0.1em"
      >
        {tier.toUpperCase()}
      </text>
    </svg>
  );
}
