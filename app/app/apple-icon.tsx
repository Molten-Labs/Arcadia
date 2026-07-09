import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon: the Arcadia mark full-bleed on the acid tile
 * (iOS applies its own corner mask). Same glyph as app/icon.svg.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#CCFF00",
        }}
      >
        <svg viewBox="0 0 64 64" width={148} height={148}>
          <path
            fill="#000000"
            d="M26.5 14 H37.5 L55 50 H43.5 L32 27 L20.5 50 H9 Z M21 38 H43 V45.5 H21 Z"
          />
        </svg>
      </div>
    ),
    size,
  );
}
