import Link from "next/link";
import { ArrowLeft, BarChart3, Shield, TrendingUp, Zap } from "lucide-react";

import { DriftBlobs, NoiseOverlay, Reveal } from "@/components/acid";
import { Container, Kicker, SectionHeading } from "@/components/landing/bits";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

const BENEFITS = [
  { icon: BarChart3, title: "verify your track record", desc: "your history becomes a portable score. investors see it, not your word for it." },
  { icon: Shield, title: "non-custodial vaults", desc: "capital sits in the contract. never in a wallet, never in your hands." },
  { icon: TrendingUp, title: "earn what you prove", desc: "higher score, more allocation. profit splits on-chain, automatically." },
];

const HOW_IT_WORKS = [
  { n: "01", title: "connect wallet", body: "arcadia reads your on-chain history in." },
  { n: "02", title: "build your score", body: "consistent, risk-aware performance moves the number up." },
  { n: "03", title: "open a vault", body: "fund it yourself first. investors follow the proof." },
  { n: "04", title: "split the upside", body: "vault performs, everyone gets paid on-chain." },
];

const FAQ = [
  { q: "what is arcadia?", a: "a protocol that turns on-chain trading history into a reputation score, then lets investors allocate through non-custodial vaults built on that score." },
  { q: "how does the arcadia score work?", a: "it reads consistency and risk-adjusted performance from your on-chain history. no self-reporting, no manual review." },
  { q: "can a trader run off with investor funds?", a: "no. capital never leaves the vault contract. traders trade it, they don't hold it." },
  { q: "when does arcadia launch?", a: "private beta first. waitlist gets access before anyone else." },
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

        {/* Hero — content left, form right */}
        <section className="mx-auto max-w-[1180px] px-5 py-[clamp(3rem,8vh,6rem)] sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[1fr_400px] lg:items-start">
            <div>
              <Reveal><Kicker>private beta</Kicker></Reveal>
              <Reveal delay={80}>
                <h1 className="mt-5 font-display text-[clamp(2.5rem,8vw,5rem)] leading-[0.9] font-extrabold tracking-[-0.04em] text-ink uppercase">
                  turn trading<br /><span className="text-acid">into capital.</span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-5 max-w-[56ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-muted">
                  arcadia reads your on-chain history and turns it into<br />
                  reputation investors can actually check.
                </p>
                <p className="mt-2 text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-muted">
                  no pitch decks. no screenshots. the chain doesn&apos;t lie.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="mt-10 grid gap-3 sm:grid-cols-3">
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
              <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
                <p className="mb-4 font-display text-lg font-extrabold text-ink">join the waitlist</p>
                <WaitlistForm source="waitlist-page" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-white/10 py-[clamp(4rem,8vw,7rem)]">
          <Container>
            <Reveal><Kicker>how it works</Kicker></Reveal>
            <Reveal delay={80}>
              <SectionHeading className="mt-4 mb-10">trader to&nbsp;allocated.</SectionHeading>
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
            <Reveal><Kicker>faq</Kicker></Reveal>
            <Reveal delay={80}>
              <SectionHeading className="mt-4 mb-10">questions?</SectionHeading>
            </Reveal>
            <div className="grid gap-3 max-w-3xl mx-auto">
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
