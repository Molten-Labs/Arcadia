// Brand Colors from brand.md
export const BRAND = {
  bgPrimary: "#050816",
  bgSecondary: "#0B1120",
  surface: "#111827",
  surfaceElevated: "#17171D",
  signalPrimary: "#00FFB2",
  signalHover: "#5FFFC0",
  signalDeep: "#16C784",
  textPrimary: "#F5F7FA",
  textSecondary: "#B0B0B0",
  textMuted: "#7C7C84",
  danger: "#FF4D6D",
  warning: "#C8A75B",
};

export const FONT = {
  display: "Outfit",
  ui: "Poppins",
  mono: "IBM Plex Mono",
};

export const TIMINGS = {
  fps: 30,
  twitterDuration: 900, // 30 seconds
  hackathonDuration: 2700, // 90 seconds
};

// Helper: convert seconds to frames
export const secondsToFrames = (seconds: number, fps: number = 30) => {
  return Math.round(seconds * fps);
};
