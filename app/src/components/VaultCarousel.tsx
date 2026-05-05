import { useRef } from "react";
import type { VaultView } from "@/hooks/useVaults";
import { VaultCard } from "./VaultCard";

interface VaultCarouselProps {
  vaults: VaultView[];
}

const CARD_WIDTH = 360;
const CARD_GAP = 20;

export function VaultCarousel({ vaults }: VaultCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (vaults.length === 0) return null;

  // Duplicate for seamless loop — need enough cards to fill screen twice
  const repeated = vaults.length < 4
    ? [...vaults, ...vaults, ...vaults, ...vaults]
    : [...vaults, ...vaults];

  const totalWidth = vaults.length * (CARD_WIDTH + CARD_GAP);
  const duration = Math.max(22, vaults.length * 4);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Left fade mask */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28"
        style={{
          background:
            "linear-gradient(to right, hsl(var(--background)) 0%, transparent 100%)",
        }}
      />
      {/* Right fade mask */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28"
        style={{
          background:
            "linear-gradient(to left, hsl(var(--background)) 0%, transparent 100%)",
        }}
      />

      {/* Scrolling track */}
      <div
        ref={trackRef}
        className="flex py-1 vault-carousel-track"
        style={
          {
            gap: CARD_GAP,
            "--track-width": `${totalWidth}px`,
            "--duration": `${duration}s`,
          } as React.CSSProperties
        }
      >
        {repeated.map((vault, i) => (
          <div
            key={`${vault.id}-${i}`}
            style={{ width: CARD_WIDTH, flexShrink: 0 }}
          >
            <VaultCard vault={vault} />
          </div>
        ))}
      </div>

      <style>{`
        .vault-carousel-track {
          animation: vault-scroll var(--duration) linear infinite;
          width: max-content;
        }
        .vault-carousel-track:hover {
          animation-play-state: paused;
        }
        @keyframes vault-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(calc(-1 * var(--track-width))); }
        }
      `}</style>
    </div>
  );
}
