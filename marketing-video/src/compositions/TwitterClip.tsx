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

const FADE_DUR = 18;
const SPRING_TIMING = springTiming({
  config: { damping: 200, mass: 1 },
  durationRestThreshold: 0.001,
});

export const TwitterClip: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        fontFamily: FONT.ui,
        overflow: "hidden",
      }}
    >
      <TransitionSeries>
        {/* Scene 1: Hook — 4s = 120f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(4)}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 2: Mechanic — 9s = 270f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(9)}>
          <MechanicScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={SPRING_TIMING}
        />

        {/* Scene 3: Product — 7s = 210f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(7)}>
          <ProductScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 4: Stats — 4s = 120f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(4)}>
          <StatsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 5: Close — 4s = 120f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(4)}>
          <CloseScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DUR })}
        />

        {/* Scene 6: CTA — 2s = 60f */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(2)}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
