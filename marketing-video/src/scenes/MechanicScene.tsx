import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

interface MechanicCardProps {
  icon: string;
  title: string;
  desc: string;
  startFrame: number;
  frame: number;
}

const MechanicCard: React.FC<MechanicCardProps> = ({ icon, title, desc, startFrame, frame }) => {
  const f = Math.max(0, frame - startFrame);
  const opacity = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(f, [0, 18], [50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const borderOpacity = interpolate(f, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 22,
        backgroundColor: BRAND.surface,
        padding: "26px 32px",
        borderRadius: 10,
        borderLeft: `3px solid rgba(0,255,178,${borderOpacity})`,
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, paddingTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: FONT.ui, fontSize: 20, fontWeight: 600, color: BRAND.textPrimary, marginBottom: 5, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT.ui, fontSize: 15, color: BRAND.textSecondary, lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>
    </div>
  );
};

export const MechanicScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = TIMINGS.fps;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const headlineOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const headlineY = interpolate(frame, [8, 28], [20, 0], { extrapolateRight: "clamp" });

  // Capital bars build up
  const investorBarW = interpolate(frame, [45, 90], [0, 1], { extrapolateRight: "clamp" });
  const traderBarW = interpolate(frame, [60, 100], [0, 1], { extrapolateRight: "clamp" });

  // Label fades
  const investorLabelOp = interpolate(frame, [88, 108], [0, 1], { extrapolateRight: "clamp" });
  const traderLabelOp = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });

  // ── Loss absorption animation ──
  // Phase 1: Loss indicator appears (frame 145–165)
  const lossAppearOp = interpolate(frame, [145, 165], [0, 1], { extrapolateRight: "clamp" });
  // Phase 2: Loss bar slides in from right and hits the trader bar (165–200)
  const lossSlide = interpolate(frame, [165, 200], [0, 1], { extrapolateRight: "clamp" });
  // Phase 3: Trader bar flashes red and "absorbs" — shrinks slightly (200–230)
  const absorbProgress = interpolate(frame, [200, 230], [0, 1], { extrapolateRight: "clamp" });
  // Phase 4: "Investor protected ✓" appears (230–250)
  const protectedOp = interpolate(frame, [230, 250], [0, 1], { extrapolateRight: "clamp" });

  // Trader bar width shrinks during absorption
  const traderBarCurrentW = traderBarW * 38 * (1 - absorbProgress * 0.32);

  // Loss indicator red flash on trader bar
  const lossFlash = Math.max(0, Math.sin((frame / fps) * Math.PI * 8)) * absorbProgress * 0.4;

  const INVESTOR_BAR_W = 62; // % of container
  const TRADER_BAR_W_FULL = 38; // % of container

  return (
    <AbsoluteFill
      style={{ backgroundColor: BRAND.bgSecondary, opacity: bgOpacity, overflow: "hidden" }}
    >
      {/* Atmospheric glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 65% at 80% 55%, rgba(0,255,178,0.05) 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          height: "100%",
          alignItems: "center",
          padding: "0 110px",
          gap: 90,
        }}
      >
        {/* ── LEFT: headline + capital stack ── */}
        <div style={{ flex: "0 0 720px", display: "flex", flexDirection: "column" }}>
          {/* Section label */}
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: "0.2em",
              color: BRAND.signalPrimary,
              textTransform: "uppercase",
              marginBottom: 20,
              opacity: headlineOpacity,
            }}
          >
            Core mechanic
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 66,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: "0 0 14px 0",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
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
              fontSize: 20,
              color: BRAND.textSecondary,
              margin: "0 0 52px 0",
              lineHeight: 1.65,
              opacity: headlineOpacity,
              maxWidth: 560,
            }}
          >
            Traders lock first-loss capital before managing a single dollar
            of investor funds.
          </p>

          {/* ── Capital Stack Diagram ── */}
          <div style={{ width: 580 }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                color: BRAND.textMuted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 18,
                opacity: interpolate(frame, [38, 52], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              Capital structure
            </div>

            {/* Investor bar */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 52,
                  backgroundColor: BRAND.bgPrimary,
                  borderRadius: 7,
                  border: `1px solid rgba(245,247,250,0.07)`,
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
                    width: `${investorBarW * INVESTOR_BAR_W}%`,
                    background: `linear-gradient(90deg, rgba(176,176,176,0.28), rgba(245,247,250,0.14))`,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 18,
                    transition: "width 0.1s",
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 13,
                      color: BRAND.textSecondary,
                      opacity: investorLabelOp,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Investor Capital · protected
                  </span>
                </div>
              </div>
            </div>

            {/* Trader bar (first loss) */}
            <div style={{ position: "relative", marginBottom: 32 }}>
              <div
                style={{
                  height: 52,
                  backgroundColor: BRAND.bgPrimary,
                  borderRadius: 7,
                  border: `1px solid rgba(0,255,178,${0.1 + lossFlash * 0.4})`,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: lossFlash > 0.05
                    ? `0 0 ${20 * lossFlash}px rgba(255,77,109,${lossFlash * 0.5})`
                    : "none",
                }}
              >
                {/* Trader capital fill */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${traderBarCurrentW}%`,
                    background: `linear-gradient(90deg, rgba(0,255,178,${0.35 + lossFlash * 0.2}), rgba(0,255,178,${0.18 + lossFlash * 0.1}))`,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 18,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 13,
                      color: BRAND.signalPrimary,
                      opacity: traderLabelOp,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Trader Capital · first loss ↑
                  </span>
                </div>

                {/* Loss absorption overlay — red fill from right */}
                {absorbProgress > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      right: `${100 - TRADER_BAR_W_FULL}%`,
                      top: 0,
                      bottom: 0,
                      width: `${absorbProgress * TRADER_BAR_W_FULL * 0.32}%`,
                      background: `rgba(255,77,109,${0.4 * absorbProgress})`,
                      borderRadius: "0 7px 7px 0",
                    }}
                  />
                )}
              </div>

              {/* Loss event indicator */}
              {lossAppearOp > 0.01 && (
                <div
                  style={{
                    position: "absolute",
                    right: -8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: lossAppearOp,
                  }}
                >
                  <div style={{ width: 28, height: 1, backgroundColor: BRAND.danger }} />
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      color: BRAND.danger,
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                      textShadow: `0 0 12px rgba(255,77,109,0.6)`,
                    }}
                  >
                    {absorbProgress > 0.5
                      ? "✓ absorbed by trader"
                      : "loss event: -8.2%"}
                  </div>
                </div>
              )}
            </div>

            {/* "Investor capital protected" badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: protectedOp,
                transform: `translateY(${interpolate(frame, [230, 250], [10, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${BRAND.signalPrimary}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: BRAND.signalPrimary,
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontFamily: FONT.ui,
                  fontSize: 16,
                  color: BRAND.signalPrimary,
                  fontWeight: 600,
                  textShadow: `0 0 24px rgba(0,255,178,0.35)`,
                }}
              >
                Investor capital intact — loss absorbed by trader
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: mechanic cards ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            paddingTop: 30,
          }}
        >
          <MechanicCard
            icon="🔒"
            title="Traders commit capital first"
            desc="30-day on-chain verification period. No shortcuts, no exceptions."
            startFrame={118}
            frame={frame}
          />
          <MechanicCard
            icon="⛓️"
            title="Performance verified on-chain"
            desc="Every trade, every position — fully transparent on Solana."
            startFrame={144}
            frame={frame}
          />
          <MechanicCard
            icon="🚪"
            title="Investors retain full control"
            desc="Non-custodial. Withdraw anytime. No lock-ins, no gatekeeping."
            startFrame={170}
            frame={frame}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
