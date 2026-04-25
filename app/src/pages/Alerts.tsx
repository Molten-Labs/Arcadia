import { useState } from "react";
import { Layout } from "@/components/Layout";
import { alerts as initial, getVault, type Alert } from "@/lib/mockData";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtRelative } from "@/lib/format";
import { Bell, Snowflake, Zap, AlertTriangle, Award, DollarSign } from "lucide-react";

const iconMap: Record<Alert["kind"], typeof Bell> = {
  cooldown: AlertTriangle,
  freeze: Snowflake,
  instant_exit: Zap,
  junior_low: AlertTriangle,
  fee: DollarSign,
  graduate: Award,
  paper_complete: Award,
};

const Alerts = () => {
  const [items, setItems] = useState(initial);
  const unread = items.filter(a => !a.read);

  const renderList = (list: typeof initial) => list.length === 0 ? (
    <div className="surface rounded-2xl p-10 text-center text-muted-foreground">No alerts.</div>
  ) : (
    <div className="space-y-3">
      {list.map(a => {
        const Icon = iconMap[a.kind] || Bell;
        const v = a.vaultId ? getVault(a.vaultId) : null;
        return (
          <div key={a.id} className={`surface rounded-xl p-4 flex gap-3 ${!a.read ? "border-primary/40" : ""}`}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{a.title}</div>
                <span className="text-[11px] text-muted-foreground shrink-0">{fmtRelative(a.time)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
              {v && <Link to={`/vault/${v.id}`} className="text-xs text-primary mt-2 inline-block">View vault →</Link>}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Layout>
      <div className="container py-10 max-w-3xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="font-display font-bold text-4xl">Alerts</h1>
            <p className="text-muted-foreground mt-2">{unread.length} unread</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setItems(items.map(i => ({ ...i, read: true })))}>Mark all read</Button>
        </div>
        <Tabs defaultValue="unread">
          <TabsList>
            <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="prefs">Preferences</TabsTrigger>
          </TabsList>
          <TabsContent value="unread" className="mt-6">{renderList(unread)}</TabsContent>
          <TabsContent value="all" className="mt-6">{renderList(items)}</TabsContent>
          <TabsContent value="prefs" className="mt-6">
            <div className="surface rounded-2xl p-6 space-y-3">
              {["Junior health crossed threshold", "Cooldown entered/ended", "Vault frozen", "Vault graduated", "Performance fee claimed", "Instant exit available", "Paper mode complete"].map(p => (
                <label key={p} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-primary" />{p}
                </label>
              ))}
              <p className="text-xs text-muted-foreground pt-3 border-t border-border">In-app alerts only for MVP. Email, Telegram, and Discord coming soon.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Alerts;
