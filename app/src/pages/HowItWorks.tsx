import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Activity, Shield, AlertTriangle, TrendingDown, Award } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { icon: Layers, title: "Junior and senior capital", body: "Each vault holds two layers. Junior capital comes from the trader. Senior capital comes from investors. Losses always hit junior first — investors are protected as long as the junior buffer holds." },
  { icon: Activity, title: "Paper mode", body: "New vaults run in paper mode for 30 days with only trader capital. The trader builds a public, on-chain track record before any investor can deposit." },
  { icon: Award, title: "Graduation", body: "After paper mode and a positive performance check, the vault graduates and opens to investor deposits. The graduation event is recorded on-chain." },
  { icon: TrendingDown, title: "Dynamic risk limits", body: "As the junior buffer drops, position sizes shrink automatically. At 50% junior health, the vault enters cooldown. Below 20%, investor exits become instant." },
  { icon: AlertTriangle, title: "Freeze", body: "If the junior buffer is depleted, trading is disabled and the vault is frozen. Investors withdraw available liquidity. The trader's reputation is permanently affected." },
  { icon: Shield, title: "Performance fees", body: "Traders only earn fees on gains above the previous high-water mark. No fees during drawdowns. No fees on flat performance." },
];

const HowItWorks = () => (
  <Layout>
    <div className="container py-16 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="page-header-label">Protocol guide</span>
        <h1 className="font-display type-h1 font-semibold mt-3">How Arcadia works</h1>
        <p className="text-[1.05rem] text-muted-foreground mt-4 max-w-xl leading-relaxed">
          Arcadia is a managed-vault protocol where every trader posts their own first-loss capital before they can manage investor funds.
        </p>
      </motion.div>

      <div className="space-y-4 mt-12">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.06 }}
            className="surface rounded-[11px] p-6 flex gap-5 group hover:border-border-strong transition-[border-color]"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <s.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground mb-1.5 tracking-[0.1em]">0{i + 1}</div>
              <h2 className="font-display font-semibold text-[15px] leading-snug">{s.title}</h2>
              <p className="text-[13px] text-foreground/75 mt-2.5 leading-relaxed">{s.body}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="surface-elevated rounded-[11px] p-8 mt-12 text-center relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <h2 className="font-display font-semibold text-[19px]">Ready to explore?</h2>
        <p className="text-muted-foreground mt-2 text-[14px]">Browse graduated vaults or explore traders by track record.</p>
        <div className="flex justify-center gap-3 mt-6">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow border-0 font-display font-semibold">
            <Link to="/vaults">Open marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/traders">Explore traders</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  </Layout>
);

export default HowItWorks;
