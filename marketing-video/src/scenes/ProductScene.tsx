import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BRAND, FONT } from "../constants";

// Pre-computed realistic equity curves (90d return %)
const CURVES = {
  elite: [
    0, 2.1, 5.3, 4.8, 8.2, 11.5, 10.1, 14.3, 17.8, 16.2, 20.5, 23.1,
    21.9, 26.4, 29.8, 28.3, 32.1, 35.6, 34.2, 37.8, 36.5, 39.2, 40.1,
    38.9, 41.2, 39.8, 41.5, 40.9, 41.5, 41.8,
  ],
  veteran: [
    0, 1.5, -1.2, 4.3, 7.8, 6.2, 10.5, 9.1, 13.4, 11.8, 15.2, 14.1,
    17.8, 16.4, 19.2, 18.1, 21.5, 20.3, 23.1, 22.0, 24.5, 23.2, 25.8,
    24.6, 26.9, 25.8, 27.3, 26.9, 27.8, 28.5,
  ],
  established: [
    0, 1.0, 3.2, 1.8, -0.5, 4.2, 7.1, 5.8, 9.2, 7.9, 11.5, 10.3,
    12.8, 11.2, 14.6, 13.1, 15.8, 14.6, 16.9, 15.7, 17.2, 16.1, 17.8,
    16.9, 18.1, 17.5, 18.6, 17.9, 18.8, 19.2,
  ],
};

interface SparkLineProps {
  data: number[];
  width: number;
  height: number;
  revealProgress: number;
  color: string;
  id: string;
}

const SparkLine: React.FC<SparkLineProps> = ({ data, width, height, revealProgress, color, id }) => {
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 4 - ((v - minVal) / range) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");

  const fillPts = [
    `0,${height}`,
    ...data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 4 - ((v - minVal) / range) * (height - 8);
      return `${x},${y}`;
    }),
    `${width},${height}`,
  ].join(" ");

  const clipW = revealProgress * width;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: "visible", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`clip-${id}`}>
          <rect x="0" y="-10" width={clipW} height={height + 20} />
        </clipPath>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <polygon
        points={fillPts}
        fill={`url(#grad-${id})`}
        clipPath={`url(#clip-${id})`}
      />

      {/* Line */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#clip-${id})`}
      />

      {/* Trailing dot */}
      {revealProgress > 0.05 && (() => {
        const idx = Math.min(
          data.length - 1,
          Math.floor(revealProgress * (data.length - 1))
        );
        const x = (idx / (data.length - 1)) * width;
        const y = height - 4 - ((data[idx] - minVal) / range) * (height - 8);
        return (
          <circle
            cx={x}
            cy={y}
            r={3.5}
            fill={color}
            opacity={0.9}
          />
        );
      })()}
    </svg>
  );
};

const TRADERS = [
  {
    addr: "0x7f3…a4B2",
    tier: "Elite",
    tierColor: BRAND.signalPrimary,
    apr: "+41.8%",
    drawdown: "-3.2%",
    sharpe: "3.1",
    filled: 0.91,
    capacity: "$2.4M",
    curve: CURVES.elite,
    curveColor: BRAND.signalPrimary,
  },
  {
    addr: "0xC9d…88fE",
    tier: "Veteran",
    tierColor: "#A78BFA",
    apr: "+28.5%",
    drawdown: "-6.1%",
    sharpe: "2.4",
    filled: 0.64,
    capacity: "$800K",
    curve: CURVES.veteran,
    curveColor: "#A78BFA",
  },
  {
    addr: "0x4a1…3c71",
    tier: "Established",
    tierColor: "#60A5FA",
    apr: "+19.2%",
    drawdown: "-8.4%",
    sharpe: "1.8",
    filled: 0.38,
    capacity: "$300K",
    curve: CURVES.established,
    curveColor: "#60A5FA",
  },
];

interface TraderCardProps {
  trader: (typeof TRADERS)[0];
  startFrame: number;
  frame: number;
  index: number;
}

const TraderCard: React.FC<TraderCardProps> = ({ trader, startFrame, frame, index }) => {
  const f = Math.max(0, frame - startFrame);
  const opacity = interpolate(f, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 22], [36, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Capacity bar grows
  const capBarW = interpolate(f, [22, 55], [0, trader.filled], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Sparkline draws progressively
  const sparkReveal = interpolate(f, [30, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        backgroundColor: BRAND.surface,
        borderRadius: 12,
        border: `1px solid rgba(255,255,255,0.055)`,
        borderTop: `2px solid ${trader.tierColor}`,
        padding: "26px 28px",
        opacity,
        transform: `translateY(${y}px)`,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 14, color: BRAND.textSecondary }}>
          {trader.addr}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: trader.tierColor,
            backgroundColor: `${trader.tierColor}18`,
            border: `1px solid ${trader.tierColor}40`,
            padding: "3px 10px",
            borderRadius: 20,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {trader.tier}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
        {[
          { label: "90d APR", value: trader.apr, color: BRAND.signalPrimary },
          { label: "Max DD", value: trader.drawdown, color: BRAND.danger },
          { label: "Sharpe", value: trader.sharpe, color: BRAND.textPrimary },
        ].map((m, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: BRAND.textMuted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 26,
                fontWeight: 700,
                color: m.color,
                letterSpacing: "-0.02em",
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div
        style={{
          marginBottom: 20,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: BRAND.bgPrimary,
          padding: "10px 10px 4px",
        }}
      >
        <SparkLine
          data={trader.curve}
          width={336}
          height={72}
          revealProgress={sparkReveal}
          color={trader.curveColor}
          id={`t${index}`}
        />
      </div>

      {/* Capacity bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT.mono,
            fontSize: 11,
            color: BRAND.textMuted,
            marginBottom: 7,
          }}
        >
          <span>Allocation capacity</span>
          <span style={{ color: BRAND.textSecondary }}>{trader.capacity}</span>
        </div>
        <div style={{ height: 5, backgroundColor: BRAND.bgPrimary, borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${capBarW * 100}%`,
              backgroundColor: trader.tierColor,
              borderRadius: 3,
              opacity: 0.75,
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            color: BRAND.textMuted,
            marginTop: 5,
            textAlign: "right",
          }}
        >
          {Math.round(trader.filled * 100)}% filled
        </div>
      </div>
    </div>
  );
};

export const ProductScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const headlineOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const headlineY = interpolate(frame, [8, 28], [20, 0], { extrapolateRight: "clamp" });
  const subtitleOp = interpolate(frame, [20, 42], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ backgroundColor: BRAND.bgPrimary, opacity: bgOpacity, overflow: "hidden" }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 55% 45% at 50% 105%, rgba(0,255,178,0.045) 0%, transparent 55%),
            radial-gradient(ellipse 35% 35% at 8% 18%, rgba(167,139,250,0.03) 0%, transparent 55%)
          `,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "60px 110px 68px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 42 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: "0.2em",
              color: BRAND.signalPrimary,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: headlineOpacity,
            }}
          >
            The Marketplace
          </div>
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 54,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: 0,
              letterSpacing: "-0.02em",
              opacity: headlineOpacity,
              transform: `translateY(${headlineY}px)`,
            }}
          >
            Allocate to verified traders.
          </h2>
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 20,
              color: BRAND.textSecondary,
              margin: "14px 0 0 0",
              opacity: subtitleOp,
            }}
          >
            Browse on-chain track records. Choose your risk profile. Exit whenever you want.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", gap: 24, flex: 1 }}>
          {TRADERS.map((trader, i) => (
            <TraderCard
              key={i}
              trader={trader}
              startFrame={42 + i * 26}
              frame={frame}
              index={i}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 28,
            opacity: interpolate(frame, [140, 165], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 13, color: BRAND.textMuted, letterSpacing: "0.06em" }}>
            All metrics verified on-chain · Solana Devnet
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT.mono, fontSize: 13, color: BRAND.signalPrimary }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: BRAND.signalPrimary }} />
            Live
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
