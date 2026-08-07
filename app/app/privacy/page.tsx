import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DriftBlobs, NoiseOverlay, Reveal } from "@/components/acid";
import { Container, Kicker } from "@/components/landing/bits";

const SECTIONS = [
  {
    heading: "What we collect",
    body: "Arcadia reads public on-chain data: wallet activity, token balances, and trading history associated with addresses you connect. We do not collect private keys. When you sign in, we hold only the identifiers your wallet or an auth provider returns.",
  },
  {
    heading: "How we use it",
    body: "On-chain history powers the Arcadia Score and vault records. Account data runs the product: your profile, your waitlist entry, and your access to vaults. We never sell personal data.",
  },
  {
    heading: "Where it lives",
    body: "On-chain records live on the Solana network and are public by design. Anything you post to the chain, including a vault or a score, is visible to anyone. Off-chain product data is stored with our hosting provider.",
  },
  {
    heading: "Cookies and analytics",
    body: "We use minimal analytics to understand how the app performs. You can block these in your browser without losing access to the protocol.",
  },
  {
    heading: "Your choices",
    body: "You can stop using Arcadia at any time and request deletion of the off-chain account data we hold. On-chain records cannot be deleted by anyone, including us; that is a property of public blockchains.",
  },
  {
    heading: "Contact",
    body: "Questions about this policy go through the contact channel on our docs site. We respond to privacy requests directly.",
  },
];

export const metadata = {
  title: "Privacy",
  description: "How Arcadia handles your data.",
};

export default function PrivacyPage() {
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
            <Kicker>Privacy Policy</Kicker>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-none font-bold tracking-[-0.04em] text-ink uppercase">
              Your data, on your terms.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 max-w-[62ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.6] text-muted">
              Last updated August 2026. This page explains what Arcadia reads,
              what we keep, and what is public by design.
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
