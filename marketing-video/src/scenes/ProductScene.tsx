import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BRAND, FONT } from "../constants";

export const ProductScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Placeholder for product screenshot
  const screenshotOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const screenshotScale = interpolate(frame, [15, 35], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  // Text overlay appears
  const textOpacity = interpolate(frame, [40, 60], [0, 1], {
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
      {/* Product screenshot area - placeholder */}
      <div
        style={{
          width: 1200,
          height: 600,
          backgroundColor: BRAND.surface,
          borderRadius: 12,
          border: `1px solid ${BRAND.signalDeep}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: screenshotOpacity,
          transform: `scale(${screenshotScale})`,
          position: "relative",
        }}
      >
        {/* Placeholder: Traders marketplace visual */}
        <div
          style={{
            textAlign: "center",
            color: BRAND.textSecondary,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              marginBottom: 20,
              color: BRAND.signalPrimary,
            }}
          >
            Verified Traders
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
              padding: 40,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: BRAND.bgSecondary,
                  padding: 20,
                  borderRadius: 8,
                  border: `1px solid ${BRAND.signalDeep}`,
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 10 }}>
                  Trader {i}
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: BRAND.signalPrimary }}>
                  +{15 + i * 5}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Text overlays: two lines, staggered */}
      <div
        style={{
          marginTop: 40,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: FONT.display,
            fontSize: 36,
            color: BRAND.signalPrimary,
            margin: "0 0 12px 0",
            opacity: textOpacity,
          }}
        >
          Explore verified traders
        </p>
        <p
          style={{
            fontFamily: FONT.ui,
            fontSize: 24,
            color: BRAND.textSecondary,
            margin: 0,
            opacity: interpolate(frame, [50, 70], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Allocate to proven traders.
        </p>
      </div>
    </AbsoluteFill>
  );
};
