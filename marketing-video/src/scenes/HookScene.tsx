import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Fade in background
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Main question animates in (typewriter effect simulation)
  const questionOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const questionScale = spring({
    frame: frame - 10,
    fps: TIMINGS.fps,
    from: 0.9,
    to: 1,
    mass: 1,
    damping: 200,
  });

  // Supporting text appears later
  const supportOpacity = interpolate(frame, [30, 50], [0, 1], {
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
        opacity: bgOpacity,
      }}
    >
      {/* Main question */}
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 72,
          fontWeight: 700,
          color: BRAND.textPrimary,
          margin: 0,
          marginBottom: 40,
          textAlign: "center",
          maxWidth: 1600,
          opacity: questionOpacity,
          transform: `scale(${questionScale})`,
        }}
      >
        Who earns the right to manage capital?
      </h1>

      {/* Supporting text */}
      <div
        style={{
          opacity: supportOpacity,
        }}
      >
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 40,
            color: BRAND.textSecondary,
            margin: "20px 0 0 0",
            textAlign: "center",
          }}
        >
          Most systems rely on trust.
        </p>
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 40,
            color: BRAND.signalPrimary,
            margin: "15px 0 0 0",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          Arcadia relies on performance.
        </p>
      </div>
    </AbsoluteFill>
  );
};
