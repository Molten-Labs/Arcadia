"use client";

import { useEffect, useState } from "react";

export interface RadarItem {
  label: string;
  value: number;
  max: number;
  fmt?: (v: number) => string;
  display?: string;
  invert?: boolean;
  tone?: "acid" | "cyan" | "danger" | "muted";
}

const LEVELS = 4;

function radarColor(pct: number, invert?: boolean, tone?: RadarItem["tone"]): string {
  if (tone === "danger") return "var(--color-danger)";
  if (tone === "muted") return "var(--color-muted)";
  if (invert) {
    if (pct > 0.6) return "var(--color-danger)";
    if (pct > 0.3) return "var(--color-tier-advanced)";
    return "var(--color-success)";
  }
  return pct > 0.55 ? "var(--color-acid)" : "var(--color-cyan)";
}

/**
 * Pure-SVG radar chart replacing the flat MetricBars.
 * Accepts the same item shape used by both the discovery MetricBars
 * and the trader-ui MetricBars (fmt / display / invert / tone all work).
 */
export function RiskRadar({ items }: { items: RadarItem[] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const N = items.length;
  const W = 280;
  const H = 270;
  const CX = W / 2;
  const CY = H / 2 - 4;
  const R = 84;
  const LPAD = 28;

  const norm = items.map((it) => Math.min(1, Math.max(0, it.value / it.max)));

  const ang = (i: number) => (i / N) * Math.PI * 2 - Math.PI / 2;

  const pt = (r: number, i: number): [number, number] => [
    CX + r * Math.cos(ang(i)),
    CY + r * Math.sin(ang(i)),
  ];

  const polyStr = (r: number) =>
    Array.from({ length: N }, (_, i) => {
      const [x, y] = pt(r, i);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  const dataStr = norm
    .map((v, i) => {
      const [x, y] = pt(v * R, i);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="select-none overflow-visible"
      aria-label="Risk profile radar chart"
    >
      {/* Concentric grid rings */}
      {Array.from({ length: LEVELS }, (_, l) => l + 1).map((lvl) => (
        <polygon
          key={lvl}
          points={polyStr((R * lvl) / LEVELS)}
          fill="none"
          stroke="rgba(255,255,255,0.055)"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {items.map((_, i) => {
        const [x, y] = pt(R, i);
        return (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={x} y2={y}
            stroke="rgba(255,255,255,0.055)"
            strokeWidth={1}
          />
        );
      })}

      {/* Filled data polygon */}
      <polygon
        points={dataStr}
        fill="color-mix(in srgb, var(--color-acid) 11%, transparent)"
        stroke="var(--color-acid)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      />

      {/* Glow behind the stroke */}
      <polygon
        points={dataStr}
        fill="none"
        stroke="var(--color-acid)"
        strokeWidth={4}
        strokeLinejoin="round"
        style={{
          opacity: visible ? 0.12 : 0,
          filter: "blur(3px)",
          transition: "opacity 0.5s ease",
        }}
      />

      {/* Vertex dots */}
      {norm.map((v, i) => {
        const [x, y] = pt(v * R, i);
        const color = radarColor(v, items[i].invert, items[i].tone);
        return (
          <circle
            key={i}
            cx={x} cy={y} r={3.5}
            fill={color}
            stroke="var(--color-void)"
            strokeWidth={1.5}
            style={{
              opacity: visible ? 1 : 0,
              transition: `opacity 0.4s ease ${i * 0.06}s`,
            }}
          />
        );
      })}

      {/* Labels + values around the perimeter */}
      {items.map((item, i) => {
        const [lx, ly] = pt(R + LPAD, i);
        const display = item.fmt
          ? item.fmt(item.value)
          : item.display ?? item.value.toFixed(2);
        const color = radarColor(norm[i], item.invert, item.tone);
        const dx = Math.cos(ang(i));
        const anchor: "start" | "end" | "middle" =
          dx > 0.25 ? "start" : dx < -0.25 ? "end" : "middle";

        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 7}
              textAnchor={anchor}
              fontSize={7.5}
              fill="var(--color-faint)"
              fontFamily="var(--font-mono, monospace)"
              letterSpacing="0.10em"
              style={{ textTransform: "uppercase" }}
            >
              {item.label}
            </text>
            <text
              x={lx}
              y={ly + 7}
              textAnchor={anchor}
              fontSize={10}
              fill={color}
              fontFamily="var(--font-mono, monospace)"
              fontWeight="700"
              style={{
                opacity: visible ? 1 : 0,
                transition: `opacity 0.4s ease ${i * 0.06}s`,
              }}
            >
              {display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
