import { Link } from "react-router-dom";
import { ArcadiaLogo, ArcadiaWordmark } from "@/components/ArcadiaLogo";

type FooterLink = { to: string; label: string; external?: boolean };

export const Footer = () => (
    <footer className="mt-16 border-t border-border/40 bg-card/55 backdrop-blur-sm">
        <div className="container py-8 grid grid-cols-2 md:grid-cols-5 gap-5 lg:gap-8">
            <div className="col-span-2">
                <Link to="/" className="flex items-center gap-2 mb-3 w-fit">
                    <ArcadiaLogo className="h-6 w-6" />
                    <ArcadiaWordmark className="text-[32px]" />
                </Link>
                <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xs">
                    Back traders by proof, not promises. Performance-verified capital allocation on Solana.
                </p>
            </div>

            <FooterCol
                title="Product"
                links={[
                    { to: "/vaults", label: "Marketplace" },
                    { to: "/traders", label: "Traders" },
                    { to: "/how-it-works", label: "How Arcadia Works" },
                    { to: "/portfolio", label: "Portfolio" },
                ]}
            />
            <FooterCol
                title="Resources"
                links={[
                    { to: "/docs", label: "Docs" },
                    { to: "/#faq", label: "FAQ" },
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
            <div className="container py-3 flex flex-col md:flex-row gap-1.5 justify-between text-[10px] text-muted-foreground font-mono">
                <span>© 2026 Molten Labs. Non-custodial. Use at your own risk.</span>
                <a
                    href="https://explorer.solana.com/address/49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN?cluster=devnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors truncate max-w-xs"
                >
                    Program: 49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN · devnet ↗
                </a>
            </div>
        </div>
    </footer>
);

const FooterCol = ({ title, links }: { title: string; links: FooterLink[] }) => (
    <div>
        <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
            {title}
        </div>
        <ul className="space-y-2">
            {links.map((l) => (
                <li key={l.label}>
                    {l.external ? (
                        <a
                            href={l.to}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-foreground/65 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {l.label}
                        </a>
                    ) : (
                        <Link
                            to={l.to}
                            className="text-[12px] text-foreground/65 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {l.label}
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    </div>
);
