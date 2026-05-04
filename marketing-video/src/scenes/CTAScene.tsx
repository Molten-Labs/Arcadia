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

  // Main message appears
  const messageOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Status appears last
  const statusOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Accent bar slides up at end
  const barHeight = interpolate(frame, [40, 60], [0, 6], {
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
        gap: 0,
      }}
    >
      {/* Logo at top - brand stamp */}
      <div
        style={{
          position: "absolute",
          top: 120,
          fontSize: 48,
          fontWeight: 700,
          color: BRAND.signalPrimary,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          fontFamily: FONT.display,
        }}
      >
        Arcadia
      </div>

      {/* Main message in center */}
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 56,
          fontWeight: 700,
          color: BRAND.textPrimary,
          margin: 0,
          textAlign: "center",
          opacity: messageOpacity,
        }}
      >
        Explore live traders
      </h1>

      {/* Status at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          textAlign: "center",
          opacity: statusOpacity,
        }}
      >
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 28,
            color: BRAND.signalPrimary,
            margin: 0,
            fontWeight: 600,
          }}
        >
          Devnet Live
        </p>
      </div>

      {/* Accent bar slides up from bottom */}
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
