import { Syne, Space_Grotesk, Space_Mono } from "next/font/google";

/**
 * Acid Graphic type system (self-hosted via next/font, no raw <link> tags).
 *
 * next/font exposes each family as a CSS variable set on <html>. We keep the
 * variable names family-specific (`--font-syne`, `--font-space-grotesk`,
 * `--font-space-mono`) and map the semantic Tailwind utilities
 * (`font-display` / `font-sans` / `font-mono`) onto them inside the `@theme`
 * block in globals.css. That avoids a name clash with Tailwind's own
 * `--font-*` theme keys while still generating the expected utilities.
 *
 *   Syne          -> font-display  (headlines / wordmarks)
 *   Space Grotesk -> font-sans     (body + UI, default)
 *   Space Mono    -> font-mono     (data / numbers / labels)
 */

export const fontDisplay = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

export const fontSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const fontMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

/** Convenience: all three font CSS-variable classes for the <html> element. */
export const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`;
