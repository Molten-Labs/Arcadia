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
      <div className="bg-gradient-to-b from-primary/5 via-transparent to-transparent">
        <div className="container py-16">
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
        </div>
      </div>

      <div className="container py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              <h2 className="font-display font-semibold text-lg">Trader vaults</h2>
              {myVaults.map(v => (
                <Link key={v.id} to={`/manager/vault/${v.id}`} className="surface rounded-2xl p-6 block hover:border-border-strong border border-border/50 transition-all hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-lg">{v.name}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-y border-border/50 py-4 mb-4">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">TVL</div>
                      <div className="tabular font-semibold text-base mt-1">{fmtUSD(v.tvl, { compact: true })} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Junior</div>
                      <div className="tabular font-semibold text-base mt-1">{fmtUSD(v.juniorCapital, { compact: true })} USDC</div>
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
              <div className="surface rounded-2xl p-6 border border-border/50">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <DollarSign className="w-4 h-4 text-primary" /> Quick actions
                </h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <Link to="/manager/create">Create new vault</Link>
                  </Button>
                </div>
              </div>

              {paperVault && (
                <div className="surface rounded-2xl p-6 border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <h3 className="font-display font-semibold mb-2 text-foreground">Graduation progress</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {paperVault.name} has {paperVault.paperTradeCount}/{paperVault.minQualifyingTrades} qualifying trades.
                  </p>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-primary to-primary-light" style={{width: `${(paperVault.paperTradeCount / paperVault.minQualifyingTrades) * 100}%`}}></div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-gradient-ember text-white border-0 w-full"
                    onClick={() => navigate(`/manager/vault/${paperVault.id}`)}
                  >
                    View vault
                  </Button>
                </div>
              )}

              <div className="surface rounded-2xl p-6 border border-border/50">
                <h3 className="font-display font-semibold mb-4 text-foreground">Operational health</h3>
                <div className="space-y-3">
                  {myVaults.map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg p-2.5 hover:bg-primary/5 transition-colors border border-border/30">
                      <span className="text-sm truncate text-muted-foreground">{v.name}</span>
                      <span className="text-xs tabular font-semibold text-foreground">{v.juniorHealth}%</span>
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
