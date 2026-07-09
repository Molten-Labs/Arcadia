import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AcidButton } from "@/components/acid";

/**
 * 404 (Acid Graphic). Server component: static, no data. Chrome-outline 404
 * with an acid kicker chip; single CTA back to the landing.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void">
      {/* Atmospheric acid glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--color-acid) 7%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 px-6 text-center">
        <p
          aria-hidden
          className="mb-6 font-display font-extrabold leading-none tracking-[-0.06em] text-transparent select-none"
          style={{
            fontSize: "clamp(5rem, 20vw, 12rem)",
            WebkitTextStroke: "2px var(--color-line)",
          }}
        >
          404
        </p>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-acid/25 bg-acid/[0.05] px-3.5 py-1.5 font-mono text-[0.64rem] font-bold tracking-[0.18em] text-acid uppercase">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-acid"
            style={{ boxShadow: "0 0 8px var(--color-acid)" }}
          />
          Page not found
        </div>

        <p className="mx-auto mb-8 max-w-sm text-base leading-relaxed text-muted">
          This route doesn&apos;t exist. You may have followed a broken link or
          mistyped the address.
        </p>

        <AcidButton asChild variant="acid">
          <Link href="/">
            <ArrowLeft aria-hidden />
            Back to Arcadia
          </Link>
        </AcidButton>
      </div>
    </div>
  );
}
