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
  const fps = TIMINGS.fps;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  // ── Scan line sweeps top → bottom (frames 0-40) ──
  const scanY = interpolate(frame, [0, 38], [-40, 1160], {
    extrapolateRight: "clamp",
  });
  const scanOpacity = interpolate(frame, [0, 8, 34, 40], [0, 0.9, 0.9, 0], {
    extrapolateRight: "clamp",
  });

  // Content appears AFTER the scan line has passed each element
  // Main tagline unlocks at frame 20 (scan has passed midpoint)
  const mainScale = spring({
    frame: Math.max(0, frame - 18),
    fps,
    from: 0.9,
    to: 1,
    config: { mass: 1, damping: 180 },
  });
  const mainOpacity = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });

  // Underline draws in
  const underlineW = interpolate(frame, [42, 68], [0, 1], { extrapolateRight: "clamp" });

  // Supporting lines stagger in
  const lineStarts = [72, 92, 112];

  // Particle scatter (post-scan residue)
  const particleOpacity = interpolate(frame, [38, 60], [0, 0.6], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [30, 70], [0, 1], { extrapolateRight: "clamp" });

  // Pulsing glow on tagline
  const taglinePulse = 1 + 0.06 * Math.sin((frame / fps) * Math.PI * 1.1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* ── Centered glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 85% 65% at 50% 50%, rgba(0,255,178,0.065) 0%, transparent 55%)
          `,
          opacity: glowOpacity,
        }}
      />

      {/* ── Grid overlay ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,178,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "110px 110px",
          opacity: glowOpacity,
        }}
      />

      {/* ── Particle scatter (residue after scan) ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 1920 1080"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: 20 }, (_, i) => {
          const cx = (i * 1618.034) % 1920;
          const cy = (i * 987.654) % 1080;
          const op = particleOpacity * (0.06 + (i % 4) * 0.04);
          return (
            <circle
              key={i}
              cx={cx + Math.sin((frame / fps) * (0.2 + i * 0.05) + i) * 14}
              cy={cy + Math.cos((frame / fps) * (0.15 + i * 0.04) + i) * 10}
              r={1 + (i % 3)}
              fill={BRAND.signalPrimary}
              opacity={op}
            />
          );
        })}
      </svg>

      {/* ── Scan line ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY,
          height: 3,
          background: `linear-gradient(90deg, transparent 0%, ${BRAND.signalPrimary} 15%, ${BRAND.signalPrimary} 85%, transparent 100%)`,
          boxShadow: `0 0 32px 8px rgba(0,255,178,0.55), 0 0 80px 20px rgba(0,255,178,0.2)`,
          opacity: scanOpacity,
        }}
      />
      {/* Scan afterglow trail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY - 60,
          height: 60,
          background: `linear-gradient(180deg, transparent 0%, rgba(0,255,178,0.06) 100%)`,
          opacity: scanOpacity * 0.7,
        }}
      />

      {/* ── Main content ── */}
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
            fontSize: 100,
            fontWeight: 700,
            color: BRAND.signalPrimary,
            margin: 0,
            marginBottom: 14,
            letterSpacing: "-0.035em",
            lineHeight: 1.02,
            opacity: mainOpacity,
            transform: `scale(${mainScale * taglinePulse})`,
            textShadow: `0 0 80px rgba(0,255,178,0.3)`,
          }}
        >
          Performance
          <br />
          earns capital.
        </h1>

        {/* Animated underline */}
        <div
          style={{
            width: `${underlineW * 340}px`,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${BRAND.signalDeep}, transparent)`,
            borderRadius: 2,
            marginBottom: 68,
          }}
        />

        {/* Supporting lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {LINES.map((line, i) => {
            const start = lineStarts[i];
            const lineOpacity = interpolate(frame, [start, start + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const lineY = interpolate(frame, [start, start + 18], [20, 0], {
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
                  textShadow: line.color === BRAND.signalPrimary
                    ? `0 0 40px rgba(0,255,178,0.3)`
                    : "none",
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
          bottom: 56,
          right: 80,
          fontFamily: FONT.mono,
          fontSize: 13,
          color: BRAND.textMuted,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: interpolate(frame, [130, 150], [0, 0.55], { extrapolateRight: "clamp" }),
        }}
      >
        arcadia.finance
      </div>
    </AbsoluteFill>
  );
};
