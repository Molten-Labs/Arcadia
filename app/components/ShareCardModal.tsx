"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { X, Download, Link2, Check } from "lucide-react";

import { AcidButton } from "@/components/acid";
import { cn } from "@/lib/utils";
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

  /* tilt handlers */
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

  /* download */
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

  /* copy link */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(profileUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [profileUrl]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-7 bg-void/85 p-6 backdrop-blur-xl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Share @${data.handle} Arcadia Score`}
        className="flex flex-col items-center gap-6"
      >
        {/* Header */}
        <div className="flex w-full max-w-[840px] items-center justify-between">
          <div>
            <p className="m-0 font-display text-base font-bold tracking-tight text-ink">
              Share your Arcadia Score
            </p>
            <p className="mt-1 font-mono text-[0.5625rem] tracking-[0.2em] text-faint uppercase">
              Hover to preview the tilt / Download as PNG
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg border border-line bg-panel-2 text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <X className="size-3.5" />
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
              borderRadius: 16,
              boxShadow: "0 48px 96px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            <div ref={cardEl} style={{ borderRadius: 16, overflow: "hidden" }}>
              <ShareCard data={data} profileUrl={profileUrl} />
            </div>
            <div className="t-tilt-glare" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <AcidButton size="sm" onClick={handleDownload} disabled={downloading}>
            <Download />
            {downloading ? "Saving..." : "Download PNG"}
          </AcidButton>
          <AcidButton
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn(copied && "border-success/40 text-success hover:border-success hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-success)_35%,transparent)]")}
          >
            {copied ? <Check /> : <Link2 />}
            {copied ? "Link copied" : "Copy Link"}
          </AcidButton>
        </div>
      </div>
    </div>
  );
}
