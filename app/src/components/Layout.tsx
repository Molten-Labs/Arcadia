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
            <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background-secondary)/0.55)_48%,hsl(var(--background)))]" />
            <div className="absolute inset-0 arcadia-glow opacity-65" />
            <div className="absolute inset-0 hairline-grid opacity-[0.14]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        </div>

        <Nav />
        <DemoDisclosure />
        <main className="flex-1">{children}</main>
        {!hideFooter && <Footer />}
    </div>
);

const DemoDisclosure = () => (
    <div className="border-b border-border/30 bg-background/60 backdrop-blur-md">
        <div className="container flex items-center justify-center py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border/50 rounded-md px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse-glow" />
                Solana Devnet · Live
            </span>
        </div>
    </div>
);
