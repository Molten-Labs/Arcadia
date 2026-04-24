import { Link } from "react-router-dom";
import { Flame } from "lucide-react";

export const Footer = () => (
  <footer className="border-t border-border mt-24 bg-background-secondary/40">
    <div className="container py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-ember flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold">Kiln</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Managed vaults with real skin in the game. Traders prove themselves on-chain before they touch your capital.
        </p>
      </div>
      <FooterCol title="Product" links={[
        { to: "/vaults", label: "Vaults" },
        { to: "/traders", label: "Traders" },
        { to: "/how-it-works", label: "How it works" },
      ]} />
      <FooterCol title="Resources" links={[
        { to: "/docs", label: "Docs" },
        { to: "/faq", label: "FAQ" },
      ]} />
      <FooterCol title="Community" links={[
        { to: "#", label: "Twitter" },
        { to: "#", label: "GitHub" },
        { to: "#", label: "Discord" },
      ]} />
    </div>
    <div className="border-t border-border">
      <div className="container py-6 flex flex-col md:flex-row gap-3 justify-between text-xs text-muted-foreground">
        <span>© 2025 Kiln Labs. Non-custodial. Use at your own risk.</span>
        <span>All performance figures are historical and do not guarantee future results.</span>
      </div>
    </div>
  </footer>
);

const FooterCol = ({ title, links }: { title: string; links: { to: string; label: string }[] }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</div>
    <ul className="space-y-2">
      {links.map(l => (
        <li key={l.label}><Link to={l.to} className="text-sm text-foreground/80 hover:text-foreground">{l.label}</Link></li>
      ))}
    </ul>
  </div>
);
