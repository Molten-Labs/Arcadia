import { Composition } from "remotion";
import { TwitterClip } from "./compositions/TwitterClip";
import { HackathonClip } from "./compositions/HackathonClip";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="TwitterClip"
        component={TwitterClip}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HackathonClip"
        component={HackathonClip}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
