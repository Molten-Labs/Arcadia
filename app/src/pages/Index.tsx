import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { fmtUSD } from "@/lib/format";
import { ArrowRight, Shield, Layers, Activity, Lock, TrendingUp, Users, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { PriceTicker } from "@/components/PriceTicker";
import { ArcadiaLogo } from "@/components/ArcadiaLogo";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_094440_a3592600-bd1e-49e5-9bce-a73662061d83.mp4";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.10, ease: [0.22, 1, 0.36, 1] },
  }),
};

const Landing = () => {
  const { data: vaults } = useVaults();
  const allVaults = useMemo(() => vaults ?? [], [vaults]);

  const featured = useMemo(
    () => allVaults.filter(v => v.status === "active").slice(0, 3),
    [allVaults]
  );

  const stats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL: allVaults.reduce((s, v) => s + v.tvl, 0),
    graduated: allVaults.filter(v => v.status !== "paper").length,
    protected: allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100dvh-7.25rem)] overflow-hidden border-b border-border/35">
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-[0.35] saturate-[0.65]"
          src={HERO_VIDEO}
          autoPlay muted loop playsInline preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.82)_0%,hsl(var(--background)/0.52)_40%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.88)_30%,hsl(var(--background)/0.42)_62%,hsl(var(--background)/0.96)_100%)]" />
        <div className="absolute inset-0 arcadia-glow opacity-80" />
        <div className="absolute inset-0 hairline-grid opacity-[0.13]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        {/* Floating orbs */}
        <div className="pointer-events-none absolute top-32 right-[18%] h-64 w-64 rounded-full bg-primary/[0.08] blur-[72px] signal-orb-1" />
        <div className="pointer-events-none absolute top-48 right-[36%] h-40 w-40 rounded-full bg-primary-deep/10 blur-[52px] signal-orb-2" />

        <div className="container relative flex min-h-[calc(100dvh-7.25rem)] flex-col justify-center py-16 md:py-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="max-w-[720px]"
          >
            <motion.div variants={fadeUp} custom={0}>
              <span className="page-header-label">
                <ArcadiaLogo className="h-3.5 w-3.5" />
                Arcadia Protocol · Solana
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display font-semibold text-foreground/95 leading-[1.04] tracking-[-0.025em]"
              style={{ fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)" }}
            >
              Capital follows
              <br />
              <span className="text-gradient-signal">proof.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-lg text-[1.05rem] leading-[1.65] text-foreground/72"
            >
              Traders earn investor allocation only after posting first-loss capital and building a public, on-chain track record in paper mode.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 bg-primary text-primary-foreground hover:bg-primary-glow border-0 font-display font-semibold shadow-signal">
                <Link to="/vaults">
                  Open marketplace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 font-display font-semibold border-border/60 hover:bg-secondary/60">
                <Link to="/manager">Trader console</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-11 text-muted-foreground hover:text-foreground">
                <Link to="/how-it-works">
                  How it works <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-14 max-w-sm border-t border-border/40 pt-4 font-mono text-[11px] text-muted-foreground tracking-wide"
          >
            First-loss vaults · public track records · non-custodial Solana rails
          </motion.p>
        </div>
      </section>

      {/* ── Ticker / social proof ─────────────────────── */}
      <PriceTicker />
      <InfiniteSlider />

      {/* ── Protocol stats ───────────────────────────── */}
      <section className="border-b border-border/35 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container py-9 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/25">
          {[
            { l: "Total TVL", v: `${fmtUSD(stats.totalTVL, { compact: true })} USDC` },
            { l: "Live vaults", v: stats.totalVaults },
            { l: "Graduated", v: stats.graduated },
            { l: "Protected capital", v: `${fmtUSD(stats.protected, { compact: true })} USDC` },
          ].map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="bg-background px-6 py-7"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{s.l}</div>
              <div className="font-display font-bold text-2xl tabular text-foreground animate-flicker">{s.v}</div>
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section className="container py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <span className="page-header-label">Protocol</span>
          <h2 className="font-display type-h2 font-semibold mt-3">How Arcadia works</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Three steps. Aligned incentives. On-chain proof.</p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "01", icon: Layers, title: "Trader funds junior capital", desc: "Every trader puts their own money down first. This first-loss capital absorbs any drawdown before investors are ever affected." },
            { n: "02", icon: Activity, title: "Vault graduates after paper mode", desc: "30 days of public, on-chain track record. Investors see real, immutable performance — not pitch decks or back-tests." },
            { n: "03", icon: Shield, title: "Investors deposit with protection", desc: "Senior capital sits behind the junior buffer. Risk controls trigger automatically as the buffer drops." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.10 }}
              className="surface rounded-[11px] p-6 relative overflow-hidden group hover:border-primary/28 transition-[border-color,box-shadow] hover:shadow-[0_8px_32px_hsl(var(--background)/0.6),0_0_24px_hsl(var(--primary)/0.06)]"
            >
              <div
                className="font-display font-bold text-primary/[0.045] absolute -top-3 -right-1 leading-none select-none pointer-events-none"
                style={{ fontSize: "clamp(4rem, 8vw, 6.5rem)" }}
                aria-hidden="true"
              >
                {s.n}
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5">
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-display font-semibold text-[15px] leading-snug">{s.title}</h3>
              <p className="text-[13px] text-muted-foreground mt-2.5 leading-relaxed">{s.desc}</p>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 flex"
        >
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/how-it-works">Full protocol guide <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </motion.div>
      </section>

      {/* ── Featured vaults ─────────────────────────── */}
      <section className="container py-8 pb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="page-header-label">Marketplace</span>
            <h2 className="font-display type-h2 font-semibold mt-3">Featured vaults</h2>
            <p className="text-muted-foreground mt-1 text-[14px]">Top-performing graduated vaults open for deposits.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hidden sm:flex">
            <Link to="/vaults">View all <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>

        {featured.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {featured.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <VaultCard vault={v} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="surface rounded-[11px] p-12 text-center text-muted-foreground">
            <p className="text-sm">No active vaults yet. Connect your wallet and create the first one.</p>
            <Button asChild size="sm" className="mt-4 bg-primary text-primary-foreground border-0">
              <Link to="/manager/create">Create vault</Link>
            </Button>
          </div>
        )}

        <div className="mt-5 flex sm:hidden">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/vaults">View all vaults <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>
      </section>

      {/* ── Calculator ────────────────────────────── */}
      <VaultCalculator />

      {/* ── Trust strip ──────────────────────────── */}
      <section className="container py-24">
        <div className="surface-elevated rounded-[11px] p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="mb-10">
            <span className="page-header-label">Trust rails</span>
            <h2 className="font-display type-h2 font-semibold mt-3">Built different</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Activity, title: "30-day paper mode", desc: "Every vault must build a public track record before accepting investor capital." },
              { icon: Lock, title: "First-loss enforced", desc: "Trader junior capital absorbs losses before any investor funds are touched." },
              { icon: TrendingUp, title: "Dynamic risk limits", desc: "Position sizes shrink automatically as the junior buffer drops." },
              { icon: Users, title: "On-chain track record", desc: "Reputation, freezes, and cooldowns are all immutable and public." },
            ].map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <t.icon className="w-4 h-4" />
                </div>
                <h3 className="font-display font-semibold text-[14px]">{t.title}</h3>
                <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
