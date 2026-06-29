"use client";

import { useEffect, useState } from "react";
import type { TraderProfile } from "@/lib/types";

const TIER_COLORS: Record<string, string> = {
  Elite:       "#a855f7",
  Advanced:    "#f59e0b",
  Established: "#818cf8",
  Verified:    "#60a5fa",
};

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
  const tc      = TIER_COLORS[data.tier] ?? "#4f9eff";
  const isUp    = data.return_30d >= 0;
  const initials = data.handle.slice(0, 2).toUpperCase();
  const dateStr  = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).toUpperCase();

  const shortUrl = profileUrl.replace(/^https?:\/\/[^/]+/, "arcadia.so");

  useEffect(() => {
    import("qrcode").then(({ default: QRCode }) => {
      QRCode.toDataURL(profileUrl, {
        width: 128,
        margin: 1,
        color: { dark: "#c8c8c8", light: "#0d0d0d" },
      })
        .then(setQrUrl)
        .catch(() => {});
    });
  }, [profileUrl]);

  const stats = [
    { label: "30D RETURN", value: `${isUp ? "+" : ""}${data.return_30d.toFixed(1)}%`, color: isUp ? "#22c55e" : "#ef4444" },
    { label: "SORTINO",    value: data.sortino.toFixed(2),                              color: "#f0f0f0" },
    { label: "MAX DD",     value: `-${Math.abs(data.max_dd).toFixed(1)}%`,              color: "#ef4444" },
    { label: "WIN RATE",   value: `${data.win_rate.toFixed(0)}%`,                       color: "#f0f0f0" },
  ];

  return (
    <div
      style={{
        width: 840,
        height: 472,
        background: "linear-gradient(150deg, #07070b 0%, #0e0b18 55%, #07090f 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Inter", "system-ui", sans-serif',
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        flexShrink: 0,
      }}
    >
      {/* ── Atmospheric glows ── */}
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
        background: "radial-gradient(ellipse at center, rgba(79,158,255,0.09) 0%, transparent 70%)",
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

      {/* ── Dot grid accent ── */}
      <div style={{
        position: "absolute", left: 32, top: 88,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
        opacity: 0.18,
      }}>
        {Array.from({ length: 45 }).map((_, i) => (
          <div key={i} style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "#ffffff" }} />
        ))}
      </div>

      {/* ── Subtle grid texture ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* ── Bottom separator line ── */}
      <div style={{
        position: "absolute", left: 48, right: 48, bottom: 108,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)",
      }} />

      {/* ── Content ── */}
      <div style={{
        position: "relative",
        padding: "44px 48px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Top row — branding + tier */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, #4f9eff, ${tc})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#fff", fontWeight: 900,
            }}>⬡</div>
            <span style={{ fontSize: 19, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.025em" }}>arcadia</span>
          </div>
          <div style={{
            padding: "5px 14px", borderRadius: 24,
            border: `1px solid ${tc}50`,
            background: `${tc}1a`,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: tc,
          }}>{data.tier.toUpperCase()}</div>
        </div>

        {/* Avatar + handle + subtitle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${tc}20`,
            border: `1.5px solid ${tc}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: tc,
          }}>{initials}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em" }}>@{data.handle}</span>
            <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.35)" }}>
              achieved an Arcadia Score of...
            </span>
          </div>
        </div>

        {/* Score — massive */}
        <div style={{
          fontSize: 152,
          fontWeight: 900,
          lineHeight: 0.88,
          letterSpacing: "-0.04em",
          color: "#ffffff",
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
                fontSize: 8.5, fontWeight: 700, letterSpacing: "0.13em",
                color: "rgba(255,255,255,0.28)", marginBottom: 4,
              }}>{label}</div>
              <div style={{
                fontSize: 17, fontWeight: 800, color,
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
              }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Bottom row — date + URL + QR */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)" }}>
              SCORE ISSUED ·
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: tc }}>{dateStr}</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>·</span>
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.05em", color: "rgba(255,255,255,0.2)" }}>
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
              <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.28)" }}>
                VERIFY ON-CHAIN
              </span>
              <img src={qrUrl} alt="QR" width={84} height={84} style={{ borderRadius: 4, display: "block" }} />
              <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.2)" }}>
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
