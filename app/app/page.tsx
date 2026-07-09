import { DriftBlobs, NoiseOverlay, Reveal } from "@/components/acid";
import { AllocationRail } from "@/components/landing/AllocationRail";
import { Container, Kicker, SectionHeading } from "@/components/landing/bits";
import { DualCta } from "@/components/landing/DualCta";
import { Faq } from "@/components/landing/Faq";
import { FlowSection } from "@/components/landing/FlowSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { LiveLeaderboard } from "@/components/landing/LiveLeaderboard";
import { TheScore } from "@/components/landing/TheScore";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { TwoSides } from "@/components/landing/TwoSides";

/**
 * Arcadia landing (Acid Graphic). Server component: static marketing sections
 * render on the server for first paint; the only client islands are the live
 * leaderboard query and the tab/accordion interactions.
 * Aggressive skin (chrome, blobs, marquees, big numbers), readable core.
 */
export default function LandingPage() {
  return (
    <>
      <NoiseOverlay />
      <DriftBlobs />

      <div className="relative z-10">
        <LandingNav />

        <div id="top">
          <HeroSection />
          <TrustStrip />
          <FlowSection />
          <AllocationRail />
          <TheScore />

          <section aria-label="Two sides" className="py-[clamp(5rem,12vw,10rem)]">
            <Container>
              <Reveal>
                <Kicker>Two Sides</Kicker>
              </Reveal>
              <Reveal delay={80}>
                <SectionHeading className="mt-4 mb-[clamp(1.5rem,3vw,2.5rem)]">
                  Two sides, one allocation rail.
                </SectionHeading>
              </Reveal>
              <TwoSides />
            </Container>
          </section>

          <LiveLeaderboard />

          <section id="faq" aria-label="Frequently asked questions" className="py-[clamp(5rem,12vw,10rem)]">
            <Container>
              <Reveal>
                <Kicker>FAQ</Kicker>
              </Reveal>
              <Reveal delay={80}>
                <SectionHeading className="mt-4 mb-[clamp(2rem,4vw,3rem)]">
                  Questions, answered.
                </SectionHeading>
              </Reveal>
              <Faq />
            </Container>
          </section>

          <DualCta />
        </div>

        <LandingFooter />
      </div>
    </>
  );
}
