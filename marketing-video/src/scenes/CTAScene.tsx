import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({
    frame,
    fps: TIMINGS.fps,
    from: 0.75,
    to: 1,
    config: { mass: 0.8, damping: 160 },
  });
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  const ctaOpacity = interpolate(frame, [14, 32], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [14, 32], [20, 0], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [28, 44], [0, 1], { extrapolateRight: "clamp" });

  const barW = interpolate(frame, [36, 58], [0, 1], { extrapolateRight: "clamp" });

  const glowOpacity = interpolate(frame, [10, 40], [0, 0.7], { extrapolateRight: "clamp" });

  const dotPulse = interpolate(
    Math.sin((frame / TIMINGS.fps) * Math.PI * 2),
    [-1, 1],
    [0.5, 1]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* Glow background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,255,178,0.07) 0%, transparent 55%)
          `,
          opacity: glowOpacity,
        }}
      />

      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,178,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
          opacity: glowOpacity,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 72,
            fontWeight: 700,
            color: BRAND.signalPrimary,
            letterSpacing: "-0.03em",
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: 8,
          }}
        >
          Arcadia
        </div>

        {/* Protocol label */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 14,
            letterSpacing: "0.22em",
            color: BRAND.textMuted,
            textTransform: "uppercase",
            marginBottom: 56,
            opacity: logoOpacity,
          }}
        >
          Protocol
        </div>

        {/* Main CTA */}
        <h2
          style={{
            fontFamily: FONT.display,
            fontSize: 52,
            fontWeight: 700,
            color: BRAND.textPrimary,
            margin: "0 0 16px 0",
            textAlign: "center",
            letterSpacing: "-0.02em",
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
          }}
        >
          Explore live traders
        </h2>

        {/* URL */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 22,
            color: BRAND.signalDeep,
            letterSpacing: "0.04em",
            marginBottom: 44,
            opacity: urlOpacity,
          }}
        >
          arcadia.finance
        </div>

        {/* Status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            backgroundColor: `${BRAND.signalPrimary}12`,
            border: `1px solid ${BRAND.signalPrimary}30`,
            borderRadius: 28,
            padding: "10px 24px",
            opacity: urlOpacity,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: BRAND.signalPrimary,
              opacity: dotPulse,
            }}
          />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              color: BRAND.signalPrimary,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Devnet Live
          </span>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barW * 100}%`,
            background: `linear-gradient(90deg, ${BRAND.signalDeep}, ${BRAND.signalPrimary})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
