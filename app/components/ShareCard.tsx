"use client";

import { useEffect, useState } from "react";

/**
 * Maps a tier label to its Acid Graphic CSS token. Concrete hex values are read
 * from the token at runtime (getComputedStyle) so the card stays in sync with
 * the design system while still handing html2canvas fully-resolved colors.
 */
const TIER_TOKENS: Record<string, string> = {
  Elite:       "--color-tier-elite",
  Advanced:    "--color-tier-advanced",
  Established: "--color-tier-established",
  Verified:    "--color-tier-verified",
};

const MONO = "var(--font-space-mono), ui-monospace, monospace";
const DISPLAY = "var(--font-syne), sans-serif";
const SANS = "var(--font-space-grotesk), system-ui, sans-serif";

interface Palette {
  tier: string;
  acid: string;
  ink: string;
  muted: string;
  faint: string;
  success: string;
  danger: string;
  base: string;
  panel: string;
  onyx: string;
  cyan: string;
  chrome: string;
}

export interface ShareCardData {
  handle:      string;
  score:       number;
  tier:        string;
  return_30d:  number;
  sortino:     number;
  max_dd:      number;
  win_rate:    number;
  wallet:      string;
}

interface ShareCardProps {
  data:       ShareCardData;
  profileUrl: string;
}

export function ShareCard({ data, profileUrl }: ShareCardProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [palette, setPalette] = useState<Palette | null>(null);

  const initials = data.handle.slice(0, 2).toUpperCase();
  const isUp     = data.return_30d >= 0;
  const dateStr  = new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
  const shortUrl = profileUrl.replace(/^https?:\/\/[^/]+/, "arcadia.so");

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const read = (name: string) => cs.getPropertyValue(name).trim();
    const pal: Palette = {
      tier:    read(TIER_TOKENS[data.tier] ?? "--color-tier-verified"),
      acid:    read("--color-acid"),
      ink:     read("--color-ink"),
      muted:   read("--color-muted"),
      faint:   read("--color-faint"),
      success: read("--color-success"),
      danger:  read("--color-danger"),
      base:    read("--color-void"),
      panel:   read("--color-panel"),
      onyx:    read("--color-onyx"),
      cyan:    read("--color-cyan"),
      chrome:  read("--color-chrome-2"),
    };
    Promise.resolve().then(() => setPalette(pal));

    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(profileUrl, {
          width: 128,
          margin: 1,
          color: { dark: pal.chrome, light: pal.panel },
        }),
      )
      .then(setQrUrl)
      .catch(() => {});
  }, [data.tier, profileUrl]);

  if (!palette) {
    return <div className="bg-void" style={{ width: 840, height: 472, flexShrink: 0 }} />;
  }

  const p = palette;
  const tc = p.tier;

  const stats = [
    { label: "30D RETURN", value: `${isUp ? "+" : ""}${data.return_30d.toFixed(1)}%`, color: isUp ? p.success : p.danger },
    { label: "SORTINO",    value: data.sortino.toFixed(2),                              color: p.ink },
    { label: "MAX DD",     value: `-${Math.abs(data.max_dd).toFixed(1)}%`,              color: p.danger },
    { label: "WIN RATE",   value: `${data.win_rate.toFixed(0)}%`,                       color: p.ink },
  ];

  return (
    <div
      style={{
        width: 840,
        height: 472,
        background: `linear-gradient(150deg, ${p.base} 0%, ${p.panel} 55%, ${p.onyx} 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        flexShrink: 0,
      }}
    >
      {/* Atmospheric glows */}
      <div style={{
        position: "absolute", right: 120, bottom: -80,
        width: 520, height: 420,
        background: `radial-gradient(ellipse at center, ${tc}2e 0%, ${tc}10 45%, transparent 72%)`,
        borderRadius: "50%",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: -120, top: -80,
        width: 380, height: 300,
        background: `radial-gradient(ellipse at center, ${p.cyan}17 0%, transparent 70%)`,
        borderRadius: "50%",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: -40, top: 20,
        width: 260, height: 260,
        background: `radial-gradient(ellipse at center, ${tc}1a 0%, transparent 68%)`,
        borderRadius: "50%",
        pointerEvents: "none",
      }} />

      {/* Dot grid */}
      <div style={{
        position: "absolute", left: 32, top: 88,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
        opacity: 0.16,
      }}>
        {Array.from({ length: 45 }).map((_, i) => (
          <div key={i} style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: p.ink }} />
        ))}
      </div>

      {/* Subtle grid texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Bottom separator line */}
      <div style={{
        position: "absolute", left: 48, right: 48, bottom: 108,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative",
        padding: "44px 48px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Top row: branding + tier */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, ${p.acid}, ${tc})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: DISPLAY, fontSize: 15, fontWeight: 800, color: p.base,
            }}>A</div>
            <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em" }}>
              arcadia
            </span>
          </div>
          <div style={{
            padding: "5px 14px", borderRadius: 24,
            border: `1px solid ${tc}50`,
            background: `${tc}1a`,
            fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: tc,
          }}>{data.tier.toUpperCase()}</div>
        </div>

        {/* Avatar + handle + subtitle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${tc}20`,
            border: `1.5px solid ${tc}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: tc,
          }}>{initials}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: p.ink, letterSpacing: "-0.01em" }}>
              @{data.handle}
            </span>
            <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 400, color: p.muted }}>
              achieved an Arcadia Score of...
            </span>
          </div>
        </div>

        {/* Score */}
        <div style={{
          fontFamily: DISPLAY,
          fontSize: 152,
          fontWeight: 800,
          lineHeight: 0.88,
          letterSpacing: "-0.04em",
          color: p.ink,
          fontVariantNumeric: "tabular-nums",
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
        }}>
          {data.score}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 28, marginBottom: 18 }}>
          {stats.map(({ label, value, color }) => (
            <div key={label}>
              <div style={{
                fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em",
                color: p.faint, marginBottom: 4,
              }}>{label}</div>
              <div style={{
                fontFamily: MONO, fontSize: 17, fontWeight: 700, color,
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
              }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Bottom row: date + URL + QR */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO }}>
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.12em", color: p.faint }}>
              SCORE ISSUED
            </span>
            <span style={{ fontSize: 9, color: p.faint }}>/</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: tc }}>{dateStr}</span>
            <span style={{ fontSize: 9, color: p.faint }}>/</span>
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.05em", color: p.faint }}>
              {shortUrl}
            </span>
          </div>

          {/* QR */}
          {qrUrl ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "8px 10px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", color: p.faint }}>
                VERIFY ON-CHAIN
              </span>
              <div
                role="img"
                aria-label={`QR code linking to @${data.handle} profile`}
                style={{
                  width: 84, height: 84, borderRadius: 4,
                  backgroundImage: `url("${qrUrl}")`,
                  backgroundSize: "84px 84px",
                  backgroundRepeat: "no-repeat",
                }}
              />
              <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.08em", color: p.faint }}>
                arcadia
              </span>
            </div>
          ) : (
            <div style={{ width: 100, height: 100 }} />
          )}
        </div>
      </div>
    </div>
  );
}
