import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const acidButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2.5 rounded-[10px] font-mono text-sm font-bold tracking-[0.08em] whitespace-nowrap uppercase outline-none transition-[transform,box-shadow,filter,border-color] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Signature acid-green solid, black label.
        acid: "bg-acid text-void hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[0_0_26px_rgba(204,255,0,0.6),0_0_54px_rgba(204,255,0,0.25)]",
        // Clean chrome outline: hairline border, ink label, acid on hover.
        chrome:
          "border border-white/25 bg-white/[0.04] text-ink backdrop-blur-sm hover:-translate-y-0.5 hover:border-acid/70 hover:text-acid hover:shadow-[0_0_24px_rgba(204,255,0,0.22)]",
        // Quiet outline.
        ghost:
          "border border-acid/20 bg-acid/[0.02] text-ink hover:-translate-y-0.5 hover:border-acid hover:shadow-[0_0_20px_rgba(204,255,0,0.35)]",
      },
      size: {
        default: "min-h-[52px] px-6",
        sm: "min-h-[44px] px-5 text-xs",
        lg: "min-h-[58px] px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "acid",
      size: "default",
    },
  }
);

export type AcidButtonProps = ComponentProps<"button"> &
  VariantProps<typeof acidButtonVariants> & {
    asChild?: boolean;
  };

/**
 * The signature Arcadia CTA. `acid` (green solid), `chrome` (clean outline)
 * and `ghost` (quiet acid outline) variants; all lift + glow on hover with
 * expo-out easing. Real `<button>` (or any element via `asChild`), so
 * keyboard + focus are native.
 */
export function AcidButton({
  className,
  variant = "acid",
  size,
  asChild = false,
  children,
  ...props
}: AcidButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp className={cn(acidButtonVariants({ variant, size }), className)} {...props}>
      {children}
    </Comp>
  );
}

/** Convenience wrapper: `<AcidButton variant="chrome" />`. */
export function ChromeButton(props: Omit<AcidButtonProps, "variant">) {
  return <AcidButton variant="chrome" {...props} />;
}
