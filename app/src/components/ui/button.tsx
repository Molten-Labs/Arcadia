import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-[background-color,color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "border-0 bg-primary text-primary-foreground shadow-signal hover:bg-primary-glow hover:shadow-primary/30",
                gradient:
                    "border-0 bg-gradient-signal text-primary-foreground shadow-signal hover:opacity-95 hover:shadow-primary/30",
                premium:
                    "border border-primary/20 bg-primary/10 text-primary shadow-card hover:border-primary/35 hover:bg-primary/15 hover:text-primary-glow",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/15 hover:bg-destructive/90",
                dangerOutline:
                    "border border-destructive/35 bg-destructive/10 text-destructive hover:border-destructive/60 hover:bg-destructive/15",
                outline:
                    "border border-border/45 bg-card/35 shadow-card backdrop-blur hover:border-primary/30 hover:bg-primary/10 hover:text-primary-glow",
                secondary:
                    "bg-secondary/70 text-secondary-foreground shadow-card hover:bg-secondary",
                glass: "border border-border/55 bg-card/35 text-foreground shadow-card backdrop-blur-xl hover:border-primary/25 hover:bg-primary/[0.08]",
                terminal:
                    "border border-border/45 bg-background-secondary/80 text-foreground font-mono shadow-card hover:border-primary/35 hover:bg-secondary/80",
                tradeBuy:
                    "border-0 bg-success text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90",
                tradeSell:
                    "border-0 bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90",
                ghost: "hover:bg-primary/10 hover:text-primary-glow",
                link: "text-primary underline-offset-4 hover:text-primary-glow hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export { Button, buttonVariants };
