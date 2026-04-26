import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { fmtUSD } from "@/lib/format";
import { ArrowRight, Shield, Layers, Activity, Lock, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { TradingDashboardPreview } from "@/components/TradingDashboardPreview";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { EmberBackground } from "@/components/EmberBackground";
import { PriceTicker } from "@/components/PriceTicker";

const Landing = () => {
  const { data: vaults } = useVaults();
  const allVaults = vaults ?? [];

  const featured = useMemo(
    () => allVaults.filter(v => v.status === "active").slice(0, 3),
    [allVaults]
  );

  const protocolStats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL: allVaults.reduce((s, v) => s + v.tvl, 0),
    graduatedVaults: allVaults.filter(v => v.status !== "paper").length,
    protectedCapital: allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <EmberBackground />

        <div className="container relative pt-20 pb-20 md:pt-28 md:pb-24">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                Live on Solana devnet · {protocolStats.totalVaults} vaults
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">
                On-chain managed vaults
              </div>
              <h1 className="font-display font-bold text-5xl md:text-7xl leading-[0.95] tracking-tight">
                Trade with conviction. <span className="text-gradient-ember">Invest with proof.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl leading-relaxed">
                Kiln is a full trading and investment platform. Traders prove themselves with their own capital first,
                then manage investor funds with first-loss protection enforced on-chain.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Button asChild size="lg" className="bg-gradient-ember hover:opacity-90 text-white border-0 shadow-ember">
                  <Link to="/vaults">Browse vaults <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/traders">Explore traders</Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href="#calculator">Returns calculator</a>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block self-center -translate-y-6 animate-float"
            >
              <GlassCard
                tag="2025 · Audited"
                title={<>Built for <span className="italic font-display text-primary">institutional</span> trust.</>}
                subtitle="30-day paper mode, on-chain reputation, dynamic risk limits, and instant exits when buffers run thin."
              />
            </motion.div>
          </div>

          <div className="mt-14 max-w-5xl mx-auto">
            <TradingDashboardPreview />
          </div>
        </div>
      </section>

      <PriceTicker />
      <InfiniteSlider />

      {/* Stats strip */}
      <section className="border-b border-border relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px animate-shimmer pointer-events-none" />
        <div className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-6 relative">
          {[
            { l: "Total TVL", v: `${fmtUSD(protocolStats.totalTVL, { compact: true })} SOL` },
            { l: "Live vaults", v: protocolStats.totalVaults },
            { l: "Graduated", v: protocolStats.graduatedVaults },
            { l: "Protected capital", v: `${fmtUSD(protocolStats.protectedCapital, { compact: true })} SOL` },
          ].map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
              <div className="font-display font-semibold text-2xl mt-1 tabular animate-flicker">{s.v}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <h2 className="font-display font-bold text-4xl">How Kiln works</h2>
          <p className="text-muted-foreground mt-3">Three steps. Aligned incentives. On-chain proof.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { n: "01", icon: Layers, title: "Trader funds junior capital", desc: "Every trader puts their own money down. This first-loss capital absorbs any drawdown before investors do." },
            { n: "02", icon: Activity, title: "Vault graduates after paper mode", desc: "30 days of public, on-chain track record. Investors see real performance — not pitch decks." },
            { n: "03", icon: Shield, title: "Investors deposit with protection", desc: "Senior capital sits behind the junior buffer. Risk controls trigger automatically as the buffer drops." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              whileHover={{ y: -4 }}
              className="surface rounded-2xl p-6 shadow-card relative overflow-hidden group hover:border-border-strong transition-colors"
            >
              <div className="text-[80px] font-display font-bold text-primary/5 absolute -top-4 -right-2 leading-none">{s.n}</div>
              <s.icon className="w-6 h-6 text-primary mb-4 relative" />
              <h3 className="font-display font-semibold text-lg relative">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 relative">{s.desc}</p>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured vaults */}
      <section className="container py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-3xl">Featured vaults</h2>
            <p className="text-muted-foreground mt-1">Top-performing graduated vaults open for deposits.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/vaults">View all <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
        {featured.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-5">
            {featured.map(v => <VaultCard key={v.id} vault={v} />)}
          </div>
        ) : (
          <div className="surface rounded-2xl p-10 text-center text-muted-foreground">
            No active vaults yet. Connect your wallet and create the first one!
          </div>
        )}
      </section>

      <VaultCalculator />

      {/* Trust strip */}
      <section className="container py-20">
        <div className="surface-elevated rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Activity, title: "30-day paper mode", desc: "Every vault must build a public track record before accepting investor capital." },
              { icon: Lock, title: "First-loss enforced", desc: "Trader junior capital absorbs losses before any investor funds are touched." },
              { icon: TrendingUp, title: "Dynamic risk limits", desc: "Position sizes shrink automatically as the junior buffer drops." },
              { icon: Users, title: "On-chain track record", desc: "Reputation, freezes, and cooldowns are all immutable and public." },
            ].map(t => (
              <div key={t.title}>
                <t.icon className="w-5 h-5 text-primary mb-3" />
                <h3 className="font-semibold text-sm">{t.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
