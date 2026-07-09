import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Max-width page wrapper for the app discovery routes. */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10", className)}>
      {children}
    </div>
  );
}

/** Mono eyebrow with a leading acid tick. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[0.7rem] tracking-[0.28em] text-acid uppercase",
        className,
      )}
    >
      <span aria-hidden className="h-px w-[22px] bg-acid" />
      {children}
    </span>
  );
}

/** Static acid/cyan radial wash for page-header backdrops (reduced-motion safe). */
export function HeaderAura({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{
        background:
          "radial-gradient(60% 90% at 8% -20%, color-mix(in srgb, var(--color-acid) 10%, transparent), transparent 60%), radial-gradient(50% 80% at 100% -10%, color-mix(in srgb, var(--color-cyan) 8%, transparent), transparent 55%)",
      }}
    />
  );
}

/** Syne display heading with the signature horizontal stretch. */
export function SectionTitle({
  as: Tag = "h1",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "origin-left font-display text-[clamp(1.75rem,4vw,2.6rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-ink uppercase",
        className,
      )}
      style={{ transform: "scaleX(1.04)" }}
    >
      {children}
    </Tag>
  );
}

/** Mono uppercase micro-label used inside panels and stat tiles. */
export function MonoLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn("font-mono text-[10px] tracking-[0.18em] text-faint uppercase", className)}>
      {children}
    </p>
  );
}

/** Bordered surface panel. */
export function Panel({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border border-line bg-panel", className)} {...props}>
      {children}
    </div>
  );
}

/** Compact stat tile: mono label over a big tabular value. */
export function StatTile({
  label,
  children,
  className,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-panel p-4", className)}>
      <MonoLabel>{label}</MonoLabel>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-bold tracking-[-0.02em] text-ink tabular-nums",
          valueClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Tailwind text-colour class for a signed number. */
export function signTone(n: number): string {
  if (n > 0) return "text-success";
  if (n < 0) return "text-danger";
  return "text-muted";
}

/** Short "$387k" style money. */
export function formatK(n: number): string {
  return `$${Math.round(n / 1000).toLocaleString("en-US")}k`;
}
