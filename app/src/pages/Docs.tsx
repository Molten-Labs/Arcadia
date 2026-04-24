import { Layout } from "@/components/Layout";
import { Book, Code, Shield, FileText } from "lucide-react";

const Docs = () => (
  <Layout>
    <div className="container py-16 max-w-4xl">
      <h1 className="font-display font-bold text-4xl">Documentation</h1>
      <p className="text-muted-foreground mt-2">Everything you need to use Kiln as an investor or trader.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-10">
        {[
          { icon: Book, title: "Getting started", desc: "Connect a wallet, browse vaults, and make your first deposit." },
          { icon: Shield, title: "Risk model", desc: "How junior/senior layers, cooldowns, and freezes work." },
          { icon: Code, title: "Smart contracts", desc: "Audited contract addresses, repos, and integration guides." },
          { icon: FileText, title: "Trader guide", desc: "Create a vault, fund junior capital, graduate, and manage." },
        ].map(d => (
          <div key={d.title} className="surface rounded-2xl p-6 hover:border-border-strong transition-colors cursor-pointer">
            <d.icon className="w-5 h-5 text-primary mb-3" />
            <h2 className="font-display font-semibold">{d.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{d.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 surface rounded-2xl p-8 prose prose-invert max-w-none">
        <h2 className="font-display font-bold text-2xl mb-4">Core concepts</h2>
        <h3 className="font-semibold mt-6 mb-2">Junior capital</h3>
        <p className="text-foreground/80 text-sm">Trader-posted first-loss capital. Required at all times to maintain a minimum ratio against TVL.</p>
        <h3 className="font-semibold mt-6 mb-2">Senior capital</h3>
        <p className="text-foreground/80 text-sm">Investor deposits. Protected by the junior buffer. Subject to standard 24-hour withdrawal cooldown, or instant exit when junior health drops below 20%.</p>
        <h3 className="font-semibold mt-6 mb-2">High-water mark (HWM)</h3>
        <p className="text-foreground/80 text-sm">Performance fees are only earned on NAV growth above the previous HWM. Drawdowns must be recovered before fees resume.</p>
        <h3 className="font-semibold mt-6 mb-2">Cooldown</h3>
        <p className="text-foreground/80 text-sm">Triggered when junior health falls below 50%. Trading is paused for 48 hours to prevent further losses while position sizes are recalibrated.</p>
      </div>
    </div>
  </Layout>
);

export default Docs;
