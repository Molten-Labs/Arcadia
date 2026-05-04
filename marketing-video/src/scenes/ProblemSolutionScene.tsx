import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { BRAND, FONT, TIMINGS } from "../constants";

const PROBLEMS = [
  {
    for: "For Traders",
    icon: "⚠",
    points: [
      "Reputation built on screenshots & social media",
      "No reliable way to prove performance on-chain",
      "Impossible to scale capital without institutional trust",
    ],
  },
  {
    for: "For Investors",
    icon: "⚠",
    points: [
      "Capital allocation built on guesswork",
      "No transparency into risk management",
      "Capital often locked — no guaranteed exit",
    ],
  },
];

const SOLUTIONS = [
  {
    for: "For Traders",
    icon: "✓",
    points: [
      "Verified on-chain track record — permanent & unfakeable",
      "Earn the right to manage capital through results",
      "Scale from Paper to Elite tier based on performance",
    ],
  },
  {
    for: "For Investors",
    icon: "✓",
    points: [
      "Allocate to proven traders with full transparency",
      "Risk structured — trader capital absorbs losses first",
      "Non-custodial, exit anytime — you stay in control",
    ],
  },
];

interface InfoCardProps {
  data: (typeof PROBLEMS)[0];
  startFrame: number;
  frame: number;
  side: "problem" | "solution";
}

const InfoCard: React.FC<InfoCardProps> = ({ data, startFrame, frame, side }) => {
  const f = Math.max(0, frame - startFrame);
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(f, [0, 20], [side === "problem" ? -48 : 48, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accent = side === "problem" ? BRAND.danger : BRAND.signalPrimary;
  const checkChar = side === "problem" ? "✗" : "✓";

  return (
    <div
      style={{
        backgroundColor: BRAND.surface,
        borderRadius: 10,
        border: `1px solid rgba(255,255,255,0.055)`,
        borderLeft: `3px solid ${accent}`,
        padding: "22px 26px 22px 28px",
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 14,
            color: accent,
            fontWeight: 700,
          }}
        >
          {data.icon}
        </span>
        <span
          style={{
            fontFamily: FONT.ui,
            fontSize: 16,
            fontWeight: 700,
            color: accent,
            letterSpacing: "-0.01em",
          }}
        >
          {data.for}
        </span>
      </div>

      {/* Points */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {data.points.map((point, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <span
              style={{
                fontFamily: FONT.mono,
                color: accent,
                fontSize: 13,
                marginTop: 2,
                flexShrink: 0,
                opacity: 0.85,
              }}
            >
              {checkChar}
            </span>
            <span
              style={{
                fontFamily: FONT.ui,
                fontSize: 14,
                color: BRAND.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {point}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProblemSolutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = TIMINGS.fps;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [0, 28], [0, 1], { extrapolateRight: "clamp" });

  // Labels
  const probLabelOp = interpolate(frame, [12, 26], [0, 1], { extrapolateRight: "clamp" });
  const solLabelOp = interpolate(frame, [158, 172], [0, 1], { extrapolateRight: "clamp" });

  // Problem cards
  const prob1Start = 26;
  const prob2Start = 50;

  // Arrow animation
  const leftArrowReveal = interpolate(frame, [80, 122], [0, 1], { extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [120, 140], [0, 1], { extrapolateRight: "clamp" });
  const logoScaleVal = spring({
    frame: Math.max(0, frame - 118),
    fps,
    from: 0,
    to: 1,
    config: { mass: 0.7, damping: 130 },
  });
  const rightArrowReveal = interpolate(frame, [140, 178], [0, 1], { extrapolateRight: "clamp" });

  // Solution cards
  const sol1Start = 162;
  const sol2Start = 184;

  // Tagline
  const taglineOp = interpolate(frame, [200, 218], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [200, 218], [14, 0], { extrapolateRight: "clamp" });

  // Logo pulse (after it appears)
  const logoPulse = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 1.6);

  // Beam glow from logo
  const beamOp =
    logoOpacity * 0.45 * (0.75 + 0.25 * Math.sin((frame / fps) * Math.PI * 2));

  // Canvas geometry
  const W = 1920;
  const H = 1080;
  const CX = W / 2;
  const CY = H / 2 - 20; // slightly above center
  const R = 66; // logo radius
  const LEFT_ARROW_X = 650;
  const RIGHT_ARROW_X = 1270;

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
            radial-gradient(ellipse 38% 65% at 16% 50%, rgba(255,77,109,0.045) 0%, transparent 55%),
            radial-gradient(ellipse 38% 65% at 84% 50%, rgba(0,255,178,0.055) 0%, transparent 55%),
            radial-gradient(ellipse 28% 48% at 50% 50%, rgba(0,255,178,0.06) 0%, transparent 40%)
          `,
          opacity: glowOpacity,
        }}
      />

      {/* ── Grid ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,178,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,178,0.016) 1px, transparent 1px)
          `,
          backgroundSize: "96px 96px",
          opacity: glowOpacity,
        }}
      />

      {/* ── Arrow + Logo SVG ── */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Left arrow clip */}
          <clipPath id="leftArrowClip">
            <rect
              x={LEFT_ARROW_X}
              y={CY - 30}
              width={(CX - R - LEFT_ARROW_X) * leftArrowReveal}
              height={60}
            />
          </clipPath>

          {/* Right arrow clip */}
          <clipPath id="rightArrowClip">
            <rect
              x={CX + R}
              y={CY - 30}
              width={(RIGHT_ARROW_X - CX - R) * rightArrowReveal}
              height={60}
            />
          </clipPath>

          {/* Logo glow radial */}
          <radialGradient id="logoGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={BRAND.signalPrimary} stopOpacity="0.28" />
            <stop offset="100%" stopColor={BRAND.signalPrimary} stopOpacity="0" />
          </radialGradient>

          {/* Left beam gradient */}
          <linearGradient id="beamL" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={BRAND.signalPrimary} stopOpacity="0.22" />
            <stop offset="100%" stopColor={BRAND.signalPrimary} stopOpacity="0" />
          </linearGradient>

          {/* Right beam gradient */}
          <linearGradient id="beamR" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND.signalPrimary} stopOpacity="0.22" />
            <stop offset="100%" stopColor={BRAND.signalPrimary} stopOpacity="0" />
          </linearGradient>

          {/* Text glow filter */}
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Beam glow left */}
        <rect
          x={LEFT_ARROW_X}
          y={CY - 90}
          width={CX - R - LEFT_ARROW_X}
          height={180}
          fill="url(#beamL)"
          opacity={beamOp}
          rx="6"
        />

        {/* Beam glow right */}
        <rect
          x={CX + R}
          y={CY - 90}
          width={RIGHT_ARROW_X - CX - R}
          height={180}
          fill="url(#beamR)"
          opacity={beamOp}
          rx="6"
        />

        {/* Left arrow line */}
        <line
          x1={LEFT_ARROW_X}
          y1={CY}
          x2={CX - R - 2}
          y2={CY}
          stroke={BRAND.signalPrimary}
          strokeWidth="3"
          strokeLinecap="round"
          clipPath="url(#leftArrowClip)"
          opacity="0.85"
        />

        {/* Right arrow line */}
        <line
          x1={CX + R + 2}
          y1={CY}
          x2={RIGHT_ARROW_X - 30}
          y2={CY}
          stroke={BRAND.signalPrimary}
          strokeWidth="3"
          strokeLinecap="round"
          clipPath="url(#rightArrowClip)"
          opacity="0.85"
        />

        {/* Arrowhead */}
        <polygon
          points={`${RIGHT_ARROW_X},${CY} ${RIGHT_ARROW_X - 30},${CY - 15} ${RIGHT_ARROW_X - 30},${CY + 15}`}
          fill={BRAND.signalPrimary}
          opacity={rightArrowReveal * 0.9}
        />

        {/* Logo outer glow halo */}
        <circle
          cx={CX}
          cy={CY}
          r={R * 2.6}
          fill="url(#logoGlowGrad)"
          opacity={logoOpacity * logoPulse}
        />

        {/* Logo ring group (scaled from center) */}
        <g
          transform={`translate(${CX} ${CY}) scale(${logoScaleVal}) translate(${-CX} ${-CY})`}
        >
          {/* Outer circle */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill={BRAND.bgPrimary}
            stroke={BRAND.signalPrimary}
            strokeWidth="2.5"
            opacity={logoOpacity}
          />

          {/* Inner dashed ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R - 12}
            fill="none"
            stroke={BRAND.signalPrimary}
            strokeWidth="0.8"
            strokeDasharray="3.5 3.5"
            opacity={logoOpacity * 0.45}
          />

          {/* "A" lettermark */}
          <text
            x={CX}
            y={CY + 4}
            textAnchor="middle"
            fontFamily={FONT.display}
            fontSize="50"
            fontWeight="700"
            fill={BRAND.signalPrimary}
            opacity={logoOpacity}
            filter="url(#textGlow)"
          >
            A
          </text>
        </g>

        {/* Subtle vertical center divider lines */}
        <line
          x1={LEFT_ARROW_X}
          y1={100}
          x2={LEFT_ARROW_X}
          y2={H - 100}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
        <line
          x1={RIGHT_ARROW_X}
          y1={100}
          x2={RIGHT_ARROW_X}
          y2={H - 100}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      </svg>

      {/* ── Main layout ── */}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: `${LEFT_ARROW_X}px 1fr ${W - RIGHT_ARROW_X}px`,
          height: "100%",
        }}
      >
        {/* LEFT: Problems */}
        <div
          style={{
            padding: "0 44px 0 80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: "0.22em",
              color: BRAND.danger,
              textTransform: "uppercase",
              marginBottom: 2,
              opacity: probLabelOp,
            }}
          >
            The Problem
          </div>
          {PROBLEMS.map((p, i) => (
            <InfoCard
              key={i}
              data={p}
              startFrame={i === 0 ? prob1Start : prob2Start}
              frame={frame}
              side="problem"
            />
          ))}
        </div>

        {/* CENTER: spacer + tagline at bottom */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "0 20px 70px",
          }}
        >
          <p
            style={{
              fontFamily: FONT.ui,
              fontSize: 15,
              color: BRAND.textMuted,
              textAlign: "center",
              lineHeight: 1.7,
              fontStyle: "italic",
              maxWidth: 300,
              opacity: taglineOp,
              transform: `translateY(${taglineY}px)`,
            }}
          >
            "A marketplace where performance earns trust, and trust unlocks capital."
          </p>
        </div>

        {/* RIGHT: Solutions */}
        <div
          style={{
            padding: "0 80px 0 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: "0.22em",
              color: BRAND.signalPrimary,
              textTransform: "uppercase",
              marginBottom: 2,
              opacity: solLabelOp,
            }}
          >
            The Solution
          </div>
          {SOLUTIONS.map((s, i) => (
            <InfoCard
              key={i}
              data={s}
              startFrame={i === 0 ? sol1Start : sol2Start}
              frame={frame}
              side="solution"
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
