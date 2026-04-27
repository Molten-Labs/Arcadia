import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { fmtUSD } from "@/lib/format";
import { ArrowRight, Shield, Layers, Activity, Lock, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { PriceTicker } from "@/components/PriceTicker";

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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,hsl(var(--primary)/0.24),transparent_32%),radial-gradient(circle_at_78%_20%,hsl(var(--info)/0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background-secondary)))]" />
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-35 saturate-[0.72]"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.72)_0%,hsl(var(--background)/0.42)_44%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.84)_26%,hsl(var(--background)/0.42)_58%,hsl(var(--background)/0.92)_100%)]" />
        <div className="absolute inset-0 grid-bg opacity-[0.09]" />

        <div className="container relative flex min-h-[calc(100vh-6.75rem)] flex-col justify-center py-16 md:py-24">
          <div className="max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl"
            >
              <div className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                SynQ Protocol
              </div>
              <h1 className="font-hero max-w-4xl text-6xl font-semibold leading-[0.88] tracking-normal text-foreground md:text-8xl lg:text-9xl">
                Capital follows proof.
              </h1>
              <p className="mt-7 max-w-xl text-sm leading-7 text-foreground/70 md:text-base">
                SynQ is a Solana vault layer where traders earn allocation only after proving performance with first-loss capital.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-ember">
                  <Link to="/vaults">Open marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/manager">Trader console</Link>
                </Button>
              </div>
            </motion.div>
          </div>
          <div className="mt-16 max-w-xl border-t border-border/70 pt-4 text-xs text-muted-foreground">
            First-loss vaults · public track records · non-custodial Solana rails
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
