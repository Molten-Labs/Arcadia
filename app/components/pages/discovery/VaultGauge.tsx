"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatK } from "./bits";

/**
 * Half-circle SVG gauge replacing the flat AllocationBar.
 * Shows AUM vs vault capacity with an animated acid→cyan fill,
 * flipping to danger when ≥ 85% full.
 */
export function VaultGauge({
  aum,
  total,
  className,
}: {
  aum: number;
  total: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = total > 0 ? Math.min(1, aum / total) : 0;
  const left = Math.max(0, total - aum);
  const full = pct >= 0.85;

  const CX = 100;
  const CY = 96;
  const R = 72;
  const STROKE = 9;

  /* Half-circle arc: left (180°) → right (0°) through top */
  const arcPt = (p: number) => ({
    x: CX + R * Math.cos(Math.PI * (1 - p)),
    y: CY - R * Math.sin(Math.PI * (1 - p)),
  });

  const start = arcPt(0);
  const end = arcPt(1);
  const fillEnd = arcPt(pct);

  const bgPath = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;
  const fillPath =
    pct > 0.001
      ? `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${fillEnd.x.toFixed(2)} ${fillEnd.y.toFixed(2)}`
      : null;

  /* Animate via stroke-dasharray trick */
  const arcLen = Math.PI * R; // half-circle circumference ≈ 226
  const dashOffset = mounted ? arcLen * (1 - pct) : arcLen;

  const fillColor = full ? "var(--color-danger)" : "url(#vgGrad)";
  const accentColor = full ? "var(--color-danger)" : "var(--color-acid)";

  return (
    <div className={cn("select-none", className)}>
      <svg
        viewBox="0 0 200 118"
        width="100%"
        className="overflow-visible"
        aria-label={`Vault capacity: ${Math.round(pct * 100)}% full`}
      >
        <defs>
          <linearGradient
            id="vgGrad"
            x1={start.x}
            y1="0"
            x2={end.x}
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--color-acid)" />
            <stop offset="100%" stopColor="var(--color-cyan)" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Glow layer */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={accentColor}
            strokeWidth={STROKE + 4}
            strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={dashOffset}
            style={{
              opacity: mounted ? 0.18 : 0,
              filter: "blur(4px)",
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease",
            }}
          />
        )}

        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={fillColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        )}

        {/* Tip dot at fill end */}
        {fillPath && pct > 0.01 && (
          <circle
            cx={fillEnd.x}
            cy={fillEnd.y}
            r={STROKE / 2 + 0.5}
            fill={full ? "var(--color-danger)" : "var(--color-cyan)"}
            stroke="var(--color-void)"
            strokeWidth={1.5}
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 0.6s ease 0.5s",
            }}
          />
        )}

        {/* AUM value */}
        <text
          x={CX}
          y={CY - 16}
          textAnchor="middle"
          fontSize={21}
          fontWeight={800}
          fontFamily="var(--font-mono, monospace)"
          fill="var(--color-ink)"
          letterSpacing="-0.02em"
        >
          {formatK(aum)}
        </text>

        {/* Percentage pill */}
        <text
          x={CX}
          y={CY + 0}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fontFamily="var(--font-mono, monospace)"
          fill={accentColor}
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.4s ease 0.3s",
          }}
        >
          {Math.round(pct * 100)}%
        </text>

        {/* "AUM" label */}
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fontSize={7.5}
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--color-faint)"
        >
          AUM
        </text>

        {/* Left label */}
        <text
          x={start.x + 2}
          y={CY + 24}
          textAnchor="start"
          fontSize={8}
          fontFamily="var(--font-mono, monospace)"
          fill={full ? "var(--color-danger)" : "var(--color-muted)"}
        >
          {formatK(left)} left
        </text>

        {/* Max label */}
        <text
          x={end.x - 2}
          y={CY + 24}
          textAnchor="end"
          fontSize={8}
          fontFamily="var(--font-mono, monospace)"
          fill="var(--color-faint)"
        >
          {formatK(total)} max
        </text>
      </svg>
    </div>
  );
}
