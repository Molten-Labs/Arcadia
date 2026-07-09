import { Fragment } from "react";
import { BadgeCheck, FileCode2, Sparkle, Vault, type LucideIcon } from "lucide-react";

import { Marquee } from "@/components/acid";
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

/** Scrolling trust strip: integrations + protocol guarantees, star-separated. */
export function TrustStrip() {
  return (
    <section aria-label="Trusted integrations" className="border-y border-white/10 bg-onyx">
      <Marquee speed={32} className="py-6">
        {TRUST_ITEMS.map((item) => (
          <Fragment key={item.label}>
            <span className="inline-flex items-center gap-2.5 px-8 font-mono text-[clamp(0.85rem,1.6vw,1.05rem)] tracking-[0.1em] text-muted uppercase transition-colors duration-300 hover:text-ink motion-reduce:transition-none">
              <ItemIcon icon={item.icon} />
              {item.label}
            </span>
            <Sparkle aria-hidden className="size-3 fill-current text-pink" />
          </Fragment>
        ))}
      </Marquee>
    </section>
  );
}
