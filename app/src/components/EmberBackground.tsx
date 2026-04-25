import { useEffect, useMemo, useState } from "react";

type EmberBackgroundProps = {
  videoSrc?: string;
  posterSrc?: string;
};

const DEFAULT_MUX_STREAM =
  "https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8";

const DEFAULT_POSTER =
  "https://image.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM/thumbnail.jpg?time=2";

export const EmberBackground = ({
  videoSrc = DEFAULT_MUX_STREAM,
  posterSrc = DEFAULT_POSTER,
}: EmberBackgroundProps) => {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [supportsHls, setSupportsHls] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const ua = navigator.userAgent.toLowerCase();
    const isWebKit =
      ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");

    if (!isWebKit) {
      setSupportsHls(true);
      return;
    }

    const testVideo = document.createElement("video");
    const canPlayHls =
      testVideo.canPlayType("application/vnd.apple.mpegurl") !== "" ||
      testVideo.canPlayType("application/x-mpegURL") !== "";

    setSupportsHls(canPlayHls);
  }, []);

  const showVideo = useMemo(
    () => !videoFailed && supportsHls,
    [videoFailed, supportsHls],
  );

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background-secondary" />

      {showVideo && (
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-40"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
        >
          <source src={videoSrc} type="application/vnd.apple.mpegurl" />
          <source src={videoSrc} type="application/x-mpegURL" />
        </video>
      )}

      <div
        className="absolute left-1/2 top-[-30%] -translate-x-1/2 w-[120vw] h-[120vw] aurora-spin"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, transparent 0deg, hsl(16 87% 55% / 0.22) 60deg, transparent 140deg, hsl(22 100% 65% / 0.18) 230deg, transparent 320deg)",
          filter: "blur(80px)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, black 0%, transparent 70%)",
          maskImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, black 0%, transparent 70%)",
          opacity: videoReady ? 0.42 : 0.55,
        }}
      />

      <div
        className="absolute left-[15%] top-[20%] w-[420px] h-[420px] rounded-full ember-orb-1"
        style={{
          background:
            "radial-gradient(circle, hsl(11 81% 43% / 0.55) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute right-[10%] top-[10%] w-[520px] h-[520px] rounded-full ember-orb-2"
        style={{
          background:
            "radial-gradient(circle, hsl(22 100% 65% / 0.4) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute left-[55%] top-[55%] w-[380px] h-[380px] rounded-full ember-orb-3"
        style={{
          background:
            "radial-gradient(circle, hsl(16 87% 55% / 0.35) 0%, transparent 70%)",
          filter: "blur(55px)",
        }}
      />

      <div className="absolute inset-0 grid-bg-animated opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

      <div className="absolute inset-y-0 left-1/4 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent animate-line-scan" />
      <div
        className="absolute inset-y-0 left-3/4 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent animate-line-scan"
        style={{ animationDelay: "3s" }}
      />

      <div className="absolute inset-0 hidden md:block">
        <div className="absolute inset-y-0 left-1/4 w-px bg-white/[0.04]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.04]" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-white/[0.04]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.36),hsl(var(--background)/0.72)_50%,hsl(var(--background-secondary)/0.9)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
};
