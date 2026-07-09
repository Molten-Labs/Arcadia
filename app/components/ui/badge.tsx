import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-bold tracking-[0.12em] uppercase whitespace-nowrap transition-colors [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-acid/30 bg-acid/15 text-acid",
        secondary: "border-white/10 bg-panel-2 text-muted",
        outline: "border-white/15 bg-transparent text-ink",
        success: "border-success/30 bg-success/15 text-success",
        danger: "border-danger/30 bg-danger/15 text-danger",
        verified: "border-tier-verified/40 bg-tier-verified/10 text-tier-verified",
        established: "border-tier-established/40 bg-tier-established/10 text-tier-established",
        advanced: "border-tier-advanced/40 bg-tier-advanced/10 text-tier-advanced",
        elite: "border-tier-elite/40 bg-tier-elite/10 text-tier-elite",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
