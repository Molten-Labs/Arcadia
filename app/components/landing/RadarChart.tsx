"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/acid";

export type RadarMetric = {
  label: string;
  value: number;
};

export type RadarChartProps = {
  metrics: RadarMetric[];
  className?: string;
};

const W = 320;
const H = 240;
const CX = W / 2;
const CY = H / 2;
const RADIUS = 76;
const RINGS = 5;
const EASE = "cubic-bezier(0.19,1,0.22,1)";

/**
 * Native SVG radar for a set of metrics (0-100). Grid rings + axes fade in,
 * then the data polygon scales from the center on first scroll into view.
 * Values render under each axis label. Reduced-motion snaps to the final
 * state. Mirrors the ScoreDial/AnimatedBar animation contract (IntersectionObserver
 * + token-driven CSS transitions, no global keyframes).
 */
export function RadarChart({ metrics, className }: RadarChartProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const active = shown || reduced;
  const count = metrics.length;

  const angle = (i: number) => (Math.PI * 2 * i) / count - Math.PI / 2;

  const point = (i: number, scale: number): [number, number] => {
    const a = angle(i);
    return [CX + Math.cos(a) * RADIUS * scale, CY + Math.sin(a) * RADIUS * scale];
  };

  const polygonPoints = (scale: number) =>
    Array.from({ length: count }, (_, i) => point(i, scale))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  const dataPoints = metrics
    .map((m, i) => point(i, Math.max(m.value / 100, 0.05)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={metrics.map((m) => `${m.label} ${m.value}`).join(", ")}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
    >
      {Array.from({ length: RINGS }, (_, i) => {
        const scale = (i + 1) / RINGS;
        return (
          <polygon
            key={`ring-${i}`}
            points={polygonPoints(scale)}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
            style={{
              opacity: active ? 1 : 0,
              transition: reduced ? undefined : `opacity 0.8s ease ${(i + 1) * 0.07}s`,
            }}
          />
        );
      })}

      {metrics.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={`axis-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
            style={{
              opacity: active ? 1 : 0,
              transition: reduced ? undefined : "opacity 0.8s ease 0.4s",
            }}
          />
        );
      })}

      <g
        style={{
          transform: active ? "scale(1)" : "scale(0.05)",
          transformOrigin: `${CX}px ${CY}px`,
          transition: reduced ? undefined : `transform 1.4s ${EASE} 0.15s`,
        }}
      >
        <polygon
          points={dataPoints}
          fill="color-mix(in srgb, var(--color-acid) 14%, transparent)"
          stroke="var(--color-acid)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {metrics.map((m, i) => {
          const [x, y] = point(i, Math.max(m.value / 100, 0.05));
          return (
            <circle
              key={`dot-${m.label}`}
              cx={x}
              cy={y}
              r={2.5}
              fill="var(--color-acid)"
            />
          );
        })}
      </g>

      {metrics.map((m, i) => {
        const a = angle(i);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const gap = 18;
        const [x, y] = point(i, 1);
        const lx = x + cos * gap;
        const ly = y + sin * gap;
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <text
            key={`label-${m.label}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            style={{
              opacity: active ? 1 : 0,
              transition: reduced ? undefined : "opacity 0.9s ease 0.55s",
            }}
          >
            <tspan
              x={lx}
              dy={0}
              className="font-mono"
              fill="var(--color-muted)"
              style={{ fontSize: 10, letterSpacing: "0.02em" }}
            >
              {m.label}
            </tspan>
            <tspan
              x={lx}
              dy={15}
              className="font-mono"
              fill="var(--color-ink)"
              fontWeight={700}
              style={{ fontSize: 12, letterSpacing: "0.02em" }}
            >
              {m.value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
