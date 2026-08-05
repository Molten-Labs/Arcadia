import type { CSSProperties, ReactNode } from "react";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page scaffolding shared across the investor routes: a max-width shell with a
 * quiet acid top-glow, a Syne page header, a mono kicker, and the wallet gate.
 * Aggressive skin (display type, one accent glow), readable core.
 */

const TOP_GLOW: CSSProperties = {
  background:
    "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--color-acid) 7%, transparent), transparent 60%)",
};

type ShellWidth = "narrow" | "mid" | "wide";

const WIDTH_CLASS: Record<ShellWidth, string> = {
  narrow: "max-w-2xl",
  mid: "max-w-5xl",
  wide: "max-w-screen-2xl",
};

/** Centered content column with a static acid glow behind the fold. */
export function PageShell({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: ShellWidth;
  className?: string;
}) {
  return (
    <div className="relative min-h-full bg-void">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64" style={TOP_GLOW} />
      <div className={cn("relative mx-auto px-5 py-8 sm:px-8", WIDTH_CLASS[width], className)}>
        {children}
      </div>
    </div>
  );
}

/** Mono eyebrow with a leading acid tick. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[0.7rem] tracking-[0.24em] text-acid uppercase",
        className,
      )}
    >
      <span aria-hidden className="h-px w-5 bg-acid" />
      {children}
    </span>
  );
}

/** Syne display page header with an optional kicker, subtitle and actions slot. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {kicker ? <Kicker className="mb-3">{kicker}</Kicker> : null}
        <h1 className="origin-left font-display text-3xl font-bold tracking-[-0.03em] text-ink uppercase sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Full-height "connect your wallet" gate. Connecting is handled by the topbar. */
export function ConnectGate({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-void px-6 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-acid/25 bg-acid/[0.06] shadow-[0_0_30px_rgba(204,255,0,0.12)]">
        <Zap className="size-6 text-acid" aria-hidden />
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink uppercase">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
