import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Book, Code, FileText, Shield } from "lucide-react";

type DocCard = {
  icon: typeof Book;
  title: string;
  desc: string;
  to: string;
};

const docCards: DocCard[] = [
  {
    icon: Book,
    title: "Getting started",
    desc: "Connect a wallet, browse vaults, and make your first deposit.",
    to: "/#how-it-works",
  },
  {
    icon: Shield,
    title: "Risk model",
    desc: "How junior/senior layers, cooldowns, and freezes work.",
    to: "/#faq",
  },
  {
    icon: Code,
    title: "Smart contracts",
    desc: "Audited contract addresses, repos, and integration guides.",
    to: "/trade",
  },
  {
    icon: FileText,
    title: "Trader guide",
    desc: "Create a vault, fund junior capital, graduate, and manage.",
    to: "/manager/create",
  },
];

const Docs = () => (
  <Layout>
    <div className="container py-16 max-w-4xl">
      <h1 className="font-display type-h1 font-semibold">Documentation</h1>
      <p className="text-muted-foreground mt-2">Everything you need to use Arcadia as an investor or trader.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-10">
        {docCards.map((d) => (
          <Link
            key={d.title}
            to={d.to}
            className="surface rounded-lg p-6 hover:border-border-strong transition-colors"
          >
            <d.icon className="w-5 h-5 text-primary mb-3" />
            <h2 className="font-display font-semibold">{d.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{d.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 surface rounded-lg p-8 prose max-w-none prose-headings:text-foreground prose-p:text-foreground/80 dark:prose-invert">
        <h2 className="font-display type-h3 font-semibold mb-4">Core concepts</h2>
        <h3 className="font-semibold mt-6 mb-2">Junior capital</h3>
        <p className="text-foreground/80 text-sm">Trader-posted first-loss capital. Required at all times to maintain a minimum ratio against TVL.</p>
        <h3 className="font-semibold mt-6 mb-2">Senior capital</h3>
        <p className="text-foreground/80 text-sm">Investor deposits. Protected by the junior buffer. Subject to standard 24-hour withdrawal cooldown, or instant exit when junior health drops below 20%.</p>
        <h3 className="font-semibold mt-6 mb-2">High-water mark (HWM)</h3>
        <p className="text-foreground/80 text-sm">Performance fees are only earned on NAV growth above the previous HWM. Drawdowns must be recovered before fees resume.</p>
        <h3 className="font-semibold mt-6 mb-2">Cooldown</h3>
        <p className="text-foreground/80 text-sm">Triggered when junior health falls below 50%. Trading is paused for 48 hours to prevent further losses while position sizes are recalibrated.</p>
      </div>

      <div className="mt-8 surface rounded-lg p-8">
        <h2 className="font-display type-h3 font-semibold">Community channels</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Public social links are mapped in the footer and land on these canonical sections.
        </p>
        <div className="mt-6 space-y-5 text-sm">
          <section id="community-twitter" className="scroll-mt-28">
            <h3 className="font-semibold">Twitter</h3>
            <p className="text-muted-foreground mt-1">
              Follow launch updates, trader highlights, and product releases from the official Arcadia account.
            </p>
          </section>
          <section id="community-github" className="scroll-mt-28">
            <h3 className="font-semibold">GitHub</h3>
            <p className="text-muted-foreground mt-1">
              Track SDK/docs iterations and integration examples as the production stack is published.
            </p>
          </section>
          <section id="community-discord" className="scroll-mt-28">
            <h3 className="font-semibold">Discord</h3>
            <p className="text-muted-foreground mt-1">
              Join support channels for onboarding help, incident updates, and strategy discussion.
            </p>
          </section>
        </div>
      </div>
    </div>
  </Layout>
);

export default Docs;
