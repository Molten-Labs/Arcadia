"use client";

import { useState, useEffect } from "react";
import { tierColor } from "@/lib/types";
import type { ScoreTier } from "@/lib/types";

interface ScoreDialProps {
  score: number;
  max?: number;
  tier: ScoreTier;
  size?: number;
}

export function ScoreDial({ score, max = 1000, tier, size = 96 }: ScoreDialProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const start    = performance.now();
    const duration = 900;

    function tick(now: number) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(tick);
    }

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [score]);

  const r          = (size / 2) * 0.72;
  const cx         = size / 2;
  const cy         = size / 2;
  const startAngle = -225;
  const sweepAngle = 270;
  const pct        = Math.min(1, displayScore / max);

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const s     = polarToXY(startDeg, radius);
    const e     = polarToXY(endDeg,   radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endDeg   = startAngle + sweepAngle * pct;
  const trackEnd = startAngle + sweepAngle;

  const glowId  = `scoreGlow-${size}`;
  const gradId  = `scoreGrad-${size}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--color-mint)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={describeArc(startAngle, trackEnd, r)}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={size * 0.08}
          strokeLinecap="round"
        />

        {/* Wide glow behind active track */}
        <path
          d={describeArc(startAngle, endDeg, r)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size * 0.18}
          strokeLinecap="round"
          opacity="0.18"
          filter={`url(#${glowId})`}
        />

        {/* Tight glow layer */}
        <path
          d={describeArc(startAngle, endDeg, r)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size * 0.08}
          strokeLinecap="round"
          opacity="0.35"
          filter={`url(#${glowId})`}
        />

        {/* Active track — crisp */}
        <path
          d={describeArc(startAngle, endDeg, r)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size * 0.08}
          strokeLinecap="round"
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-ink)"
          fontSize={size * 0.24}
          fontWeight="800"
          fontFamily="var(--font-sans)"
          style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
        >
          {displayScore}
        </text>

        {/* Tier label */}
        <text
          x={cx}
          y={cy + size * 0.22}
          textAnchor="middle"
          fill={tierColor(tier)}
          fontSize={size * 0.09}
          fontWeight="700"
          fontFamily="var(--font-sans)"
          letterSpacing="0.15em"
        >
          {tier.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
