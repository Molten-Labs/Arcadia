import { AppShell } from "@/components/shell/AppShell";
import { Providers } from "@/components/providers";
import { MobileNav } from "@/components/shell/MobileNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

/**
 * Shell for authenticated app routes (sidebar + topbar + mobile bar). The
 * landing at `/` lives outside this group and renders its own nav/footer
 * full-bleed. Auth/query providers are mounted HERE — they wrap only the
 * authenticated pages, keeping the public landing free of the heavy Privy/
 * react-query bundle.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <AppShell>
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </AppShell>
        <MobileNav />
      </div>
    </Providers>
  );
}
