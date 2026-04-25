import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { investorPositions, getVault, getTrader, alerts } from "@/lib/mockData";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtUSD, fmtPct, fmtDate, fmtRelative } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { Wallet, ArrowRight, Bell } from "lucide-react";

const Portfolio = () => {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <Layout>
        <div className="container py-20">
          <EmptyState icon={<Wallet className="w-5 h-5" />} title="Connect your wallet" description="Connect to view your portfolio and active positions." />
        </div>
      </Layout>
    );
  }

  const totalDeposited = investorPositions.reduce((s, p) => s + p.deposited, 0);
  const totalValue = investorPositions.reduce((s, p) => s + p.currentValue, 0);
  const pnl = totalValue - totalDeposited;
  const avgHealth = Math.round(investorPositions.reduce((s, p) => s + (getVault(p.vaultId)?.juniorHealth || 0), 0) / investorPositions.length);
  const myAlerts = alerts.filter(a => investorPositions.some(p => p.vaultId === a.vaultId));

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8 flex flex-wrap justify-between gap-4 items-end">
          <div>
            <h1 className="font-display font-bold text-4xl">Portfolio</h1>
            <p className="text-muted-foreground mt-2">Your active positions across Kiln vaults.</p>
          </div>
          <Button asChild variant="outline"><Link to="/vaults">Browse vaults</Link></Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total invested" value={`$${fmtUSD(totalDeposited)}`} />
          <StatCard label="Current value" value={`$${fmtUSD(totalValue)}`} />
          <StatCard label="Unrealized PnL" value={`+$${fmtUSD(pnl)}`} trend={(pnl / totalDeposited) * 100} />
          <StatCard label="Active vaults" value={investorPositions.length} />
          <StatCard label="Avg junior health" value={`${avgHealth}%`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display font-semibold text-lg">Your positions</h2>
            {investorPositions.map(p => {
              const v = getVault(p.vaultId);
              const t = v && getTrader(v.traderWallet);
              if (!v) return null;
              const positionPnl = p.currentValue - p.deposited;
              return (
                <div key={p.vaultId} className="surface rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/vault/${v.id}`} className="font-display font-semibold hover:text-primary">{v.name}</Link>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">by {t?.name} · deposited {fmtDate(p.depositedAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm"><Link to={`/vault/${v.id}`}>View</Link></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-y border-border py-3 mb-3">
                    <div><div className="text-[10px] uppercase text-muted-foreground">Deposited</div><div className="tabular font-semibold">${fmtUSD(p.deposited)}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Value</div><div className="tabular font-semibold">${fmtUSD(p.currentValue)}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">PnL</div><div className="tabular font-semibold text-success">+${fmtUSD(positionPnl)}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Withdrawal</div><div className="tabular text-xs">{v.instantExit ? "Instant" : "24h cooldown"}</div></div>
                  </div>
                  <HealthMeter health={v.juniorHealth} />
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="surface rounded-2xl p-5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4" /> Recent alerts</h3>
              {myAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent alerts.</p>
              ) : (
                <div className="space-y-3">
                  {myAlerts.slice(0, 4).map(a => (
                    <div key={a.id} className="text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{fmtRelative(a.time)}</div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="ghost" size="sm" className="w-full mt-3"><Link to="/alerts">All alerts <ArrowRight className="w-3 h-3 ml-1" /></Link></Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Portfolio;
