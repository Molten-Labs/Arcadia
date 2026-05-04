import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { BRAND, FONT, secondsToFrames } from "../constants";
import { HookScene } from "../scenes/HookScene";
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

// Total: 12+25+22+14+12+5 = 90s = 2700f ✓
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
        {/* Scene 1: Hook — 12s = 360f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(12)}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 2: Mechanic — 25s = 750f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(25)}>
          <MechanicScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={SPRING_TIMING}
        />

        {/* Scene 3: Product — 22s = 660f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(22)}>
          <ProductScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 4: Stats — 14s = 420f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(14)}>
          <StatsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 5: Close — 12s = 360f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(12)}>
          <CloseScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 6: CTA — 5s = 150f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(5)}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
