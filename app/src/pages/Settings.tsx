import { type ReactNode } from "react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, shortAddr, type Role } from "@/lib/wallet";
import { toast } from "sonner";

const Settings = () => {
  const { address, role, setRole, disconnect } = useWallet();
  return (
    <Layout>
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display font-bold text-4xl mb-8">Settings</h1>
        <div className="space-y-6">
          <Section title="Wallet">
            <Row label="Connected address" value={<span className="font-mono text-sm">{shortAddr(address) || "Not connected"}</span>} />
            {address && <Button variant="outline" size="sm" onClick={() => { disconnect(); toast.success("Disconnected"); }}>Disconnect</Button>}
          </Section>
          <Section title="Display">
            <div className="space-y-3">
              <FieldRow label="Display name"><Input placeholder="Anon" className="max-w-xs" /></FieldRow>
              <FieldRow label="Display currency">
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>USD</option><option>EUR</option></select>
              </FieldRow>
              <FieldRow label="Theme"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>Dark</option></select></FieldRow>
              <FieldRow label="Default role on login">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="investor">Investor</option><option value="trader">Trader</option>
                </select>
              </FieldRow>
            </div>
          </Section>
          <Section title="Notifications">
            <p className="text-sm text-muted-foreground">Manage notification preferences in the Alerts page.</p>
          </Section>
        </div>
      </div>
    </Layout>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="surface rounded-2xl p-6">
    <h2 className="font-display font-semibold mb-4">{title}</h2>{children}
  </div>
);
const Row = ({ label, value }: { label: string; value: ReactNode }) => <div className="flex justify-between items-center text-sm mb-3"><span className="text-muted-foreground">{label}</span>{value}</div>;
const FieldRow = ({ label, children }: { label: string; children: ReactNode }) => <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">{label}</span>{children}</div>;

export default Settings;
