import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Logo/brand animates in
  const logoScale = spring({
    frame,
    fps: TIMINGS.fps,
    from: 0.8,
    to: 1,
    mass: 1,
    damping: 200,
  });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // CTA text
  const ctaOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Accent bar slides up
  const barHeight = interpolate(frame, [25, 45], [0, 6], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    >
      {/* Shield logo - ASCII representation, or use actual SVG */}
      <div
        style={{
          fontSize: 120,
          fontWeight: 700,
          color: BRAND.signalPrimary,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: 40,
        }}
      >
        ◆
      </div>

      {/* Main CTA */}
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 56,
          fontWeight: 700,
          color: BRAND.textPrimary,
          margin: "0 0 12px 0",
          textAlign: "center",
          opacity: ctaOpacity,
        }}
      >
        Explore live traders
      </h1>

      {/* Sub CTA */}
      <p
        style={{
          fontFamily: FONT.ui,
          fontSize: 28,
          color: BRAND.signalPrimary,
          margin: "8px 0 0 0",
          opacity: ctaOpacity,
        }}
      >
        Devnet Live
      </p>

      {/* Accent bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${barHeight}px`,
          backgroundColor: BRAND.signalPrimary,
        }}
      />
    </AbsoluteFill>
  );
};
