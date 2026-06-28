import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { BRAND, FONT, secondsToFrames } from "../constants";
import { HookScene } from "../scenes/HookScene";
import { ProblemSolutionScene } from "../scenes/ProblemSolutionScene";
import { MechanicScene } from "../scenes/MechanicScene";
import { ProductScene } from "../scenes/ProductScene";
import { StatsScene } from "../scenes/StatsScene";
import { CloseScene } from "../scenes/CloseScene";
import { CTAScene } from "../scenes/CTAScene";

const FADE_DUR = 24;
const SPRING_TIMING = springTiming({
  config: { damping: 200, mass: 1 },
  durationRestThreshold: 0.001,
});

// Total: 10+15+20+18+12+10+5 = 90s = 2700f ✓
export const HackathonClip: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        fontFamily: FONT.ui,
        overflow: "hidden",
      }}
    >
      <TransitionSeries>
        {/* Scene 1: Hook — 10s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(10)}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 2: Problem / Solution — 15s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(15)}>
          <ProblemSolutionScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={SPRING_TIMING}
        />

        {/* Scene 3: Mechanic — 20s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(20)}>
          <MechanicScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={SPRING_TIMING}
        />

        {/* Scene 4: Product — 18s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(18)}>
          <ProductScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 5: Stats — 12s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(12)}>
          <StatsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 6: Close — 10s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(10)}>
          <CloseScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 7: CTA — 5s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(5)}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
