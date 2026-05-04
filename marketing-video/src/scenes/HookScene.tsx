import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

const HEADLINE = "Who earns the right to manage capital?";
const WORDS = HEADLINE.split(" ");

// Deterministic particle field (golden-ratio spread)
const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  cx: (i * 1618.034) % 1920,
  cy: (i * 987.654) % 1080,
  r: 1.2 + (i % 4) * 1.0,
  speedX: 0.18 + (i % 5) * 0.07,
  speedY: 0.12 + (i % 4) * 0.05,
  phase: i * 0.937,
  opacity: 0.07 + (i % 3) * 0.055,
}));

// Horizontal scan lines (adds CRT/data feel)
const SCAN_LINES = Array.from({ length: 6 }, (_, i) => ({
  y: 150 + i * 140,
  delay: 20 + i * 10,
  speed: 0.8 + i * 0.15,
  phase: i * 1.04,
}));

const WordReveal: React.FC<{
  word: string;
  frame: number;
  startFrame: number;
  isLast?: boolean;
}> = ({ word, frame, startFrame, isLast }) => {
  const f = Math.max(0, frame - startFrame);
  const opacity = interpolate(f, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(f, [0, 14], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${y}px)`,
        marginRight: isLast ? 0 : "0.26em",
        color: isLast ? BRAND.signalPrimary : BRAND.textPrimary,
      }}
    >
      {word}
    </span>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = TIMINGS.fps;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });

  const line1Opacity = interpolate(frame, [88, 108], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(frame, [88, 108], [22, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [112, 132], [0, 1], { extrapolateRight: "clamp" });
  const line2Y = interpolate(frame, [112, 132], [22, 0], { extrapolateRight: "clamp" });

  const dividerW = interpolate(frame, [82, 100], [0, 140], { extrapolateRight: "clamp" });

  // Pulsing glow on the signal word "performance"
  const performancePulse = 0.85 + 0.15 * Math.sin((frame / fps) * Math.PI * 1.4);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
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
            radial-gradient(ellipse 65% 65% at 12% 55%, rgba(0,255,178,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 55% at 88% 15%, rgba(22,199,132,0.05) 0%, transparent 60%),
            radial-gradient(ellipse 80% 40% at 50% 100%, rgba(0,255,178,0.03) 0%, transparent 50%)
          `,
          opacity: glowOpacity,
        }}
      />

      {/* ── Subtle grid ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,178,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.022) 1px, transparent 1px)
          `,
          backgroundSize: "96px 96px",
          opacity: glowOpacity,
        }}
      />

      {/* ── Floating particles (SVG) ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 1920 1080"
        xmlns="http://www.w3.org/2000/svg"
      >
        {PARTICLES.map((p, i) => {
          const x = p.cx + Math.sin((frame / fps) * p.speedX + p.phase) * 18;
          const y = p.cy + Math.cos((frame / fps) * p.speedY + p.phase) * 12;
          const pulse = p.opacity + 0.04 * Math.sin((frame / fps) * 1.3 + p.phase);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={p.r}
              fill={BRAND.signalPrimary}
              opacity={pulse * glowOpacity}
            />
          );
        })}

        {/* Horizontal scan flashes */}
        {SCAN_LINES.map((sl, i) => {
          const scanOpacity =
            0.018 *
            Math.max(0, Math.sin((frame / fps) * sl.speed * Math.PI + sl.phase) * 0 + 1) *
            glowOpacity;
          return (
            <line
              key={i}
              x1="0"
              y1={sl.y}
              x2="1920"
              y2={sl.y}
              stroke={BRAND.signalPrimary}
              strokeWidth="0.5"
              opacity={scanOpacity}
            />
          );
        })}
      </svg>

      {/* ── Content ── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          padding: "0 180px",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 16,
            letterSpacing: "0.22em",
            color: BRAND.signalPrimary,
            textTransform: "uppercase",
            marginBottom: 44,
            opacity: interpolate(frame, [4, 18], [0, 0.85], { extrapolateRight: "clamp" }),
          }}
        >
          Arcadia Protocol · First-Loss Managed Vaults
        </div>

        {/* Headline — word by word */}
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 86,
            fontWeight: 700,
            color: BRAND.textPrimary,
            margin: 0,
            marginBottom: 64,
            textAlign: "center",
            maxWidth: 1480,
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
          }}
        >
          {WORDS.map((word, i) => (
            <WordReveal
              key={i}
              word={word}
              frame={frame}
              startFrame={20 + i * 9}
              isLast={i === WORDS.length - 1}
            />
          ))}
        </h1>

        {/* Divider */}
        <div
          style={{
            width: dividerW,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${BRAND.signalDeep}, transparent)`,
            marginBottom: 44,
            borderRadius: 2,
          }}
        />

        {/* Line 1 */}
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 36,
            color: BRAND.textSecondary,
            margin: "0 0 18px 0",
            textAlign: "center",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          Most systems rely on trust.
        </p>

        {/* Line 2 */}
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 36,
            color: BRAND.textPrimary,
            margin: 0,
            textAlign: "center",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
          }}
        >
          Arcadia relies on{" "}
          <span
            style={{
              color: BRAND.signalPrimary,
              opacity: performancePulse,
              textShadow: `0 0 40px rgba(0,255,178,0.4)`,
            }}
          >
            performance.
          </span>
        </p>
      </div>

      {/* Bottom signal strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent 0%, ${BRAND.signalPrimary} 30%, ${BRAND.signalPrimary} 70%, transparent 100%)`,
          opacity: interpolate(frame, [130, 150], [0, 0.5], { extrapolateRight: "clamp" }),
        }}
      />
    </AbsoluteFill>
  );
};
