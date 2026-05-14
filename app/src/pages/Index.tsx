import { useMemo, useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { VaultCarousel } from "@/components/VaultCarousel";
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
  Copy,
  Check,
  ExternalLink,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InfiniteSlider } from "@/components/InfiniteSlider";
import { VaultCalculator } from "@/components/VaultCalculator";
import { DevnetUsdcFaucet } from "@/components/DevnetUsdcFaucet";
import { toast } from "sonner";

const PROGRAM_ID = "49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN";

const DevnetSection = () => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(PROGRAM_ID);
    setCopied(true);
    toast.success("Program ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      n: "01",
      title: "Get devnet SOL",
      body: "Use the Solana faucet to airdrop SOL to your wallet for gas fees.",
      href: "https://faucet.solana.com",
      cta: "Solana faucet →",
    },
    {
      n: "02",
      title: "Get devnet USDC",
      body: "Connect a devnet wallet, then request Arcadia demo USDC from the wallet menu for vault deposits.",
      href: "/vaults",
      cta: "Open marketplace →",
    },
    {
      n: "03",
      title: "Create or deposit",
      body: "Create a vault as a trader, or deposit into a graduated vault as an investor.",
      href: "/vaults",
      cta: "Open marketplace →",
    },
  ];

  return (
    <section className="border-b border-border/35 py-20">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse-glow" />
              Live on Solana Devnet
            </span>
            <h2 className="font-display type-h2 font-semibold">Try Arcadia on devnet</h2>
            <p className="mt-2 text-muted-foreground max-w-xl">
              The full protocol is deployed on Solana devnet. Get test tokens and try the complete flow — from vault creation to senior deposit.
            </p>
          </div>
        </motion.div>

        {/* Program ID card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="surface rounded-[11px] p-5 mb-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Program ID · Solana Devnet</div>
            <div className="font-mono text-[12px] text-foreground break-all">{PROGRAM_ID}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-secondary/50 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-secondary/50 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Explorer
            </a>
          </div>
        </motion.div>

        {/* 3-step guide */}
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.42, delay: i * 0.08 }}
              className="surface rounded-[11px] p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">{step.n}</span>
                <Zap className="w-4 h-4 text-primary/40" />
              </div>
              <h3 className="font-display text-base font-semibold mb-2">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">{step.body}</p>
              <div className="mt-4">
                {step.href.startsWith("http") ? (
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-primary hover:text-primary-glow transition-colors"
                  >
                    {step.cta}
                  </a>
                ) : (
                  <Link to={step.href} className="font-mono text-[11px] text-primary hover:text-primary-glow transition-colors">
                    {step.cta}
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="mt-4"
        >
          <DevnetUsdcFaucet />
        </motion.div>
      </div>
    </section>
  );
};

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
      {
        problem: "No way to raise capital without a fund structure or personal brand",
        solution: "Any trader can create a vault and build a verifiable on-chain track record from scratch",
      },
      {
        problem: "Strategy exposed on-chain the moment a trade executes",
        solution: "Private intent execution hides route, size, and timing while still proving the trade was safe",
      },
      {
        problem: "Front-running and copy-trading destroy edge before positions close",
        solution: "Trade details never touch the blockchain so no one can read and replicate the strategy",
      },
      {
        problem: "No credible proof of past performance to show potential investors",
        solution: "Every trade in paper mode is recorded publicly and permanently on Solana",
      },
      {
        problem: "Fees depend on goodwill and informal agreements",
        solution: "Performance fees above the high-water mark are enforced and claimed automatically by the program",
      },
    ],
  },
  {
    title: "For Investors",
    items: [
      {
        problem: "No way to verify a trader's track record before depositing",
        solution: "Graduation requires 30 days of positive on-chain performance before a vault can accept investor capital",
      },
      {
        problem: "Manager earns fees on wins but does not absorb losses",
        solution: "Trader capital sits in the junior tranche and takes every loss before investor capital is touched",
      },
      {
        problem: "Stuck waiting for the trader to unwind positions before withdrawing",
        solution: "Investors withdraw their pro-rata share of every token in the vault instantly without asking anyone",
      },
      {
        problem: "Trader can deploy all capital into risky positions with no floor",
        solution: "The vault guard enforces a hard 20% liquid reserve on every swap so there is always capital available to exit",
      },
      {
        problem: "No way to know if risk rules are being followed when strategy is private",
        solution: "The guard result of every trade is recorded publicly on-chain even when the trade details stay private",
      },
      {
        problem: "Custody risk when handing control to a managed product",
        solution: "The vault is non-custodial and every rule is enforced by the program with no operator override",
      },
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

const HERO_FLOW = [
  {
    value: "01",
    label: "Trader proves",
    body: "Trades in proof mode for 30 days, building a public performance record and reputation before touching investor capital.",
  },
  {
    value: "02",
    label: "Vault opens",
    body: "If profitable and credible, the vault opens with the trader’s first-loss junior capital targeting 20% and investors supplying up to 80% senior capital.",
  },
  {
    value: "03",
    label: "Capital aligns",
    body: "Investors access verified managers. If losses occur, trader capital absorbs them first; if performance holds, capable traders can scale earnings.",
  },
];

const ProblemCard = ({
  column,
  index,
}: {
  column: (typeof PROBLEM_COLUMNS)[number];
  index: number;
}) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-xl border border-border/55 bg-card/72 p-6 shadow-card backdrop-blur-xl"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {index === 0 ? "Supply side" : "Demand side"}
          </p>
          <h3 className="mt-2 font-display type-h3 font-semibold">{column.title}</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          {index === 0 ? <TrendingUp className="h-5 w-5" aria-hidden="true" /> : <Shield className="h-5 w-5" aria-hidden="true" />}
        </div>
      </div>
      <ul className="space-y-2">
        {column.items.map((item, itemIndex) => {
          const isOpen = expanded === itemIndex;
          return (
            <motion.li
              key={item.problem}
              initial={{ opacity: 0, x: index === 0 ? -10 : 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.38, delay: index * 0.08 + 0.18 + itemIndex * 0.08 }}
              className="overflow-hidden rounded-lg border border-border/35 bg-background/45"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : itemIndex)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm text-foreground/78 transition-colors hover:text-foreground/95"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
                <span className="flex-1 leading-snug">{item.problem}</span>
                <ChevronDown
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="solution"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 border-t border-primary/15 bg-primary/5 px-3 py-2.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="text-[12px] leading-relaxed text-primary/85">{item.solution}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
};

const Landing = () => {
  const { data: vaults } = useVaults();
  const allVaults = useMemo(() => vaults ?? [], [vaults]);

  const featuredVaults = useMemo(
    () => allVaults.filter((v) => v.status === "active"),
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
      <section className="grid-bg relative min-h-[calc(100dvh-3.75rem)] overflow-hidden border-b border-border/40">
        <video
          className="hero-video absolute inset-0 h-full w-full object-cover opacity-[0.36] saturate-[0.86] contrast-[1.05] dark:opacity-[0.66]"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_55%_20%,hsl(var(--primary-glow)/0.22),transparent_68%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.18)_0%,hsl(var(--background)/0.62)_78%,hsl(var(--background))_100%)] dark:bg-[linear-gradient(180deg,hsl(var(--background)/0.42)_0%,hsl(var(--background)/0.18)_42%,hsl(var(--background)/0.88)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.88)_0%,hsl(var(--background)/0.62)_37%,hsl(var(--background)/0.22)_63%,hsl(var(--background)/0.56)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--background)/0.94)_0%,hsl(var(--background)/0.66)_34%,hsl(var(--background)/0.14)_62%,hsl(var(--background)/0.58)_100%)]" />
        <div className="absolute inset-0 arcadia-glow opacity-85 dark:opacity-70" />
        <div className="absolute left-1/2 top-[12%] hidden h-[28rem] w-[28rem] -translate-x-[8%] rounded-full bg-primary/[0.10] blur-[118px] md:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="container relative flex min-h-[calc(100dvh-3.75rem)] flex-col justify-center py-16 md:py-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="w-full"
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse-glow" />
                Proof-of-Performance · Solana
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="max-w-[960px] font-display font-bold leading-[0.92] tracking-[-0.055em] text-foreground/95"
              style={{ fontSize: "clamp(3.35rem, 8.2vw, 7rem)" }}
            >
              Proven traders.
              <br />
              <span className="text-gradient-signal">Protected capital.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-7 max-w-2xl text-[1.1rem] leading-[1.65] text-foreground/78 md:text-[1.25rem]"
            >
              Arcadia is where traders prove themselves with their own money before touching investor capital. They lose first when trades go wrong. No trust required. Code enforces it.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 border-0 bg-primary font-display font-semibold text-primary-foreground shadow-signal hover:bg-primary-glow">
                <Link to="/vaults">
                  Open marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 border-border/60 font-display font-semibold hover:bg-secondary/60">
                <Link to="/manager">Trader console</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-11 font-display font-semibold text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                <a href="#how-it-works">
                  See how it works <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={4}
              className="relative mt-12 ml-[calc(50%-50vw)] w-screen"
            >
              <div className="apex-terminal arcadia-flow-panel mx-4 rounded-xl sm:mx-6 lg:mx-10">
                <div className="flex w-full items-center justify-between border-b border-border/60 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:px-8 lg:px-12">
                  <span>&gt; arcadia.flow</span>
                  <span>20 / 80 capital model</span>
                </div>
                <div className="grid w-full divide-y divide-border/60 bg-border/40 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                  {HERO_FLOW.map((item) => (
                    <div key={item.label} className="flow-step-cell bg-background/95 px-5 py-6 sm:px-8 lg:min-h-[13rem] lg:px-12">
                      <div className="font-display text-4xl font-bold leading-none tracking-[-0.04em] text-primary md:text-5xl">{item.value}</div>
                      <div className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                      <p className="mt-4 max-w-[28rem] text-sm leading-6 text-foreground/75">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* 2+3. Problems → Arcadia Gate → How It Works (merged flow) */}
      <section id="problem-solution" className="relative overflow-hidden border-b border-border/35 py-24 scroll-mt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,hsl(var(--primary)/0.12),transparent_36rem)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div className="container relative">

          {/* ── Problems header ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-3xl text-center"
          >
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">The problem</p>
            <h2 className="font-display type-h2 font-semibold">The way capital is allocated today is broken.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Skilled managers and cautious capital meet through weak signals. Arcadia turns proof, buffers, and liquidity into the interface.
            </p>
          </motion.div>

          {/* ── Problem cards ─────────────────────────────────────────────── */}
          <div className="mx-auto grid max-w-6xl items-stretch gap-4 lg:grid-cols-2">
            <ProblemCard column={PROBLEM_COLUMNS[0]} index={0} />
            <ProblemCard column={PROBLEM_COLUMNS[1]} index={1} />
          </div>

          {/* ── Arcadia Gate connector ────────────────────────────────────── */}
          <div className="relative my-16 flex flex-col items-center" id="how-it-works">
            {/* Line from problems down to gate */}
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              style={{ originY: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="h-10 w-px bg-gradient-to-b from-border/30 to-primary/60"
            />

            {/* Gate box — "Arcadia replaces trust with performance" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.86 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.28, type: "spring", stiffness: 300, damping: 24 }}
              className="relative z-10 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-6 py-4 shadow-[0_0_80px_hsl(var(--primary)/0.18)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-signal">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/70 mb-0.5">Arcadia layer</p>
                <p className="font-display text-[15px] font-semibold leading-tight text-primary">Replaces trust with performance.</p>
              </div>
            </motion.div>

            {/* Animated flowing dots pointing down */}
            <div className="mt-3 flex flex-col items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{ opacity: [0.15, 0.95, 0.15], y: [0, 5, 0] }}
                  transition={{ duration: 1.0, delay: i * 0.28, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>

            {/* "How Arcadia solves it" sub-header */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.42 }}
              className="mt-8 text-center"
            >
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">How Arcadia solves it</p>
              <h3
                className="font-display font-semibold leading-[1.1] tracking-[-0.022em] text-foreground/95"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)" }}
              >
                Six steps from proof to capital.
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Each step enforces the next. Performance unlocks trust. Trust unlocks capital.
              </p>
            </motion.div>
          </div>

          {/* ── Solution step cards ───────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.42, delay: i * 0.07 }}
                  className="surface rounded-[11px] p-5 border border-border/40 transition-[border-color] hover:border-primary/20"
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

          {featuredVaults.length === 0 && (
            <div className="surface rounded-[11px] p-10 text-center text-muted-foreground">
              No active vaults yet. Connect your wallet and create the first one.
            </div>
          )}
        </div>

        {featuredVaults.length > 0 && (
          <div className="mt-2">
            <VaultCarousel vaults={featuredVaults} />
          </div>
        )}
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

      {/* 7b. Try it on Devnet */}
      <DevnetSection />

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
              <Button asChild size="lg" variant="ghost" className="font-display font-semibold text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                <Link to="/demo-control">View Surfpool Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Landing;
