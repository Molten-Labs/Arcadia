import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt =
  "Arcadia - Prove it. Proof-of-performance capital protocol on Solana.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACID = "#CCFF00";
const PINK = "#FF2EA6";
const INK = "#F4F4F8";
const MUTED = "#A0A0B4";

/**
 * Social share card, generated at build from the same brand geometry as the
 * favicon and LogoMark. Fonts are committed under assets/og/ (OFL) so the
 * build needs no network access.
 */
export default async function OgImage() {
  const [syne, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/og/Syne-ExtraBold.ttf")),
    readFile(join(process.cwd(), "assets/og/SpaceMono-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          padding: "56px 72px 0",
          fontFamily: "Syne",
          position: "relative",
        }}
      >
        {/* Acid glow, top left */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -160,
            width: 700,
            height: 700,
            display: "flex",
            background:
              "radial-gradient(circle, rgba(204,255,0,0.16) 0%, rgba(204,255,0,0) 65%)",
          }}
        />

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg viewBox="0 0 64 64" width={64} height={64}>
            <rect width="64" height="64" rx="14" fill={ACID} />
            <path
              fill="#000000"
              d="M26.5 14 H37.5 L55 50 H43.5 L32 27 L20.5 50 H9 Z M21 38 H43 V45.5 H21 Z"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              color: INK,
              letterSpacing: -1,
            }}
          >
            ARCADIA
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              alignItems: "center",
              gap: 12,
              border: `2px solid ${ACID}33`,
              borderRadius: 999,
              padding: "10px 22px",
              fontFamily: "Space Mono",
              fontSize: 20,
              letterSpacing: 3,
              color: ACID,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 12,
                background: ACID,
              }}
            />
            SOLANA
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            lineHeight: 0.85,
          }}
        >
          <div style={{ display: "flex", fontSize: 164, color: INK, letterSpacing: -6 }}>
            PROVE
          </div>
          <div style={{ display: "flex", fontSize: 164, letterSpacing: -6 }}>
            <span style={{ color: ACID }}>IT</span>
            <span style={{ color: PINK }}>.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontFamily: "Space Mono",
            fontSize: 22,
            letterSpacing: 5,
            color: MUTED,
          }}
        >
          VERIFIED REPUTATION / ON-CHAIN ALLOCATION
        </div>

        {/* Acid marquee band */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: -60,
            width: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            transform: "rotate(-2.5deg)",
            background: ACID,
            padding: "16px 0",
            fontSize: 25,
            color: "#000000",
            letterSpacing: 0,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
            />
          </svg>
          PROOF-OF-PERFORMANCE CAPITAL PROTOCOL
          <svg width="26" height="26" viewBox="0 0 24 24">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Syne", data: syne, weight: 800, style: "normal" },
        { name: "Space Mono", data: mono, weight: 700, style: "normal" },
      ],
    },
  );
}
