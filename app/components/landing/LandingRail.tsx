import { LogoMark } from "./LogoMark";

/**
 * Decorative fixed left rail (signature techno-surreal detail). Purely visual
 * and hidden from assistive tech; only shown on very wide viewports so it never
 * crowds content or collides with mobile chrome.
 */
export function LandingRail() {
  return (
    <aside
      aria-hidden
      className="fixed top-0 bottom-0 left-0 z-40 hidden w-[66px] flex-col items-center justify-between border-r border-white/10 bg-gradient-to-b from-void/70 to-onyx/40 py-5 backdrop-blur-[8px] xl:flex"
    >
      <LogoMark size={34} />
      <span
        className="font-mono text-[0.72rem] tracking-[0.34em] text-faint uppercase"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        TRADERS / LEADERBOARD / VAULTS / DOCS
      </span>
      <span
        className="flex items-center gap-3 font-mono text-[0.62rem] tracking-[0.4em] text-acid uppercase"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        <span
          className="h-[34px] w-px"
          style={{ background: "linear-gradient(var(--color-acid), transparent)" }}
        />
        SCROLL TO EXPLORE
      </span>
    </aside>
  );
}
