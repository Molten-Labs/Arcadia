import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

const HEADLINE = "Who earns the right to manage capital?";
const WORDS = HEADLINE.split(" ");

const WordReveal: React.FC<{
  word: string;
  frame: number;
  startFrame: number;
}> = ({ word, frame, startFrame }) => {
  const f = frame - startFrame;
  const opacity = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 14], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${y}px)`,
        marginRight: "0.28em",
      }}
    >
      {word}
    </span>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const glowOpacity = interpolate(frame, [0, 30], [0, 0.6], { extrapolateRight: "clamp" });

  const line1Opacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(frame, [80, 100], [20, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [105, 125], [0, 1], { extrapolateRight: "clamp" });
  const line2Y = interpolate(frame, [105, 125], [20, 0], { extrapolateRight: "clamp" });

  const performancePulse = interpolate(
    Math.sin((frame / TIMINGS.fps) * Math.PI * 1.2),
    [-1, 1],
    [0.85, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        opacity: bgOpacity,
        overflow: "hidden",
      }}
    >
      {/* Atmospheric glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 70% at 15% 50%, rgba(0, 255, 178, 0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 85% 20%, rgba(22, 199, 132, 0.04) 0%, transparent 60%)
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
            linear-gradient(rgba(0, 255, 178, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 178, 0.025) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
          opacity: glowOpacity,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          padding: "0 160px",
          gap: 0,
        }}
      >
        {/* Eyebrow label */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 18,
            letterSpacing: "0.2em",
            color: BRAND.signalPrimary,
            textTransform: "uppercase",
            marginBottom: 48,
            opacity: interpolate(frame, [5, 20], [0, 0.8], { extrapolateRight: "clamp" }),
          }}
        >
          Arcadia Protocol
        </div>

        {/* Main headline — word by word */}
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 88,
            fontWeight: 700,
            color: BRAND.textPrimary,
            margin: 0,
            marginBottom: 72,
            textAlign: "center",
            maxWidth: 1500,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
          }}
        >
          {WORDS.map((word, i) => (
            <WordReveal
              key={i}
              word={word}
              frame={frame}
              startFrame={18 + i * 9}
            />
          ))}
        </h1>

        {/* Divider */}
        <div
          style={{
            width: interpolate(frame, [78, 95], [0, 120], { extrapolateRight: "clamp" }),
            height: 2,
            backgroundColor: BRAND.signalDeep,
            marginBottom: 48,
            borderRadius: 2,
          }}
        />

        {/* Line 1 */}
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 38,
            color: BRAND.textSecondary,
            margin: 0,
            marginBottom: 20,
            textAlign: "center",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          Most systems rely on trust.
        </p>

        {/* Line 2 — with green emphasis */}
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 38,
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
            }}
          >
            performance.
          </span>
        </p>
      </div>

      {/* Bottom signal bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${BRAND.signalPrimary}, transparent)`,
          opacity: interpolate(frame, [120, 145], [0, 0.6], { extrapolateRight: "clamp" }),
        }}
      />
    </AbsoluteFill>
  );
};
