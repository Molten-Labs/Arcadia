"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const TIER_COLOR = {
  verified: "var(--color-tier-verified)",
  established: "var(--color-tier-established)",
  advanced: "var(--color-tier-advanced)",
  elite: "var(--color-tier-elite)",
} as const;

export type ScoreTier = keyof typeof TIER_COLOR;

export type ScoreDialProps = {
  /** Current score (0..max). */
  value: number;
  /** Maximum score. */
  max?: number;
  /** Diameter in px. */
  size?: number;
  /** Optional tier ring + accent. */
  tier?: ScoreTier;
  /** Caption under the number (defaults to `/ {max}`). */
  label?: string;
  className?: string;
};

/**
 * Circular score gauge. The arc fills violet -> cyan -> acid the first time it
 * scrolls into view, with a count-up in the center and an optional tier ring.
 * Reduced-motion snaps to the final state.
 */
export function ScoreDial({
  value,
  max = 1000,
  size = 220,
  tier,
  label,
  className,
}: ScoreDialProps) {
  const reduced = usePrefersReducedMotion();
  const gradientId = useId();
  const ref = useRef<SVGSVGElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFilled(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const stroke = Math.max(8, Math.round(size * 0.055));
  const center = size / 2;
  const tierGap = tier ? 10 : 0;
  const radius = center - stroke / 2 - tierGap;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value / max, 0), 1);
  const dashoffset = filled || reduced ? circumference * (1 - pct) : circumference;
  const tierRadius = center - 3;

  return (
    <div
      role="img"
      aria-label={`Score ${value} of ${max}${tier ? `, ${tier} tier` : ""}`}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-tier-established)" />
            <stop offset="55%" stopColor="var(--color-cyan)" />
            <stop offset="100%" stopColor="var(--color-acid)" />
          </linearGradient>
        </defs>
        {tier && (
          <circle
            cx={center}
            cy={center}
            r={tierRadius}
            fill="none"
            stroke={TIER_COLOR[tier]}
            strokeOpacity={0.35}
            strokeWidth={2}
          />
        )}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{
            transition: reduced ? undefined : "stroke-dashoffset 1.5s cubic-bezier(0.19,1,0.22,1)",
          }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="flex flex-col items-center">
          <span
            className="acid-chrome font-display leading-none font-extrabold tracking-tight"
            style={{ fontSize: size * 0.28 }}
          >
            <CountUp value={value} />
          </span>
          <span className="mt-1 font-mono text-faint" style={{ fontSize: size * 0.06 }}>
            {label ?? `/ ${max}`}
          </span>
        </div>
      </div>
    </div>
  );
}
