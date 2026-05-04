import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Main tagline
  const mainOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const mainScale = spring({
    frame,
    fps: TIMINGS.fps,
    from: 0.95,
    to: 1,
    mass: 1,
    damping: 200,
  });

  // Supporting lines appear one by one
  const line1Opacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateRight: "clamp",
  });
  const line3Opacity = interpolate(frame, [70, 90], [0, 1], {
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
      }}
    >
      {/* Main tagline */}
      <h2
        style={{
          fontFamily: FONT.display,
          fontSize: 64,
          fontWeight: 700,
          color: BRAND.signalPrimary,
          margin: 0,
          marginBottom: 60,
          opacity: mainOpacity,
          transform: `scale(${mainScale})`,
        }}
      >
        Performance earns capital.
      </h2>

      {/* Supporting lines - each appears individually */}
      <div
        style={{
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: FONT.display,
            fontSize: 48,
            fontWeight: 600,
            color: BRAND.textPrimary,
            margin: "12px 0",
            opacity: line1Opacity,
          }}
        >
          Serious traders.
        </p>
        <p
          style={{
            fontFamily: FONT.display,
            fontSize: 48,
            fontWeight: 600,
            color: BRAND.textPrimary,
            margin: "12px 0",
            opacity: line2Opacity,
          }}
        >
          Protected investors.
        </p>
        <p
          style={{
            fontFamily: FONT.display,
            fontSize: 48,
            fontWeight: 600,
            color: BRAND.signalPrimary,
            margin: "12px 0",
            opacity: line3Opacity,
          }}
        >
          One protocol.
        </p>
      </div>
    </AbsoluteFill>
  );
};
