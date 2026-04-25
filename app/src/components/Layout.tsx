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
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,hsl(var(--primary)/0.16),transparent_28%),radial-gradient(circle_at_82%_0%,hsl(var(--info)/0.10),transparent_30%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background-secondary)/0.72)_52%,hsl(var(--background)))]" />
            <div className="absolute inset-0 grid-bg opacity-[0.18]" />
            <div className="absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <Nav />
        <DemoDisclosure />
        <main className="flex-1">{children}</main>
        {!hideFooter && <Footer />}
    </div>
);

const DemoDisclosure = () => (
    <div className="border-b border-primary/20 bg-primary/[0.07] backdrop-blur-xl">
        <div className="container flex flex-col gap-2 py-2.5 text-xs text-foreground/85 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>
                    <strong className="font-semibold text-foreground">
                        Frontend preview:
                    </strong>{" "}
                    wallet sessions, market data, vault actions, and
                    transactions are deterministic demo flows until production
                    Solana adapters are connected.
                </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <ShieldCheck
                    className="h-3.5 w-3.5 text-success"
                    aria-hidden="true"
                />
                Non-custodial UX · no real funds moved
            </div>
        </div>
    </div>
);
