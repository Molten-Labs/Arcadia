import { useMemo, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { fmtUSD } from "@/lib/format";
import {
  ArrowRight, Shield, Activity,
  TrendingUp, Users, ChevronRight, ChevronDown,
  Award, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { PriceTicker } from "@/components/PriceTicker";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_094440_a3592600-bd1e-49e5-9bce-a73662061d83.mp4";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};


const FAQ_ITEMS = [
  { q: "What is junior capital?",                     a: "The trader's own money, posted as first-loss collateral. If the vault loses money, the junior buffer absorbs losses before any investor capital is touched." },
  { q: "What happens if a vault freezes?",            a: "Trading is permanently disabled. Investors can withdraw any remaining liquidity. The trader's on-chain reputation is reduced significantly." },
  { q: "When can I withdraw?",                        a: "Standard withdrawals settle after a 24-hour cooldown. If junior health drops below 20%, withdrawals become instant." },
  { q: "How are performance fees calculated?",        a: "Traders earn 15-20% only on gains above the previous high-water mark. No fees during drawdowns or flat performance." },
  { q: "Is Arcadia custodial?",                       a: "No. Arcadia is a non-custodial protocol on Solana. You sign every transaction with your own wallet." },
  { q: "Why does paper mode exist?",                  a: "It forces every new trader to build a public, on-chain track record using only their own capital before they can attract investor deposits." },
  { q: "How does the junior buffer protect me?",      a: "The trader's junior capital always absorbs losses first. Investor (senior) capital is only at risk once the entire junior buffer is wiped out." },
  { q: "Can I see the vault trade history?",          a: "Yes. All trades are recorded on-chain and visible on the vault detail page, including NAV impact and position history." },
];

const FLOW_STEPS = [
  {
    n: "01", icon: Award,      accent: "neutral" as const,
    title: "Trader puts money in first",
    body:  "Junior capital is posted on-chain before the vault opens. Real skin in the game.",
  },
  {
    n: "02", icon: Activity,   accent: "neutral" as const,
    title: "30 days, publicly tracked",
    body:  "Every trade recorded on-chain. No pitch decks — real performance anyone can verify.",
  },
  {
    n: "03", icon: Users,      accent: "neutral" as const,
    title: "Vault opens to investors",
    body:  "After graduation, investors buy in with USDC. The vault is now live and capitalized.",
  },
  {
    n: "04", icon: TrendingUp, accent: "positive" as const,
    title: "Profits → shares worth more",
    body:  "NAV rises, each share is worth more. The trader earns a cut only above the high-water mark.",
  },
  {
    n: "05", icon: Shield,     accent: "warning" as const,
    title: "Losses hit the trader first",
    body:  "Any drawdown burns through the junior buffer first. Your USDC is last in line — always.",
  },
  {
    n: "06", icon: ChevronUp,  accent: "neutral" as const,
    title: "Exit anytime",
    body:  "Small withdrawals settle instantly. Large ones queue to protect remaining investors.",
  },
];

const Landing = () => {
  const { data: vaults } = useVaults();
  const allVaults = useMemo(() => vaults ?? [], [vaults]);
  const carouselRef = useRef<HTMLDivElement>(null);

  const activeVaults = useMemo(
    () => allVaults.filter((v) => v.status === "active" || v.status === "paper"),
    [allVaults],
  );

  const carouselVaults = useMemo(
    () => activeVaults.length > 0 ? [...activeVaults, ...activeVaults, ...activeVaults] : [],
    [activeVaults],
  );

  const stats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL:    allVaults.reduce((s, v) => s + v.tvl, 0),
    graduated:   allVaults.filter((v) => v.status !== "paper").length,
    protected:   allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[calc(100dvh-3.75rem)] overflow-hidden border-b border-border/35">
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-[0.58] saturate-[0.75]"
          src={HERO_VIDEO}
          autoPlay muted loop playsInline preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.60)_0%,hsl(var(--background)/0.28)_40%,hsl(var(--background)/0.88)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.70)_30%,hsl(var(--background)/0.18)_62%,hsl(var(--background)/0.72)_100%)]" />
        <div className="absolute inset-0 arcadia-glow opacity-50" />
        <div className="absolute inset-0 hairline-grid opacity-[0.08]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-none absolute top-32 right-[18%] h-64 w-64 rounded-full bg-primary/[0.08] blur-[72px] signal-orb-1" />
        <div className="pointer-events-none absolute top-48 right-[36%] h-40 w-40 rounded-full bg-primary-deep/10 blur-[52px] signal-orb-2" />

        <div className="container relative flex min-h-[calc(100dvh-3.75rem)] flex-col justify-center py-16 md:py-24">
          <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="max-w-[720px]"
          >
            <motion.div variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border/50 rounded-md px-2 py-1">
                Proof-of-Performance
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp} custom={1}
              className="font-display font-semibold text-foreground/95 leading-[1.04] tracking-[-0.025em]"
              style={{ fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)" }}
            >
              Capital Protocol
              <br />
              on Solana.
            </motion.h1>

            <motion.p
              variants={fadeUp} custom={2}
              className="mt-6 max-w-lg text-[1.05rem] leading-[1.65] text-foreground/72"
            >
              Arcadia is a Solana protocol where traders build verified on-chain
              track records before accessing investor capital, creating a transparent
              and aligned system for active capital allocation.
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
                <a href="#how-it-works">
                  How it works <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </a>
              </Button>
            </motion.div>
          </motion.div>

          <motion.a
            href="#how-it-works"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </motion.a>
        </div>
      </section>

      {/* Ticker */}
      <PriceTicker />
      <InfiniteSlider />

      {/* Stats */}
      <section className="border-b border-border/35 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container py-9 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/25">
          {[
            { l: "Total TVL",         v: `${fmtUSD(stats.totalTVL, { compact: true })} USDC` },
            { l: "Live vaults",       v: String(stats.totalVaults) },
            { l: "Graduated",         v: String(stats.graduated) },
            { l: "Protected capital", v: `${fmtUSD(stats.protected, { compact: true })} USDC` },
          ].map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.07 }}
              className="bg-background px-6 py-7"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{s.l}</div>
              <div className="font-display font-bold text-2xl tabular text-foreground">{s.v}</div>
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </section>

      {/* Featured vaults carousel */}
      <section className="py-16 border-b border-border/35 overflow-hidden">
        <div className="container mb-8 flex items-end justify-between">
          <div>
            <span className="page-header-label">Marketplace</span>
            <h2 className="font-display type-h2 font-semibold mt-3">Featured vaults</h2>
            <p className="text-muted-foreground mt-1 text-[14px]">Top-performing graduated vaults open for deposits.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hidden sm:flex shrink-0">
            <Link to="/vaults">View all <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />

          {carouselVaults.length > 0 ? (
            <div
              ref={carouselRef}
              className="flex gap-4 animate-vault-carousel"
              style={{ width: "max-content" }}
            >
              {carouselVaults.map((v, i) => (
                <div key={`${v.id}-${i}`} className="w-[300px] shrink-0">
                  <VaultCard vault={v} />
                </div>
              ))}
            </div>
          ) : (
            <div className="container">
              <div className="surface rounded-[11px] p-12 text-center text-muted-foreground">
                <p className="text-sm">No vaults yet. Connect your wallet and create the first one.</p>
                <Button asChild size="sm" className="mt-4 bg-primary text-primary-foreground border-0">
                  <Link to="/manager/create">Create vault</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="container mt-5 flex sm:hidden">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/vaults">View all vaults <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>
      </section>

      {/* Calculator */}
      <VaultCalculator />

      {/* Capital flow diagram */}
      <section id="how-it-works" className="border-t border-border/35 py-20 scroll-mt-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <span className="page-header-label">Protocol guide</span>
            <h2 className="font-display type-h2 font-semibold mt-3">How Arcadia works</h2>
            <p className="text-muted-foreground mt-2 max-w-md">Follow a vault from first deposit to investor exit.</p>
          </motion.div>

          {/* ── Desktop snake layout ─────────────────────── */}
          <div className="hidden lg:block">
            {/* Row 1: steps 01–03 */}
            <div className="grid items-stretch" style={{ gridTemplateColumns: "1fr 44px 1fr 44px 1fr" }}>
              {FLOW_STEPS.slice(0, 3).flatMap((step, i) => {
                const Icon = step.icon;
                const els = [
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.13 }}
                    className="surface rounded-[11px] p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-primary/25 transition-[border-color]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">{step.n}</span>
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <h3 className="font-display font-semibold text-[13px] leading-snug">{step.title}</h3>
                    <p className="text-[12px] text-muted-foreground leading-relaxed flex-1">{step.body}</p>
                  </motion.div>,
                ];
                if (i < 2) {
                  els.push(
                    <motion.div
                      key={`r1-conn-${i}`}
                      className="flex items-center justify-center"
                      initial={{ opacity: 0, scaleX: 0 }} whileInView={{ opacity: 1, scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: i * 0.13 + 0.28 }}
                      style={{ originX: 0 }}
                    >
                      <div className="w-full h-px bg-primary/30 relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[4px] border-y-transparent border-l-[6px] border-l-primary/50" />
                      </div>
                    </motion.div>
                  );
                }
                return els;
              })}
            </div>

            {/* Corner: down connector on the far right */}
            <div className="flex justify-end">
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }} whileInView={{ opacity: 1, scaleY: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.55 }}
                style={{ originY: 0 }}
                className="flex flex-col items-center w-[calc(33.333%)]"
              >
                <div className="w-px h-8 bg-primary/30 relative">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-x-[4px] border-x-transparent border-t-[6px] border-t-primary/50" />
                </div>
              </motion.div>
            </div>

            {/* Row 2: steps 04–06 */}
            <div className="grid items-stretch" style={{ gridTemplateColumns: "1fr 44px 1fr 44px 1fr" }}>
              {FLOW_STEPS.slice(3).flatMap((step, i) => {
                const Icon = step.icon;
                const isPositive = step.accent === "positive";
                const isWarning  = step.accent === "warning";
                const els = [
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.4 + i * 0.13 }}
                    className={cn(
                      "rounded-[11px] p-5 flex flex-col gap-3 relative overflow-hidden group transition-[border-color]",
                      isPositive && "bg-primary/[0.05] border border-primary/20 hover:border-primary/35",
                      isWarning  && "bg-warning/[0.05] border border-warning/20 hover:border-warning/35",
                      !isPositive && !isWarning && "surface hover:border-primary/25",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.15em]",
                        isWarning ? "text-warning" : "text-primary"
                      )}>{step.n}</span>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        isWarning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <h3 className="font-display font-semibold text-[13px] leading-snug">{step.title}</h3>
                    <p className="text-[12px] text-muted-foreground leading-relaxed flex-1">{step.body}</p>
                    {isPositive && (
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                    )}
                    {isWarning && (
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-warning/40 to-transparent" />
                    )}
                  </motion.div>,
                ];
                if (i < 2) {
                  els.push(
                    <motion.div
                      key={`r2-conn-${i}`}
                      className="flex items-center justify-center"
                      initial={{ opacity: 0, scaleX: 0 }} whileInView={{ opacity: 1, scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: 0.4 + i * 0.13 + 0.28 }}
                      style={{ originX: 0 }}
                    >
                      <div className="w-full h-px bg-primary/30 relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[4px] border-y-transparent border-l-[6px] border-l-primary/50" />
                      </div>
                    </motion.div>
                  );
                }
                return els;
              })}
            </div>
          </div>

          {/* ── Mobile vertical list ─────────────────────── */}
          <div className="lg:hidden flex flex-col gap-0">
            {FLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isPositive = step.accent === "positive";
              const isWarning  = step.accent === "warning";
              const isLast = i === FLOW_STEPS.length - 1;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex gap-4"
                >
                  {/* Left: number + connector line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold shrink-0 z-10",
                      isWarning  ? "bg-warning/15 text-warning border border-warning/30" :
                      isPositive ? "bg-primary/15 text-primary border border-primary/30" :
                                   "bg-secondary text-muted-foreground border border-border"
                    )}>
                      {i + 1}
                    </div>
                    {!isLast && (
                      <div className={cn(
                        "w-px flex-1 my-1",
                        isWarning ? "bg-warning/20" : "bg-primary/20"
                      )} />
                    )}
                  </div>

                  {/* Right: card */}
                  <div className={cn(
                    "rounded-[11px] p-4 mb-3 flex-1",
                    isPositive && "bg-primary/[0.05] border border-primary/20",
                    isWarning  && "bg-warning/[0.05] border border-warning/20",
                    !isPositive && !isWarning && "surface",
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center",
                        isWarning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                      )}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <h3 className="font-display font-semibold text-[13px]">{step.title}</h3>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/35 py-20 scroll-mt-16">
        <div className="container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <span className="page-header-label">Common questions</span>
            <h2 className="font-display type-h2 font-semibold mt-3">Frequently asked</h2>
            <p className="text-muted-foreground mt-2 text-[14px]">
              Everything investors and traders need to know before getting started.
            </p>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <AccordionItem
                  value={`faq-${i}`}
                  className="surface rounded-[11px] border border-border/50 px-5 data-[state=open]:border-primary/25 transition-[border-color] overflow-hidden"
                >
                  <AccordionTrigger className="font-display font-semibold text-[14px] text-left py-4 hover:no-underline hover:text-primary transition-colors [&[data-state=open]]:text-primary">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] text-foreground/75 leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>

          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 flex flex-wrap gap-3 justify-center"
          >
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow border-0 font-display font-semibold">
              <Link to="/vaults">
                Open marketplace <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/traders">Explore traders</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
