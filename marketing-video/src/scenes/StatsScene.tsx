import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

interface StatCounterProps {
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  label: string;
  sublabel: string;
  startFrame: number;
  frame: number;
  color?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const StatCounter: React.FC<StatCounterProps> = ({
  value,
  prefix,
  suffix,
  decimals,
  label,
  sublabel,
  startFrame,
  frame,
  color = BRAND.signalPrimary,
}) => {
  const f = Math.max(0, frame - startFrame);
  const rawProgress = interpolate(f, [0, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = easeOutCubic(rawProgress);
  const current = value * progress;

  const opacity = interpolate(f, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(f, [0, 14], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const formatted =
    decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();

  // Subtle digit-flicker: when counting, add a faint shimmer every few frames
  const isActive = rawProgress > 0.02 && rawProgress < 0.98;
  const flicker = isActive ? 0.92 + 0.08 * Math.sin(f * 0.8) : 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {/* Big number */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 102,
          fontWeight: 700,
          color,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          opacity: flicker,
          textShadow: `0 0 60px ${color}40`,
          marginBottom: 12,
        }}
      >
        {prefix}
        {formatted}
        {suffix}
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: FONT.ui,
          fontSize: 20,
          fontWeight: 600,
          color: BRAND.textPrimary,
          letterSpacing: "-0.01em",
          marginBottom: 6,
          textAlign: "center",
        }}
      >
        {label}
      </div>

      {/* Sublabel */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 13,
          color: BRAND.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
};

const STATS = [
  {
    value: 12.4,
    prefix: "$",
    suffix: "M",
    decimals: 1,
    label: "Total Protected Capital",
    sublabel: "verified on-chain",
    startFrame: 22,
    color: BRAND.signalPrimary,
  },
  {
    value: 847,
    prefix: "",
    suffix: "",
    decimals: 0,
    label: "Verified Traders",
    sublabel: "with on-chain track records",
    startFrame: 48,
    color: "#A78BFA",
  },
  {
    value: 3.2,
    prefix: "",
    suffix: "x",
    decimals: 1,
    label: "Average Sharpe Ratio",
    sublabel: "across active vaults",
    startFrame: 74,
    color: "#60A5FA",
  },
];

const TICKER_LINES = [
  "First-loss capital: $12.4M · Verified traders: 847 · Avg Sharpe: 3.2x · Protocol TVL: $8.7M · Active vaults: 203 · Avg drawdown: -5.4% · Solana TPS: 65,234 · ",
];

export const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = TIMINGS.fps;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: "clamp" });

  const labelOpacity = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });

  // Ticker scroll speed: 280px/s → 280/fps px/frame
  const tickerOffset = (frame * 280) / fps;

  const dividerW = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgSecondary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* ── Atmospheric glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 75% 60% at 50% 50%, rgba(0,255,178,0.055) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 15% 80%, rgba(167,139,250,0.04) 0%, transparent 50%),
            radial-gradient(ellipse 40% 40% at 85% 20%, rgba(96,165,250,0.04) 0%, transparent 50%)
          `,
          opacity: glowOpacity,
        }}
      />

      {/* ── Grid ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,178,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "108px 108px",
          opacity: glowOpacity,
        }}
      />

      {/* ── Scrolling ticker at top ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          backgroundColor: `rgba(0,255,178,0.06)`,
          borderBottom: `1px solid rgba(0,255,178,0.12)`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          opacity: interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: BRAND.signalDeep,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            transform: `translateX(${-(tickerOffset % 2800)}px)`,
          }}
        >
          {TICKER_LINES[0].repeat(6)}
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          padding: "0 80px",
          paddingTop: 36,
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: "0.22em",
            color: BRAND.signalPrimary,
            textTransform: "uppercase",
            marginBottom: 16,
            opacity: labelOpacity,
          }}
        >
          Protocol metrics · Devnet
        </div>

        {/* Divider */}
        <div
          style={{
            width: `${dividerW * 240}px`,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${BRAND.signalDeep}, transparent)`,
            marginBottom: 72,
          }}
        />

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            width: "100%",
            maxWidth: 1600,
          }}
        >
          {STATS.map((stat, i) => (
            <React.Fragment key={i}>
              <StatCounter
                value={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                decimals={stat.decimals}
                label={stat.label}
                sublabel={stat.sublabel}
                startFrame={stat.startFrame}
                frame={frame}
                color={stat.color}
              />
              {/* Vertical dividers between stats */}
              {i < STATS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: `${33.33 * (i + 1)}%`,
                    top: "35%",
                    width: 1,
                    height: "30%",
                    background: `linear-gradient(180deg, transparent, rgba(0,255,178,0.15), transparent)`,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Bottom note */}
        <div
          style={{
            marginTop: 80,
            fontFamily: FONT.mono,
            fontSize: 13,
            color: BRAND.textMuted,
            letterSpacing: "0.08em",
            opacity: interpolate(frame, [100, 120], [0, 0.7], { extrapolateRight: "clamp" }),
            textAlign: "center",
          }}
        >
          All data on-chain · Solana · arcadia.finance
        </div>
      </div>

      {/* ── Bottom ticker ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 36,
          backgroundColor: `rgba(0,255,178,0.05)`,
          borderTop: `1px solid rgba(0,255,178,0.1)`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          opacity: interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: BRAND.signalDeep,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            // Scroll in opposite direction
            transform: `translateX(${-((-tickerOffset + 1400) % 2800)}px)`,
          }}
        >
          {TICKER_LINES[0].repeat(6)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
