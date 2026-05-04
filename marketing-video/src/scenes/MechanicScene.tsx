import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

interface MechanicCardProps {
  icon: string;
  title: string;
  desc: string;
  startFrame: number;
  frame: number;
}

const MechanicCard: React.FC<MechanicCardProps> = ({ icon, title, desc, startFrame, frame }) => {
  const f = frame - startFrame;
  const opacity = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(f, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const borderOpacity = interpolate(f, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
        backgroundColor: BRAND.surface,
        padding: "28px 36px",
        borderRadius: 10,
        borderLeft: `3px solid rgba(0,255,178,${borderOpacity})`,
        opacity,
        transform: `translateX(${x}px)`,
        width: 680,
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1, paddingTop: 2 }}>{icon}</div>
      <div>
        <div
          style={{
            fontFamily: FONT.ui,
            fontSize: 22,
            fontWeight: 600,
            color: BRAND.textPrimary,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT.ui,
            fontSize: 16,
            color: BRAND.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
};

export const MechanicScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  // Headline
  const headlineOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const headlineY = interpolate(frame, [8, 28], [20, 0], { extrapolateRight: "clamp" });

  // Capital stack bars
  const traderBarW = interpolate(frame, [45, 80], [0, 1], { extrapolateRight: "clamp" });
  const investorBarW = interpolate(frame, [70, 110], [0, 1], { extrapolateRight: "clamp" });

  // Loss arrow
  const arrowOpacity = interpolate(frame, [90, 108], [0, 1], { extrapolateRight: "clamp" });

  // Label opacities
  const traderLabelOpacity = interpolate(frame, [78, 95], [0, 1], { extrapolateRight: "clamp" });
  const investorLabelOpacity = interpolate(frame, [108, 125], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgSecondary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* Atmospheric glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 70% at 80% 60%, rgba(0,255,178,0.05) 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          height: "100%",
          alignItems: "center",
          padding: "0 120px",
          gap: 100,
        }}
      >
        {/* LEFT: headline + capital stack diagram */}
        <div style={{ flex: "0 0 700px", display: "flex", flexDirection: "column" }}>
          {/* Section label */}
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              letterSpacing: "0.18em",
              color: BRAND.signalPrimary,
              textTransform: "uppercase",
              marginBottom: 24,
              opacity: headlineOpacity,
            }}
          >
            Core mechanic
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 64,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: "0 0 16px 0",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              opacity: headlineOpacity,
              transform: `translateY(${headlineY}px)`,
            }}
          >
            Skin in
            <br />
            the game.
          </h2>

          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 22,
              color: BRAND.textSecondary,
              margin: "0 0 60px 0",
              lineHeight: 1.6,
              opacity: headlineOpacity,
              maxWidth: 560,
            }}
          >
            Traders lock first-loss capital before managing a single dollar
            of investor funds.
          </p>

          {/* Capital Stack Diagram */}
          <div style={{ width: 560 }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 13,
                color: BRAND.textMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 20,
                opacity: interpolate(frame, [38, 50], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Capital structure
            </div>

            {/* Investor bar */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  height: 48,
                  backgroundColor: BRAND.bgPrimary,
                  borderRadius: 6,
                  border: `1px solid rgba(245,247,250,0.08)`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${investorBarW * 100}%`,
                    background: `linear-gradient(90deg, rgba(176,176,176,0.3), rgba(245,247,250,0.15))`,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 13,
                      color: BRAND.textSecondary,
                      opacity: investorLabelOpacity,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Investor Capital — protected
                  </span>
                </div>
              </div>
            </div>

            {/* Trader bar */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  height: 48,
                  backgroundColor: BRAND.bgPrimary,
                  borderRadius: 6,
                  border: `1px solid rgba(0,255,178,0.12)`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${traderBarW * 38}%`,
                    background: `linear-gradient(90deg, rgba(0,255,178,0.35), rgba(0,255,178,0.15))`,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 13,
                      color: BRAND.signalPrimary,
                      opacity: traderLabelOpacity,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Trader Capital — first loss ↑
                  </span>
                </div>
              </div>

              {/* Loss absorbed label */}
              <div
                style={{
                  position: "absolute",
                  right: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: arrowOpacity,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 1,
                    backgroundColor: BRAND.signalDeep,
                  }}
                />
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color: BRAND.signalDeep,
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}
                >
                  absorbs losses first
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: mechanic cards */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            paddingTop: 40,
          }}
        >
          <MechanicCard
            icon="🔒"
            title="Traders commit capital first"
            desc="30-day on-chain verification period. No shortcuts."
            startFrame={130}
            frame={frame}
          />
          <MechanicCard
            icon="⛓️"
            title="Performance verified on-chain"
            desc="Every trade, every position — fully transparent on Solana."
            startFrame={158}
            frame={frame}
          />
          <MechanicCard
            icon="🚪"
            title="Investors retain full control"
            desc="Non-custodial. Withdraw anytime. No lock-ins, no gatekeeping."
            startFrame={186}
            frame={frame}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
