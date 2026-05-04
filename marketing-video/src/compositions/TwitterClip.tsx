import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
} from "remotion";
import { BRAND, FONT, secondsToFrames } from "../constants";
import { HookScene } from "../scenes/HookScene";
import { MechanicScene } from "../scenes/MechanicScene";
import { ProductScene } from "../scenes/ProductScene";
import { CloseScene } from "../scenes/CloseScene";
import { CTAScene } from "../scenes/CTAScene";

export const TwitterClip: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bgPrimary,
        fontFamily: FONT.ui,
        overflow: "hidden",
      }}
    >
      {/* Scene 1: Hook (0-3s) */}
      <Sequence from={0} durationInFrames={secondsToFrames(3)}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Core Mechanic (3-12s) */}
      <Sequence from={secondsToFrames(3)} durationInFrames={secondsToFrames(9)}>
        <MechanicScene />
      </Sequence>

      {/* Scene 3: Product (12-20s) */}
      <Sequence from={secondsToFrames(12)} durationInFrames={secondsToFrames(8)}>
        <ProductScene />
      </Sequence>

      {/* Scene 4: Close (20-27s) */}
      <Sequence from={secondsToFrames(20)} durationInFrames={secondsToFrames(7)}>
        <CloseScene />
      </Sequence>

      {/* Scene 5: CTA (27-30s) */}
      <Sequence from={secondsToFrames(27)} durationInFrames={secondsToFrames(3)}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
