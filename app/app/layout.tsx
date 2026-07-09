import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/providers";

const DESCRIPTION =
  "Arcadia turns real on-chain trading history into verified reputation. " +
  "Investor capital flows to the traders who have earned it. " +
  "Proof-of-performance capital protocol on Solana.";

export const metadata: Metadata = {
  // Absolute URLs for OG/twitter images; set NEXT_PUBLIC_SITE_URL in prod.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Arcadia / Prove It.", template: "%s | Arcadia" },
  description: DESCRIPTION,
  applicationName: "Arcadia",
  openGraph: {
    title: "Arcadia / Prove It.",
    description: DESCRIPTION,
    siteName: "Arcadia",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcadia / Prove It.",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
