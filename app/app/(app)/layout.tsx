import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AppShell } from "@/components/AppShell";

/**
 * Shell for authenticated app routes (sidebar + topbar). The landing at `/`
 * lives outside this group and renders its own nav/footer full-bleed.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <AppShell>
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </AppShell>
    </div>
  );
}
