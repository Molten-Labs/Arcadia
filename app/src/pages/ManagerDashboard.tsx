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
import { Plus, DollarSign, Loader2, Wallet, LayoutDashboard, ArrowRight } from "lucide-react";
import { DataModeToggle } from "@/components/DataModeToggle";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { isMock } = useDataMode();
  const { data: allVaults, isLoading } = useVaults();

  const myVaults = useMemo(() => {
    const vaults = allVaults ?? [];
    if (isMock) return vaults.filter(v => v.managerPubkey === "7xKa...P9mZ");
    return vaults.filter(v => v.managerPubkey === address);
  }, [allVaults, address, isMock]);

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
        {/* Header */}
        <div className="flex flex-wrap justify-between gap-4 items-end mb-8">
          <div>
            <span className="page-header-label">
              <LayoutDashboard className="w-3 h-3" /> Trader operations
            </span>
            <h1 className="font-display type-h1 font-semibold mt-3">Manager dashboard</h1>
            <p className="text-muted-foreground mt-2 text-[14px]">Operate trader vaults, manage paper mode, and protect investor trust.</p>
          </div>
          <div className="flex gap-2">
            <DataModeToggle compact />
            <Button asChild className="h-9 bg-primary text-primary-foreground hover:bg-primary-glow border-0 font-display font-semibold">
              <Link to="/manager/create">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create vault
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Active vaults" value={myVaults.filter(v => v.status === "active").length} />
          <StatCard label="Paper vaults" value={myVaults.filter(v => v.status === "paper").length} />
          <StatCard label="Total AUM" value={`${fmtUSD(aum, { compact: true })} USDC`} />
          <StatCard label="Junior deployed" value={`${fmtUSD(junior, { compact: true })} USDC`} />
        </div>

        {isLoading ? (
          <div className="surface rounded-lg p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading vaults…
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
              <h2 className="font-display font-semibold text-[17px]">Trader vaults</h2>
              {myVaults.map(v => (
                <Link
                  key={v.id}
                  to={`/manager/vault/${v.id}`}
                  className="surface rounded-[11px] p-5 block hover:border-border-strong hover:-translate-y-px transition-all duration-200 group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-display font-semibold text-[15px]">{v.name}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <span className="text-[12px] text-primary/70 font-medium flex items-center gap-1 group-hover:text-primary transition-colors">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-y border-border/40 py-3 mb-3">
                    {[
                      { l: "TVL", v: `${fmtUSD(v.tvl, { compact: true })} USDC` },
                      { l: "Junior", v: `${fmtUSD(v.juniorCapital, { compact: true })} USDC` },
                      { l: "Senior", v: `${fmtUSD(v.seniorCapital, { compact: true })} USDC` },
                      { l: "Fee", v: `${v.feeBps / 100}%` },
                    ].map(s => (
                      <div key={s.l}>
                        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-0.5">{s.l}</div>
                        <div className="font-mono font-semibold text-[13px] tabular">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <HealthMeter health={v.juniorHealth} />
                </Link>
              ))}
            </div>

            <div className="space-y-5">
              <div className="surface rounded-lg p-5">
                <h3 className="font-display font-semibold text-[14px] mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Quick actions
                </h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start h-9 text-[13px]" asChild>
                    <Link to="/manager/create">
                      <Plus className="w-3.5 h-3.5 mr-2" /> Create new vault
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start h-9 text-[13px]" asChild>
                    <Link to="/trade">Open trading terminal</Link>
                  </Button>
                </div>
              </div>

              {paperVault && (
                <div className="surface rounded-[11px] p-5 border-primary/25">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-t-[11px]" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-primary mb-2">Graduation pending</div>
                  <h3 className="font-display font-semibold text-[14px] mb-2">{paperVault.name}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground mb-4">
                    {paperVault.paperTradeCount}/{paperVault.minQualifyingTrades} qualifying trades completed.
                  </p>
                  <Button
                    size="sm"
                    className="h-8 w-full bg-primary text-primary-foreground hover:bg-primary-glow border-0 text-[12px] font-semibold"
                    onClick={() => navigate(`/manager/vault/${paperVault.id}`)}
                  >
                    View vault
                  </Button>
                </div>
              )}

              <div className="surface rounded-lg p-5">
                <h3 className="font-display font-semibold text-[14px] mb-4">Operational health</h3>
                <div className="space-y-3">
                  {myVaults.map(v => (
                    <div key={v.id} className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 bg-secondary/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.juniorHealth >= 50 ? "bg-success" : v.juniorHealth >= 20 ? "bg-warning" : "bg-destructive"}`}
                          style={{ width: `${v.juniorHealth}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-semibold shrink-0 w-10 text-right tabular">{v.juniorHealth}%</span>
                      <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[80px]">{v.name}</span>
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
