import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "Arcadia", template: "%s | Arcadia" },
  description: "Arcadia — on-chain trading reputation and fund management on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <AppShell>
              <Topbar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </AppShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
