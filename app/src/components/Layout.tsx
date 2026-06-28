import { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export const Layout = ({
    children,
    hideFooter = false,
}: {
    children: ReactNode;
    hideFooter?: boolean;
}) => (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/25 selection:text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background-secondary)/0.58)_48%,hsl(var(--background)))]" />
            <div className="absolute inset-0 arcadia-glow opacity-65" />
            <div className="absolute inset-0 hairline-grid opacity-[0.72] dark:opacity-[0.14]" />
            <div className="absolute -left-24 -top-28 h-[32rem] w-[32rem] rounded-[42%_58%_54%_46%/46%_42%_58%_54%] bg-foreground/[0.055] blur-[72px]" />
            <div className="absolute -bottom-28 -right-20 h-[29rem] w-[29rem] rounded-[42%_58%_54%_46%/46%_42%_58%_54%] bg-primary-glow/[0.10] blur-[72px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        </div>

        <Nav />
        <main className="flex-1">{children}</main>
        {!hideFooter && <Footer />}
    </div>
);
