import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { useDataMode } from "@/hooks/useDataMode";
import { VaultCard } from "@/components/VaultCard";
import { Switch } from "@/components/ui/switch";
import { fmtUSD } from "@/lib/format";
import { FAQ_ITEMS } from "@/lib/faq";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  ChevronDown,
  Lock,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_094440_a3592600-bd1e-49e5-9bce-a73662061d83.mp4";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PROBLEM_COLUMNS = [
  {
    title: "For Traders",
    items: [
      "Hard to prove skill on-chain",
      "No scalable way to access capital",
      "Reliance on audience or connections",
    ],
  },
  {
    title: "For Investors",
    items: [
      "Hard to verify traders",
      "Trust-based systems",
      "Capital gets locked or delayed",
    ],
  },
];

const FLOW_STEPS = [
  {
    n: "01",
    icon: Shield,
    title: "Capital is layered",
    body: "Trader capital forms the junior buffer. Investor capital enters as senior capital after validation.",
  },
  {
    n: "02",
    icon: Activity,
    title: "Performance is observed",
    body: "New vaults build a public record before accepting investor deposits.",
  },
  {
    n: "03",
    icon: Award,
    title: "Vaults graduate",
    body: "Qualified vaults open to investors with visible status, history, and risk context.",
  },
  {
    n: "04",
    icon: BarChart3,
    title: "Risk limits adjust",
    body: "Operating limits respond to vault health so capital allocation stays controlled.",
  },
  {
    n: "05",
    icon: Lock,
    title: "Investors stay in control",
    body: "Withdrawal context and liquidity status stay visible at the point of action.",
  },
  {
    n: "06",
    icon: TrendingUp,
    title: "Performance earns capital",
    body: "Consistent results improve visibility and expand access to investor allocation.",
  },
];

const Landing = () => {
  const { data: vaults } = useVaults();
  const { mode, setMode } = useDataMode();
  const allVaults = useMemo(() => vaults ?? [], [vaults]);

  const featuredVaults = useMemo(
    () => allVaults.filter((v) => v.status === "active").slice(0, 3),
    [allVaults],
  );

  const stats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL: allVaults.reduce((s, v) => s + v.tvl, 0),
    graduated: allVaults.filter((v) => v.status !== "paper").length,
    protected: allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

  return (
    <Layout>
      {/* 1. Hero */}
      <section className="relative min-h-[calc(100dvh-3.75rem)] overflow-hidden border-b border-border/35">
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-[0.54] saturate-[0.75]"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.62)_0%,hsl(var(--background)/0.30)_40%,hsl(var(--background)/0.90)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.94)_0%,hsl(var(--background)/0.72)_34%,hsl(var(--background)/0.18)_64%,hsl(var(--background)/0.74)_100%)]" />
        <div className="absolute inset-0 arcadia-glow opacity-50" />
        <div className="absolute inset-0 hairline-grid opacity-[0.08]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="container relative flex min-h-[calc(100dvh-3.75rem)] flex-col justify-center py-16 md:py-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="max-w-[740px]"
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse-glow" />
                Devnet Live
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {mode === "mock" ? "Devnet Preview" : "Live"}
                </span>
                <Switch
                  checked={mode === "mock"}
                  onCheckedChange={(checked) => setMode(checked ? "mock" : "real")}
                />
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display font-semibold leading-[1.04] tracking-[-0.025em] text-foreground/95"
              style={{ fontSize: "clamp(2.35rem, 5.5vw, 3.85rem)" }}
            >
              Proof-of-Performance
              <br />
              Capital Protocol
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-xl text-[1.05rem] leading-[1.65] text-foreground/72"
            >
              Arcadia helps traders earn allocation through verified on-chain performance while investors evaluate capital, risk, and liquidity before connecting.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 border-0 bg-primary font-display font-semibold text-primary-foreground shadow-signal hover:bg-primary-glow">
                <Link to="/vaults">
                  Explore Vaults
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 border-border/60 font-display font-semibold hover:bg-secondary/60">
                <Link to="/manager/create">Launch Vault</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.a
            href="#problem-solution"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">scroll</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </motion.a>
        </div>
      </section>

      {/* 2. Problem → Solution */}
      <section id="problem-solution" className="border-b border-border/35 py-20 scroll-mt-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <h2 className="font-display type-h2 font-semibold">The way capital is allocated today is broken.</h2>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            {PROBLEM_COLUMNS.map((column, i) => (
              <motion.div
                key={column.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="surface rounded-[11px] p-6"
              >
                <h3 className="font-display type-h3 font-semibold">{column.title}</h3>
                <ul className="mt-5 space-y-3">
                  {column.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-foreground/78">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="mx-auto mt-8 max-w-xl text-center font-display type-h3 font-semibold text-primary"
          >
            Arcadia replaces trust with performance.
          </motion.p>
        </div>
      </section>

      {/* 3. How It Works */}
      <section id="how-it-works" className="border-b border-border/35 py-20 scroll-mt-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 max-w-2xl"
          >
            <h2 className="font-display type-h2 font-semibold">How Arcadia works</h2>
            <p className="mt-2 text-muted-foreground">Six steps from verified performance to controlled capital access.</p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.42, delay: i * 0.06 }}
                  className="surface rounded-[11px] p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">{step.n}</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="font-display text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Stats / Credibility */}
      <section className="border-b border-border/35 py-10">
        <div className="container">
          <div className="grid gap-px overflow-hidden rounded-[11px] border border-border/45 bg-border/25 md:grid-cols-4">
            {[
              { l: "Total TVL", v: `${fmtUSD(stats.totalTVL, { compact: true })} USDC` },
              { l: "Live vaults", v: String(stats.totalVaults) },
              { l: "Graduated vaults", v: String(stats.graduated) },
              { l: "Protected capital", v: `${fmtUSD(stats.protected, { compact: true })} USDC` },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-background px-6 py-7"
              >
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.l}</div>
                <div className="font-display text-2xl font-bold tabular text-foreground">{s.v}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Marketplace */}
      <section className="border-b border-border/35 py-20">
        <div className="container">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <h2 className="font-display type-h2 font-semibold">Verified traders. Live capital.</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Explore graduated vaults with visible buffers, capital, performance, and activity before making a decision.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:flex">
              <Link to="/vaults">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {featuredVaults.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {featuredVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </div>
          ) : (
            <div className="surface rounded-[11px] p-10 text-center text-muted-foreground">
              No active vaults yet. Connect your wallet and create the first one.
            </div>
          )}
        </div>
      </section>

      {/* 6. Reputation Layer */}
      <section className="relative overflow-hidden border-b border-border/35 py-20">
        <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-primary/[0.06] blur-[100px]" />
        <div className="container relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2
                className="mb-6 font-display font-semibold leading-[1.08] tracking-[-0.022em] text-foreground/95"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}
              >
                Reputation becomes
                <br />
                <span className="text-gradient-signal">capital.</span>
              </h2>
              <p className="max-w-xl text-[1rem] leading-[1.7] text-foreground/68">
                Arcadia turns verified performance into visibility. Traders who build consistent records earn stronger placement, deeper trust, and a clearer path to capital access.
              </p>
            </motion.div>

            <div className="flex flex-col gap-3">
              {[
                { tier: "Paper", desc: "Build a record before investor deposits.", num: "01" },
                { tier: "Graduated", desc: "Open to capital with verified history.", num: "02" },
                { tier: "Proven", desc: "Earn visibility through consistent outcomes.", num: "03" },
                { tier: "Institutional", desc: "Scale access through durable performance.", num: "04" },
              ].map((row, i) => (
                <motion.div
                  key={row.tier}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  className="surface flex items-center gap-4 rounded-[10px] border border-border/60 px-5 py-4 transition-[border-color] hover:border-primary/30"
                >
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/60">{row.num}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 font-display text-[13px] font-semibold text-foreground">{row.tier}</div>
                    <div className="font-mono text-[11px] leading-snug text-muted-foreground">{row.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Projected Outcomes */}
      <VaultCalculator />

      {/* 8. Integrations */}
      <InfiniteSlider />

      {/* 9. FAQ */}
      <section id="faq" className="border-t border-border/35 py-20 scroll-mt-16">
        <div className="container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h2 className="font-display type-h2 font-semibold">Frequently asked questions</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">Concise answers for investors and traders evaluating Arcadia.</p>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <AccordionItem
                  value={`faq-${i}`}
                  className="surface overflow-hidden rounded-[11px] border border-border/50 px-5 transition-[border-color] data-[state=open]:border-primary/25"
                >
                  <AccordionTrigger className="py-4 text-left font-display text-[14px] font-semibold transition-colors hover:text-primary hover:no-underline [&[data-state=open]]:text-primary">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[13px] leading-relaxed text-foreground/75">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="border-t border-border/35 py-20">
        <div className="container">
          <div className="surface-elevated mx-auto max-w-3xl rounded-[11px] p-8 text-center md:p-12">
            <h2 className="font-display type-h2 font-semibold">Start exploring performance-based capital.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Review live vaults or launch a vault to begin building a verified record.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="border-0 bg-primary font-display font-semibold text-primary-foreground hover:bg-primary-glow">
                <Link to="/vaults">
                  Explore Vaults
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-display font-semibold">
                <Link to="/manager/create">Launch Vault</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
