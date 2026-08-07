import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DriftBlobs, NoiseOverlay, Reveal } from "@/components/acid";
import { Container, Kicker } from "@/components/landing/bits";

const SECTIONS = [
  {
    heading: "What Arcadia is",
    body: "Arcadia is a protocol that scores on-chain trading history and routes investor capital to traders through non-custodial vaults. It is experimental software running on the Solana network. Nothing on this site is an offer to sell or a solicitation to buy any security, and Arcadia is not a registered broker or advisor.",
  },
  {
    heading: "No financial advice",
    body: "Scores, tiers, and vault metrics describe past on-chain activity. They are not a guarantee of future returns. Trading involves risk, and allocated capital can lose value. Do your own diligence before depositing.",
  },
  {
    heading: "Risks",
    body: "Smart contracts can contain bugs, markets can behave unpredictably, and blockchain activity is irreversible. The protocol can stop capital being stolen, but it cannot stop trades losing money. Losses are shared proportionally among vault holders, and each vault enforces its own drawdown floor.",
  },
  {
    heading: "Non-custody",
    body: "Investor capital is held by the vault contract, under protocol rules. Traders manage positions within those rules but cannot withdraw deposits. Verify every contract and address before interacting.",
  },
  {
    heading: "Your responsibilities",
    body: "You are responsible for the security of your wallet and private keys. Anyone with your keys controls your funds. Never share them, and treat any request for them as a scam.",
  },
  {
    heading: "No warranty",
    body: "The protocol is provided as is, without warranty of any kind. To the maximum extent permitted by law, we are not liable for losses arising from use of the protocol, including smart-contract failures, market losses, or network issues.",
  },
  {
    heading: "Changes",
    body: "These terms may change as the protocol evolves. Significant changes will be posted here.",
  },
];

export const metadata = {
  title: "Terms",
  description: "The terms that govern your use of Arcadia.",
};

export default function TermsPage() {
  return (
    <>
      <NoiseOverlay />
      <DriftBlobs />

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-[1180px] px-5 pt-6 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs tracking-[0.12em] text-faint uppercase transition-colors hover:text-acid"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back
          </Link>
        </div>

        <section className="mx-auto max-w-[1180px] px-5 py-[clamp(3rem,8vh,6rem)] sm:px-8">
          <Reveal>
            <Kicker>Terms of Service</Kicker>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-none font-bold tracking-[-0.04em] text-ink uppercase">
              Terms, stated plainly.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 max-w-[62ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-muted">
              Last updated August 2026. By using Arcadia you accept these terms
              and the risks described below.
            </p>
          </Reveal>
        </section>

        <section className="pb-[clamp(5rem,10vw,8rem)]">
          <Container>
            <div className="mx-auto grid max-w-3xl gap-5">
              {SECTIONS.map((section, i) => (
                <Reveal key={section.heading} delay={i * 40}>
                  <article className="rounded-2xl border border-white/10 bg-panel p-6">
                    <h2 className="mb-2 font-mono text-sm font-bold tracking-[0.08em] text-acid uppercase">
                      {section.heading}
                    </h2>
                    <p className="text-[1rem] leading-[1.7] text-muted">{section.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
