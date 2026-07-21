import Link from "next/link";
import { ArrowLeft, BarChart3, Shield, TrendingUp, Users, Zap } from "lucide-react";

import { DriftBlobs, NoiseOverlay, Reveal } from "@/components/acid";
import { Container, Kicker, SectionHeading } from "@/components/landing/bits";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

const BENEFITS = [
  { icon: BarChart3, title: "Verify your track record", desc: "Turn on-chain history into a portable reputation score that investors trust." },
  { icon: Shield, title: "Non-custodial vaults", desc: "Investor capital sits in smart-contract vaults, not wallets." },
  { icon: TrendingUp, title: "Earn what you're worth", desc: "Higher score unlocks more allocation. On-chain profit sharing." },
  { icon: Users, title: "Back proven talent", desc: "Real scores, real records. Allocate through vaults, not promises." },
];

const HOW_IT_WORKS = [
  { n: "01", title: "Connect your wallet", body: "Arcadia reads your on-chain history into a verified reputation profile." },
  { n: "02", title: "Build your score", body: "Consistent, risk-aware performance raises your Arcadia Score." },
  { n: "03", title: "Open a vault", body: "Fund with your own capital first, then earn allocations from investors." },
  { n: "04", title: "Share in the upside", body: "When the vault performs, profits are shared on-chain." },
];

const FAQ = [
  { q: "What is Arcadia?", a: "The allocation rail for on-chain trading talent. Real trading history becomes verified reputation; investor capital flows through smart-contract vaults." },
  { q: "How does the Arcadia Score work?", a: "A 0-1000 reputation metric built from real trading data — consistency, risk control, drawdown, and performance. Higher scores unlock more allocation." },
  { q: "Can a trader run away with investor funds?", a: "No. Investor capital goes into a smart-contract vault, not the trader's wallet. Traders can trade but cannot withdraw investor capital." },
  { q: "When does Arcadia launch?", a: "We're in private beta. Join the waitlist for early access." },
];

export default function WaitlistPage() {
  return (
    <>
      <NoiseOverlay />
      <DriftBlobs />

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-[1180px] px-5 pt-6 sm:px-8">
          <Link href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs tracking-[0.12em] text-faint uppercase transition-colors hover:text-acid">
            <ArrowLeft className="size-3.5" aria-hidden /> Back
          </Link>
        </div>

        {/* Hero */}
        <section className="mx-auto max-w-[1180px] px-5 py-[clamp(3rem,8vh,6rem)] sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <Reveal><Kicker>Private beta</Kicker></Reveal>
              <Reveal delay={80}>
                <h1 className="mt-5 font-display text-[clamp(2.5rem,8vw,5rem)] leading-[0.9] font-extrabold tracking-[-0.04em] text-ink uppercase">
                  Get early<br /><span className="text-acid">access.</span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-5 max-w-[48ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-muted">
                  Arcadia turns on-chain trading history into verified reputation.
                  Investors allocate through non-custodial vaults.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  {BENEFITS.map((b) => (
                    <div key={b.title} className="rounded-xl border border-white/10 bg-panel/60 p-4 backdrop-blur-sm">
                      <b.icon className="mb-2 size-4 text-acid" aria-hidden />
                      <h3 className="mb-1 text-sm font-bold text-ink">{b.title}</h3>
                      <p className="text-xs leading-relaxed text-muted">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal delay={240}>
              <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
                <h2 className="mb-1 font-display text-xl font-extrabold text-ink">Join the waitlist</h2>
                <p className="mb-6 text-sm text-muted">Be first to know when vaults open.</p>
                <WaitlistForm />
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-white/10 py-[clamp(4rem,8vw,7rem)]">
          <Container>
            <Reveal><Kicker>How it works</Kicker></Reveal>
            <Reveal delay={80}>
              <SectionHeading className="mt-4 mb-10">From trader to&nbsp;allocated.</SectionHeading>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((step) => (
                <Reveal key={step.n} delay={160}>
                  <div className="group acid-int rounded-[18px] border border-white/10 bg-gradient-to-br from-panel/90 to-void/85 p-[1.375rem] h-full">
                    <span className="mb-3.5 grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-acid font-mono text-sm font-bold text-void transition-transform duration-300 group-hover:scale-105">
                      {step.n}
                    </span>
                    <h4 className="mb-2 text-[1.02rem] leading-[1.3] font-bold text-ink">{step.title}</h4>
                    <p className="text-[0.92rem] text-muted">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="pb-[clamp(5rem,10vw,8rem)]">
          <Container>
            <Reveal><Kicker>FAQ</Kicker></Reveal>
            <Reveal delay={80}>
              <SectionHeading className="mt-4 mb-10">Questions?</SectionHeading>
            </Reveal>
            <div className="grid gap-3 max-w-3xl">
              {FAQ.map((item) => (
                <Reveal key={item.q} delay={120}>
                  <details className="group rounded-xl border border-white/10 bg-panel/60 transition-colors open:border-acid/30">
                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-mono text-sm font-bold text-ink tracking-[-0.01em] list-none">
                      {item.q}
                      <Zap className="size-3.5 text-faint transition-transform duration-300 group-open:rotate-45 group-open:text-acid" aria-hidden />
                    </summary>
                    <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
