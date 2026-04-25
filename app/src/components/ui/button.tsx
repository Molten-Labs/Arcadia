import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-[background-color,color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-primary/90 hover:shadow-primary/25",
                gradient:
                    "border-0 bg-gradient-ember text-white shadow-ember hover:opacity-95 hover:shadow-primary/30",
                premium:
                    "border border-primary/30 bg-primary/10 text-primary shadow-sm hover:border-primary/50 hover:bg-primary/15 hover:text-primary-glow",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/15 hover:bg-destructive/90",
                dangerOutline:
                    "border border-destructive/35 bg-destructive/10 text-destructive hover:border-destructive/60 hover:bg-destructive/15",
                outline:
                    "border border-input bg-background/80 shadow-sm hover:border-border-strong hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                glass: "border border-white/10 bg-white/[0.06] text-foreground shadow-card backdrop-blur-xl hover:border-white/20 hover:bg-white/[0.09]",
                terminal:
                    "border border-border-strong bg-background-secondary text-foreground font-mono shadow-card hover:border-primary/40 hover:bg-secondary",
                tradeBuy:
                    "border-0 bg-success text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90",
                tradeSell:
                    "border-0 bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90",
                ghost: "hover:bg-accent hover:text-accent-foreground",
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
