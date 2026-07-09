import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Arcadia", template: "%s | Arcadia" },
  description: "Arcadia — on-chain trading reputation and fund management on Solana.",
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
