import { useEffect, useRef } from "react";
import Hls from "hls.js";

const HLS_SRC = "https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8";

export const HeroVideo = () => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = HLS_SRC;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, []);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60"
      />
      {/* left → right dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/40" />
      {/* bottom up gradient for readability */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/80 to-transparent" />
      {/* subtle ember tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent mix-blend-overlay" />
    </div>
  );
};
