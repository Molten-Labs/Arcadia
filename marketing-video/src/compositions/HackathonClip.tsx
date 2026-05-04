import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { BRAND, FONT, secondsToFrames } from "../constants";

export const HackathonClip: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        fontFamily: FONT.ui,
        overflow: "hidden",
      }}
    >
      {/* Opening: hook + narrative (0-15s) */}
      <Sequence from={0} durationInFrames={secondsToFrames(15)}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            padding: "0 80px",
          }}
        >
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: 72,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: "0 0 40px 0",
              textAlign: "center",
              opacity: interpolate(
                frame,
                [0, 30],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Who earns the right to manage capital?
          </h1>
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 40,
              color: BRAND.textSecondary,
              textAlign: "center",
              maxWidth: 1400,
              margin: 0,
              opacity: interpolate(
                frame,
                [30, 60],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Most systems rely on trust. Arcadia relies on performance backed by
            on-chain verification.
          </p>
        </div>
      </Sequence>

      {/* Core mechanics (15-40s) */}
      <Sequence from={secondsToFrames(15)} durationInFrames={secondsToFrames(25)}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: BRAND.bgSecondary,
            padding: "0 60px",
          }}
        >
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 56,
              fontWeight: 700,
              color: BRAND.signalPrimary,
              margin: "0 0 50px 0",
              textAlign: "center",
              opacity: interpolate(
                frame - secondsToFrames(15),
                [0, 20],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            The Protocol
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 40,
              maxWidth: 1600,
            }}
          >
            {[
              { num: 1, title: "Traders commit capital first", desc: "30-day on-chain verification" },
              { num: 2, title: "Performance is verifiable on-chain", desc: "Every trade, every position" },
              { num: 3, title: "Investors retain full control", desc: "Withdraw anytime, no lock-in" },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: BRAND.surface,
                  padding: 32,
                  borderRadius: 8,
                  borderLeft: `4px solid ${BRAND.signalPrimary}`,
                  opacity: interpolate(
                    frame - secondsToFrames(15),
                    [20 + i * 15, 40 + i * 15],
                    [0, 1],
                    { extrapolateRight: "clamp" }
                  ),
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color: BRAND.signalPrimary,
                    marginBottom: 12,
                  }}
                >
                  {item.num}
                </div>
                <h3
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 24,
                    fontWeight: 600,
                    color: BRAND.textPrimary,
                    margin: "0 0 8px 0",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 14,
                    color: BRAND.textSecondary,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Sequence>

      {/* Product showcase (40-65s) */}
      <Sequence from={secondsToFrames(40)} durationInFrames={secondsToFrames(25)}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: BRAND.bgPrimary,
            padding: "0 60px",
          }}
        >
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 52,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: "0 0 40px 0",
              opacity: interpolate(
                frame - secondsToFrames(40),
                [0, 20],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Built on Solana
          </h2>
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 28,
              color: BRAND.textSecondary,
              textAlign: "center",
              maxWidth: 1200,
              margin: 0,
              opacity: interpolate(
                frame - secondsToFrames(40),
                [20, 45],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Every metric is verifiable. Every trader has accountability. Every
            investor has exit rights. Non-custodial. Transparent. Fair.
          </p>
        </div>
      </Sequence>

      {/* Closing statement (65-85s) */}
      <Sequence from={secondsToFrames(65)} durationInFrames={secondsToFrames(20)}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: BRAND.bgSecondary,
          }}
        >
          <h2
            style={{
              fontFamily: FONT.display,
              fontSize: 64,
              fontWeight: 700,
              color: BRAND.signalPrimary,
              margin: 0,
              textAlign: "center",
              opacity: interpolate(
                frame - secondsToFrames(65),
                [0, 20],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Performance earns capital.
          </h2>
        </div>
      </Sequence>

      {/* Final CTA (85-90s) */}
      <Sequence from={secondsToFrames(85)} durationInFrames={secondsToFrames(5)}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: BRAND.bgPrimary,
          }}
        >
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: 56,
              fontWeight: 700,
              color: BRAND.textPrimary,
              margin: "0 0 20px 0",
              opacity: interpolate(
                frame - secondsToFrames(85),
                [0, 15],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            See it in action
          </h1>
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 32,
              color: BRAND.signalPrimary,
              margin: 0,
              opacity: interpolate(
                frame - secondsToFrames(85),
                [0, 15],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
            }}
          >
            Devnet Live
          </p>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
