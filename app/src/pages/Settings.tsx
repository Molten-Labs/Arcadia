import { type ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, shortAddr, type Role } from "@/lib/wallet";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

const Settings = () => {
  const { address, role, setRole, disconnect } = useWallet();
  return (
    <Layout>
      <div className="container py-10 max-w-2xl">
        <div className="mb-8">
          <span className="page-header-label">
            <Settings2 className="w-3 h-3" /> Account
          </span>
          <h1 className="font-display type-h1 font-semibold mt-3">Settings</h1>
        </div>

        <div className="space-y-5">
          <Section title="Wallet">
            <Row label="Connected address" value={
              <span className="font-mono text-[12px] text-foreground/80">
                {shortAddr(address) || "Not connected"}
              </span>
            } />
            {address && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { disconnect(); toast.success("Disconnected"); }}
                >
                  Disconnect wallet
                </Button>
              </div>
            )}
          </Section>

          <Section title="Display">
            <div className="space-y-4">
              <FieldRow label="Display name">
                <Input placeholder="Anon" className="max-w-xs h-9 text-[13px]" />
              </FieldRow>
              <FieldRow label="Display currency">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground">
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </FieldRow>
              <FieldRow label="Theme">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground">
                  <option>Dark</option>
                </select>
              </FieldRow>
              <FieldRow label="Default role on login">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground"
                >
                  <option value="investor">Investor</option>
                  <option value="trader">Trader</option>
                </select>
              </FieldRow>
            </div>
          </Section>

          <Section title="Notifications">
            <p className="text-[13px] text-muted-foreground">
              Manage notification preferences in the Alerts page.
            </p>
          </Section>
        </div>
      </div>
    </Layout>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="surface rounded-[11px] p-5">
    <h2 className="font-display font-semibold text-[14px] mb-4">{title}</h2>
    {children}
  </div>
);

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between items-center text-[13px] mb-2">
    <span className="text-muted-foreground">{label}</span>
    {value}
  </div>
);

const FieldRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
    {children}
  </div>
);

export default Settings;
