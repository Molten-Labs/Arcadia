import { ReactNode } from "react";
import { Info, ShieldCheck } from "lucide-react";
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
        <div className="container flex flex-col gap-2 py-2 text-[11px] text-foreground/75 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Info className="h-3 w-3" aria-hidden="true" />
                </span>
                <span>
                    <strong className="font-semibold text-foreground/85">Frontend preview:</strong>{" "}
                    wallet sessions, market data, vault actions, and transactions are deterministic Arcadia demo flows until production Solana adapters are connected.
                </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground font-mono">
                <ShieldCheck className="h-3 w-3 text-success/70" aria-hidden="true" />
                Non-custodial · no real funds moved
            </div>
        </div>
    </div>
);
