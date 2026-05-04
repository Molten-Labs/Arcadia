import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";
import { Shield, CheckCircle2, LogOut } from "lucide-react";

interface CardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay: number;
  frame: number;
}

const MechanicCard: React.FC<CardProps> = ({
  title,
  description,
  icon,
  delay,
  frame,
}) => {
  const frameOffset = frame - delay;

  // Card slides in from left
  const slideX = interpolate(frameOffset, [0, 20], [-200, 0], {
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frameOffset, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Signal green border animates in
  const borderWidth = interpolate(frameOffset, [10, 30], [0, 4], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: BRAND.surface,
        borderLeft: `${borderWidth}px solid ${BRAND.signalPrimary}`,
        padding: 32,
        borderRadius: 8,
        marginBottom: 24,
        opacity,
        transform: `translateX(${slideX}px)`,
        maxWidth: 600,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 20,
        }}
      >
        <div
          style={{
            color: BRAND.signalPrimary,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontFamily: FONT.ui,
              fontSize: 28,
              fontWeight: 600,
              color: BRAND.textPrimary,
              margin: "0 0 8px 0",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 16,
              color: BRAND.textSecondary,
              margin: 0,
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export const MechanicScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Fade in background
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Visual metaphor: capital alignment bars
  const traderBarScale = interpolate(frame, [40, 60], [0, 1], {
    extrapolateRight: "clamp",
  });
  const investorBarScale = interpolate(frame, [55, 75], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgSecondary,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: bgOpacity,
        padding: "0 60px",
      }}
    >
      {/* Primary headline: Traders commit capital first */}
      <h2
        style={{
          fontFamily: FONT.display,
          fontSize: 52,
          fontWeight: 700,
          color: BRAND.signalPrimary,
          margin: "0 0 60px 0",
          textAlign: "center",
          opacity: interpolate(frame, [10, 40], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Traders commit capital first.
      </h2>

      {/* Visual metaphor: capital alignment bars */}
      <div
        style={{
          width: 600,
          marginBottom: 60,
        }}
      >
        {/* Trader capital bar (first/green) */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              color: BRAND.textSecondary,
              marginBottom: 8,
            }}
          >
            Trader capital (absorbs losses first)
          </div>
          <div
            style={{
              height: 12,
              backgroundColor: BRAND.signalPrimary,
              borderRadius: 4,
              width: "40%",
              transform: `scaleX(${traderBarScale})`,
              transformOrigin: "left",
            }}
          />
        </div>

        {/* Investor capital bar (protected second) */}
        <div>
          <div
            style={{
              fontSize: 14,
              color: BRAND.textSecondary,
              marginBottom: 8,
            }}
          >
            Investor capital (protected)
          </div>
          <div
            style={{
              height: 12,
              backgroundColor: BRAND.signalDeep,
              borderRadius: 4,
              width: "60%",
              transform: `scaleX(${investorBarScale})`,
              transformOrigin: "left",
            }}
          />
        </div>
      </div>

      {/* Supporting cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <MechanicCard
          title="Performance is verifiable on-chain."
          description="Every trade, every position, transparent"
          icon={<CheckCircle2 size={32} />}
          delay={120}
          frame={frame}
        />
        <MechanicCard
          title="Investors retain full control."
          description="Withdraw anytime, no lock-in"
          icon={<LogOut size={32} />}
          delay={150}
          frame={frame}
        />
      </div>
    </AbsoluteFill>
  );
};
