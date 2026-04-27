import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Activity, Shield, AlertTriangle, TrendingDown, Award } from "lucide-react";

const HowItWorks = () => (
  <Layout>
    <div className="container py-16 max-w-4xl">
      <h1 className="font-display font-bold text-5xl tracking-tight">How SynQ works</h1>
      <p className="text-lg text-muted-foreground mt-4 max-w-2xl">
        SynQ is a managed-vault protocol where every trader posts their own first-loss capital before they can manage investor funds.
      </p>

      <div className="space-y-8 mt-12">
        {[
          { icon: Layers, title: "Junior and senior capital", body: "Each vault holds two layers. Junior capital comes from the trader. Senior capital comes from investors. Losses always hit junior first — investors are protected as long as the junior buffer holds." },
          { icon: Activity, title: "Paper mode", body: "New vaults run in paper mode for 30 days with only trader capital. The trader builds a public, on-chain track record before any investor can deposit." },
          { icon: Award, title: "Graduation", body: "After paper mode and a positive performance check, the vault graduates and opens to investor deposits. The graduation event is recorded on-chain." },
          { icon: TrendingDown, title: "Dynamic risk limits", body: "As the junior buffer drops, position sizes shrink automatically. At 50% junior health, the vault enters cooldown. Below 20%, investor exits become instant." },
          { icon: AlertTriangle, title: "Freeze", body: "If the junior buffer is depleted, trading is disabled and the vault is frozen. Investors withdraw available liquidity. The trader's reputation is permanently affected." },
          { icon: Shield, title: "Performance fees", body: "Traders only earn fees on gains above the previous high-water mark. No fees during drawdowns. No fees on flat performance." },
        ].map((s, i) => (
          <div key={s.title} className="surface rounded-2xl p-6 flex gap-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-1">0{i + 1}</div>
              <h2 className="font-display font-semibold text-xl">{s.title}</h2>
              <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="surface-elevated rounded-2xl p-8 mt-12 text-center">
        <h2 className="font-display font-bold text-2xl">Ready to explore?</h2>
        <p className="text-muted-foreground mt-2">Browse graduated vaults or explore traders by track record.</p>
        <div className="flex justify-center gap-3 mt-5">
          <Button asChild className="bg-gradient-ember text-white border-0"><Link to="/vaults">Open marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
          <Button asChild variant="outline"><Link to="/traders">Explore traders</Link></Button>
        </div>
      </div>
    </div>
  </Layout>
);

export default HowItWorks;
