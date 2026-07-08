import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
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
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="bg-void font-sans text-ink antialiased">
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
