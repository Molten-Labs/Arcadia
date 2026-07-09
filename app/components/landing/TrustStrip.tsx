import { Fragment } from "react";
import { Sparkle } from "lucide-react";

import { Marquee } from "@/components/acid";
import { TRUST_ITEMS } from "./data";

/** Scrolling trust strip: integrations + protocol guarantees, star-separated. */
export function TrustStrip() {
  return (
    <section aria-label="Trusted integrations" className="border-y border-white/10 bg-onyx">
      <Marquee speed={32} className="py-6">
        {TRUST_ITEMS.map((item) => (
          <Fragment key={item}>
            <span className="px-8 font-mono text-[clamp(0.85rem,1.6vw,1.05rem)] tracking-[0.1em] text-muted uppercase transition-colors duration-300 hover:text-ink motion-reduce:transition-none">
              {item}
            </span>
            <Sparkle aria-hidden className="size-3 fill-current text-pink" />
          </Fragment>
        ))}
      </Marquee>
    </section>
  );
}
