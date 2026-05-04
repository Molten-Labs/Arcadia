import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { BRAND, FONT, secondsToFrames } from "../constants";
import { HookScene } from "../scenes/HookScene";
import { MechanicScene } from "../scenes/MechanicScene";
import { ProductScene } from "../scenes/ProductScene";
import { CloseScene } from "../scenes/CloseScene";
import { CTAScene } from "../scenes/CTAScene";

const TRANSITION_DURATION = 24;

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
        {/* Scene 1: Hook — 12s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(12)}>
          <HookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 2: Mechanic — 28s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(28)}>
          <MechanicScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({
            config: { damping: 200, mass: 1 },
            durationRestThreshold: 0.001,
          })}
        />

        {/* Scene 3: Product — 25s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(25)}>
          <ProductScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 4: Close — 18s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(18)}>
          <CloseScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 5: CTA — 7s */}
        <TransitionSeries.Sequence durationInFrames={secondsToFrames(7)}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
