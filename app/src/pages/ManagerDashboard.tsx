import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Link, useNavigate } from "react-router-dom";
import { useVaults } from "@/hooks/useVaults";
import { useWallet } from "@/lib/wallet";
import { useDataMode } from "@/hooks/useDataMode";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtUSD } from "@/lib/format";
import { Plus, DollarSign, Loader2, Wallet } from "lucide-react";
import { DataModeToggle } from "@/components/DataModeToggle";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { isMock } = useDataMode();
  const { data: allVaults, isLoading } = useVaults();

  const myVaults = useMemo(
    () => {
      const vaults = allVaults ?? [];
      if (isMock) return vaults.filter(v => v.managerPubkey === "7xKa...P9mZ");
      return vaults.filter(v => v.managerPubkey === address);
    },
    [allVaults, address, isMock]
  );

  const aum = myVaults.reduce((s, v) => s + v.tvl, 0);
  const junior = myVaults.reduce((s, v) => s + v.juniorCapital, 0);
  const paperVault = myVaults.find(v => v.status === "paper");

  if (!connected && !isMock) {
    return (
      <Layout>
        <div className="container py-20">
          <EmptyState icon={<Wallet className="w-5 h-5" />} title="Connect your wallet" description="Connect to manage your vaults." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-10">
        <div className="flex flex-wrap justify-between gap-4 items-end mb-8">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Trader operations</div>
            <h1 className="font-display font-bold text-4xl">SynQ manager</h1>
            <p className="text-muted-foreground mt-2">Operate trader vaults, manage paper mode, and protect investor trust.</p>
          </div>
          <div className="flex gap-2">
            <DataModeToggle compact />
            <Button asChild className="bg-gradient-ember text-white border-0">
              <Link to="/manager/create"><Plus className="w-4 h-4 mr-1.5" />Create vault</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Active vaults" value={myVaults.filter(v => v.status === "active").length} />
          <StatCard label="Paper vaults" value={myVaults.filter(v => v.status === "paper").length} />
          <StatCard label="Total AUM" value={`${fmtUSD(aum, { compact: true })} USDC`} />
          <StatCard label="Junior deployed" value={`${fmtUSD(junior, { compact: true })} USDC`} />
        </div>

        {isLoading ? (
          <div className="surface rounded-2xl p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading vaults...
          </div>
        ) : myVaults.length === 0 ? (
          <EmptyState
            icon={<Plus className="w-5 h-5" />}
            title="No vaults yet"
            description="Create your first vault to start building your on-chain track record."
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-display font-semibold text-lg">Trader vaults</h2>
              {myVaults.map(v => (
                <Link key={v.id} to={`/manager/vault/${v.id}`} className="surface rounded-xl p-5 block hover:border-border-strong">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold">{v.name}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-y border-border py-3 mb-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">TVL</div>
                      <div className="tabular font-semibold">{fmtUSD(v.tvl, { compact: true })} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Junior</div>
                      <div className="tabular font-semibold">{fmtUSD(v.juniorCapital, { compact: true })} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Senior</div>
                      <div className="tabular font-semibold">{fmtUSD(v.seniorCapital, { compact: true })} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Fee</div>
                      <div className="tabular font-semibold">{v.feeBps / 100}%</div>
                    </div>
                  </div>
                  <HealthMeter health={v.juniorHealth} />
                </Link>
              ))}
            </div>

            <div className="space-y-6">
              <div className="surface rounded-xl p-6">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Quick actions
                </h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <Link to="/manager/create">Create new vault</Link>
                  </Button>
                </div>
              </div>

              {paperVault && (
                <div className="surface rounded-xl p-6 border-primary/30">
                  <h3 className="font-display font-semibold mb-2">Graduation</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {paperVault.name} has {paperVault.paperTradeCount}/{paperVault.minQualifyingTrades} qualifying trades.
                  </p>
                  <Button
                    size="sm"
                    className="bg-gradient-ember text-white border-0"
                    onClick={() => navigate(`/manager/vault/${paperVault.id}`)}
                  >
                    View vault
                  </Button>
                </div>
              )}

              <div className="surface rounded-xl p-6">
                <h3 className="font-display font-semibold mb-4">Operational health</h3>
                <div className="space-y-3">
                  {myVaults.map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm truncate">{v.name}</span>
                      <span className="text-xs tabular font-semibold">{v.juniorHealth}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ManagerDashboard;
