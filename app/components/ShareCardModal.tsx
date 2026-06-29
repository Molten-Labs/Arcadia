"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { X, Download, Link2, Check } from "lucide-react";
import { ShareCard } from "./ShareCard";
import type { ShareCardData } from "./ShareCard";

interface ShareCardModalProps {
  data:       ShareCardData;
  profileUrl: string;
  onClose:    () => void;
}

export function ShareCardModal({ data, profileUrl, onClose }: ShareCardModalProps) {
  const tiltEl     = useRef<HTMLDivElement>(null);
  const cardEl     = useRef<HTMLDivElement>(null);
  const [copied,      setCopied]      = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  /* ── tilt handlers ── */
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el   = tiltEl.current;
    const card = el?.querySelector<HTMLElement>(".t-tilt-card");
    if (!el || !card) return;
    const r  = el.getBoundingClientRect();
    const x  = (e.clientX - r.left) / r.width;
    const y  = (e.clientY - r.top)  / r.height;
    el.style.setProperty("--tilt-rx", `${(y - 0.5) * -10}deg`);
    el.style.setProperty("--tilt-ry", `${(x - 0.5) *  10}deg`);
    el.style.setProperty("--tilt-gx", `${x * 100}%`);
    el.style.setProperty("--tilt-gy", `${y * 100}%`);
    card.classList.add("is-tilting");
    el.classList.add("is-hover");
  }, []);

  const onLeave = useCallback(() => {
    const el   = tiltEl.current;
    const card = el?.querySelector<HTMLElement>(".t-tilt-card");
    if (!el || !card) return;
    el.style.setProperty("--tilt-rx", "0deg");
    el.style.setProperty("--tilt-ry", "0deg");
    el.classList.remove("is-hover");
    setTimeout(() => card?.classList.remove("is-tilting"), 80);
  }, []);

  /* ── download ── */
  const handleDownload = useCallback(async () => {
    if (!cardEl.current || downloading) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardEl.current, {
        scale:           2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: null,
        logging:         false,
      });
      const a  = document.createElement("a");
      a.download = `arcadia-${data.handle}-score.png`;
      a.href     = canvas.toDataURL("image/png");
      a.click();
    } catch (err) {
      console.error("Card export failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [data.handle, downloading]);

  /* ── copy link ── */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(profileUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [profileUrl]);

  /* ── button base style ── */
  const btn = (accent?: string): React.CSSProperties => ({
    display:        "inline-flex",
    alignItems:     "center",
    gap:            7,
    padding:        "10px 20px",
    borderRadius:   10,
    border:         `1px solid ${accent ? `${accent}44` : "rgba(255,255,255,0.12)"}`,
    background:     accent ? `${accent}18` : "rgba(255,255,255,0.05)",
    color:          accent ?? "rgba(255,255,255,0.7)",
    fontSize:       13,
    fontWeight:     700,
    cursor:         "pointer",
    transition:     "opacity 0.15s",
    fontFamily:     '"Inter", system-ui, sans-serif',
    letterSpacing:  "-0.01em",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9000,
        background:      "rgba(0,0,0,0.82)",
        backdropFilter:  "blur(14px)",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             28,
        padding:         24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 840 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", margin: 0, letterSpacing: "-0.01em" }}>
              Share your Arcadia Score
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>
              Hover to preview the tilt · Download as PNG
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.5)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Card with tilt */}
        <div
          ref={tiltEl}
          className="t-tilt"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ transform: "scale(0.88)", transformOrigin: "top center" }}
        >
          <div
            className="t-tilt-card"
            style={{
              borderRadius:  16,
              boxShadow:     "0 48px 96px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            <div ref={cardEl} style={{ borderRadius: 16, overflow: "hidden" }}>
              <ShareCard data={data} profileUrl={profileUrl} />
            </div>
            <div className="t-tilt-glare" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ ...btn("#4f9eff"), opacity: downloading ? 0.6 : 1 }}
          >
            <Download size={14} />
            {downloading ? "Saving…" : "Download PNG"}
          </button>
          <button onClick={handleCopy} style={btn(copied ? "#22c55e" : undefined)}>
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            {copied ? "Link copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
