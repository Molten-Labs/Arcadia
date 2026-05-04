import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

const LINES = [
  { text: "Serious traders.", color: BRAND.textPrimary },
  { text: "Protected investors.", color: BRAND.textPrimary },
  { text: "One protocol.", color: BRAND.signalPrimary },
];

export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const mainScale = spring({
    frame,
    fps: TIMINGS.fps,
    from: 0.92,
    to: 1,
    config: { mass: 1, damping: 180 },
  });
  const mainOpacity = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });

  // Underline draws in after tagline
  const underlineW = interpolate(frame, [28, 52], [0, 1], { extrapolateRight: "clamp" });

  // Supporting lines appear one by one
  const lineStarts = [65, 85, 105];

  const glowOpacity = interpolate(frame, [30, 80], [0, 0.8], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* Centered glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,255,178,0.06) 0%, transparent 55%)
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
            linear-gradient(rgba(0,255,178,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px",
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
          padding: "0 160px",
          textAlign: "center",
        }}
      >
        {/* Main tagline */}
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 96,
            fontWeight: 700,
            color: BRAND.signalPrimary,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            opacity: mainOpacity,
            transform: `scale(${mainScale})`,
          }}
        >
          Performance
          <br />
          earns capital.
        </h1>

        {/* Animated underline */}
        <div
          style={{
            width: `${underlineW * 320}px`,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${BRAND.signalDeep}, transparent)`,
            borderRadius: 2,
            marginBottom: 72,
          }}
        />

        {/* Supporting lines */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {LINES.map((line, i) => {
            const start = lineStarts[i];
            const lineOpacity = interpolate(frame, [start, start + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const lineY = interpolate(frame, [start, start + 18], [18, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <p
                key={i}
                style={{
                  fontFamily: FONT.display,
                  fontSize: 52,
                  fontWeight: 600,
                  color: line.color,
                  margin: 0,
                  letterSpacing: "-0.02em",
                  opacity: lineOpacity,
                  transform: `translateY(${lineY}px)`,
                }}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      </div>

      {/* Corner accent */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 80,
          fontFamily: FONT.mono,
          fontSize: 13,
          color: BRAND.textMuted,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: interpolate(frame, [120, 140], [0, 0.6], { extrapolateRight: "clamp" }),
        }}
      >
        arcadia.finance
      </div>
    </AbsoluteFill>
  );
};
