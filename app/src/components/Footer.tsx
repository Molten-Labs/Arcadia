import { Link } from "react-router-dom";
import { ArcadiaLogo } from "@/components/ArcadiaLogo";

type FooterLink = { to: string; label: string; external?: boolean };

export const Footer = () => (
    <footer className="mt-24 border-t border-border/35 bg-card/25 backdrop-blur-sm">
        <div className="container py-12 grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
            <div className="col-span-2">
                <Link to="/" className="flex items-center gap-2 mb-4 w-fit">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                        <ArcadiaLogo className="h-[18px] w-[18px]" />
                    </div>
                    <span className="font-display font-semibold text-[15px] tracking-tight">Arcadia</span>
                </Link>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                    Managed vaults with real skin in the game. Traders prove themselves on-chain before they touch your capital.
                </p>
            </div>

            <FooterCol
                title="Product"
                links={[
                    { to: "/vaults", label: "Marketplace" },
                    { to: "/traders", label: "Traders" },
                    { to: "/how-it-works", label: "How it works" },
                    { to: "/portfolio", label: "Portfolio" },
                ]}
            />
            <FooterCol
                title="Resources"
                links={[
                    { to: "/docs", label: "Docs" },
                    { to: "/faq", label: "FAQ" },
                    { to: "/how-it-works", label: "Protocol guide" },
                ]}
            />
            <FooterCol
                title="Community"
                links={[
                    { to: "https://twitter.com/arcadia_fi", label: "Twitter", external: true },
                    { to: "https://github.com/arcadia-fi", label: "GitHub", external: true },
                    { to: "https://discord.gg/arcadia", label: "Discord", external: true },
                ]}
            />
        </div>

        <div className="border-t border-border/30">
            <div className="container py-5 flex flex-col md:flex-row gap-2 justify-between text-[11px] text-muted-foreground font-mono">
                <span>© 2025 Arcadia Labs. Non-custodial. Use at your own risk.</span>
                <span>Performance figures are historical and do not guarantee future results.</span>
            </div>
        </div>
    </footer>
);

const FooterCol = ({ title, links }: { title: string; links: FooterLink[] }) => (
    <div>
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
            {title}
        </div>
        <ul className="space-y-2.5">
            {links.map((l) => (
                <li key={l.label}>
                    {l.external ? (
                        <a
                            href={l.to}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-foreground/65 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {l.label}
                        </a>
                    ) : (
                        <Link
                            to={l.to}
                            className="text-[13px] text-foreground/65 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {l.label}
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    </div>
);
