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
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { PriceTicker } from "@/components/PriceTicker";
import { DataModeToggle } from "@/components/DataModeToggle";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4";

const Landing = () => {
  const { data: vaults } = useVaults();
  const allVaults = useMemo(() => vaults ?? [], [vaults]);

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
      <section className="relative min-h-[calc(100vh-6.75rem)] overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.22),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background-secondary)))]" />
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-45 saturate-[0.8]"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.88)_34%,hsl(var(--background)/0.56)_62%,hsl(var(--background)/0.88)_100%)]" />
        <div className="absolute inset-0 grid-bg opacity-[0.14]" />

        <div className="container relative pt-16 pb-16 md:pt-24 md:pb-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
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
                SynQ first-loss vaults
              </div>
              <h1 className="font-display font-bold text-5xl md:text-7xl leading-[0.95] tracking-tight">
                Syn<span className="text-primary">Q</span> traders prove first. Investors follow proof.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl leading-relaxed">
                SynQ is a Solana vault marketplace where traders build a public track record with their own capital,
                then graduate into investor capital protected by an on-chain junior buffer.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Button asChild size="lg" className="bg-gradient-ember hover:opacity-90 text-white border-0 shadow-ember">
                  <Link to="/vaults">Open marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/manager">Trader console</Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href="#calculator">Returns calculator</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <DataModeToggle />
                <span className="text-xs text-muted-foreground">
                  Switch between deterministic SynQ demo data and configured server/RPC data.
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block"
            >
              <GlassCard
                tag="DEVNET · LIVE DEMO"
                title={<>Built for <span className="italic font-display text-primary">capital</span> that needs receipts.</>}
                subtitle="Paper mode, on-chain reputation, dynamic risk limits, and instant exits when buffers run thin."
              />
            </motion.div>
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
          <h2 className="font-display font-bold text-4xl">How SynQ works</h2>
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
