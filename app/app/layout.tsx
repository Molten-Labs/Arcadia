import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { fontVariables } from "@/lib/fonts";

const DESCRIPTION =
  "Arcadia turns real on-chain trading history into verified reputation. " +
  "Investor capital flows to the traders who have earned it. " +
  "Proof-of-performance capital protocol on Solana.";

export const metadata: Metadata = {
  // Absolute URLs for OG/twitter images; set NEXT_PUBLIC_SITE_URL in prod.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Arcadia / Where Performance Earns Capital", template: "%s | Arcadia" },
  description: DESCRIPTION,
  applicationName: "Arcadia",
  openGraph: {
    title: "Arcadia / Where Performance Earns Capital",
    description: DESCRIPTION,
    siteName: "Arcadia",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcadia / Where Performance Earns Capital",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="bg-void font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:border focus:border-acid/40 focus:bg-panel focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-acid"
        >
          Skip to content
        </a>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
