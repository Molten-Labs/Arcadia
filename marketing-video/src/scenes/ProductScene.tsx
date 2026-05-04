import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BRAND, FONT } from "../constants";

const TRADERS = [
  {
    addr: "0x7f3…a4B2",
    tier: "Elite",
    apr: "+41.8%",
    drawdown: "-3.2%",
    sharpe: "3.1",
    filled: 0.91,
    capacity: "$2.4M",
    color: BRAND.signalPrimary,
  },
  {
    addr: "0xC9d…88fE",
    tier: "Veteran",
    apr: "+28.5%",
    drawdown: "-6.1%",
    sharpe: "2.4",
    filled: 0.64,
    capacity: "$800K",
    color: "#A78BFA",
  },
  {
    addr: "0x4a1…3c71",
    tier: "Established",
    apr: "+19.2%",
    drawdown: "-8.4%",
    sharpe: "1.8",
    filled: 0.38,
    capacity: "$300K",
    color: "#60A5FA",
  },
];

const TIER_COLORS: Record<string, string> = {
  Elite: BRAND.signalPrimary,
  Veteran: "#A78BFA",
  Established: "#60A5FA",
};

interface TraderCardProps {
  trader: (typeof TRADERS)[0];
  startFrame: number;
  frame: number;
}

const TraderCard: React.FC<TraderCardProps> = ({ trader, startFrame, frame }) => {
  const f = frame - startFrame;
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(f, [0, 20], [32, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barW = interpolate(f, [20, 50], [0, trader.filled], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tierColor = TIER_COLORS[trader.tier] ?? BRAND.signalPrimary;

  return (
    <div
      style={{
        backgroundColor: BRAND.surface,
        borderRadius: 12,
        border: `1px solid rgba(255,255,255,0.06)`,
        borderTop: `2px solid ${tierColor}`,
        padding: "28px 32px",
        opacity,
        transform: `translateY(${y}px)`,
        flex: 1,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 15,
            color: BRAND.textSecondary,
          }}
        >
          {trader.addr}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: tierColor,
            backgroundColor: `${tierColor}18`,
            border: `1px solid ${tierColor}40`,
            padding: "4px 12px",
            borderRadius: 20,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {trader.tier}
        </div>
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: BRAND.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            90d APR
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.signalPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {trader.apr}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: BRAND.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Max DD
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.danger,
              letterSpacing: "-0.02em",
            }}
          >
            {trader.drawdown}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: BRAND.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Sharpe
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {trader.sharpe}
          </div>
        </div>
      </div>

      {/* Capacity bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT.mono,
            fontSize: 12,
            color: BRAND.textMuted,
            marginBottom: 8,
          }}
        >
          <span>Allocation capacity</span>
          <span style={{ color: BRAND.textSecondary }}>{trader.capacity}</span>
        </div>
        <div
          style={{
            height: 6,
            backgroundColor: BRAND.bgPrimary,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${barW * 100}%`,
              backgroundColor: tierColor,
              borderRadius: 3,
              opacity: 0.8,
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: BRAND.textMuted,
            marginTop: 6,
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

  const subtitleOpacity = interpolate(frame, [22, 42], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,255,178,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 10% 20%, rgba(167,139,250,0.03) 0%, transparent 60%)
          `,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "72px 120px 80px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 52 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              letterSpacing: "0.18em",
              color: BRAND.signalPrimary,
              textTransform: "uppercase",
              marginBottom: 16,
              opacity: headlineOpacity,
            }}
          >
            The Marketplace
          </div>
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 56,
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
              fontSize: 22,
              color: BRAND.textSecondary,
              margin: "16px 0 0 0",
              opacity: subtitleOpacity,
            }}
          >
            Browse on-chain track records. Choose your risk profile. Exit whenever you want.
          </p>
        </div>

        {/* Trader cards */}
        <div
          style={{
            display: "flex",
            gap: 28,
            flex: 1,
          }}
        >
          {TRADERS.map((trader, i) => (
            <TraderCard
              key={i}
              trader={trader}
              startFrame={50 + i * 28}
              frame={frame}
            />
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 36,
            opacity: interpolate(frame, [130, 155], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              color: BRAND.textMuted,
              letterSpacing: "0.06em",
            }}
          >
            All metrics verified on-chain · Solana Devnet
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FONT.mono,
              fontSize: 14,
              color: BRAND.signalPrimary,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: BRAND.signalPrimary,
              }}
            />
            Live
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
