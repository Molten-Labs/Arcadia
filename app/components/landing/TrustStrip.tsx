import { BadgeCheck, FileCode2, Vault, type LucideIcon } from "lucide-react";

import { TRUST_ITEMS } from "./data";
import { DriftMark, JupiterMark, SolanaMark } from "./brand-icons";

type IconKey = (typeof TRUST_ITEMS)[number]["icon"];

/** Lucide marks for the non-protocol concept tokens. */
const GENERIC: Partial<Record<IconKey, LucideIcon>> = {
  verified: BadgeCheck,
  contract: FileCode2,
  vault: Vault,
};

/** Official protocol logo, or a concept glyph, sized to the surrounding text. */
function ItemIcon({ icon }: { icon: IconKey }) {
  if (icon === "solana") return <SolanaMark className="size-[1.15em]" />;
  if (icon === "jupiter") return <JupiterMark className="size-[1.15em]" />;
  if (icon === "drift") return <DriftMark className="size-[1.15em] text-ink" />;
  const Generic = GENERIC[icon];
  return Generic ? <Generic aria-hidden className="size-[1.05em] text-acid/80" /> : null;
}

/** Static, centered trust strip: integrations + protocol guarantees. */
export function TrustStrip() {
  return (
    <section aria-label="Trusted integrations" className="border-y border-white/10 bg-onyx">
      <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-[clamp(1.25rem,2.6vw,2rem)]">
        {TRUST_ITEMS.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-2.5 font-mono text-[clamp(0.82rem,1.6vw,0.98rem)] tracking-[0.1em] text-muted uppercase transition-colors duration-300 hover:text-ink motion-reduce:transition-none"
          >
            <ItemIcon icon={item.icon} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
