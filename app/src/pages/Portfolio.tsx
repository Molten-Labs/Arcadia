import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { usePositions } from "@/hooks/usePositions";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtUSD } from "@/lib/format";
import { useWallet, shortAddr } from "@/lib/wallet";
import { useDataMode } from "@/hooks/useDataMode";
import { Wallet, ArrowRight, Loader2, PieChart } from "lucide-react";
import { DataModeToggle } from "@/components/DataModeToggle";

const Portfolio = () => {
  const { connected } = useWallet();
  const { data: positions, isLoading } = usePositions();
  const { isMock } = useDataMode();

  if (!connected && !isMock) {
    return (
      <Layout>
        <div className="container py-20">
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="Connect your wallet"
            description="Connect to view your portfolio and active positions."
          />
        </div>
      </Layout>
    );
  }

  const allPositions = positions ?? [];
  const totalDeposited = allPositions.reduce((s, p) => s + p.totalDeposited, 0);
  const totalValue = allPositions.reduce((s, p) => s + p.currentValue, 0);
  const pnl = totalValue - totalDeposited;
  const avgHealth = allPositions.length > 0
    ? Math.round(allPositions.reduce((s, p) => s + (p.vault?.juniorHealth ?? 0), 0) / allPositions.length)
    : 0;

  return (
    <Layout>
      <div className="container py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap justify-between gap-4 items-end">
          <div>
            <span className="page-header-label">
              <PieChart className="w-3 h-3" /> Investor capital
            </span>
            <h1 className="font-display type-h1 font-semibold mt-3">Portfolio</h1>
            <p className="text-muted-foreground mt-2 text-[14px]">
              Principal, current claim value, and first-loss buffer exposure.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DataModeToggle compact />
            <Button asChild variant="outline" size="sm">
              <Link to="/vaults">Browse vaults <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total invested" value={`${fmtUSD(totalDeposited, { decimals: 2 })} USDC`} />
          <StatCard label="Current value" value={`${fmtUSD(totalValue, { decimals: 2 })} USDC`} />
          <StatCard
            label="Unrealized PnL"
            value={`${pnl >= 0 ? "+" : ""}${fmtUSD(pnl, { decimals: 2 })} USDC`}
            trend={totalDeposited > 0 ? (pnl / totalDeposited) * 100 : 0}
          />
          <StatCard label="Active vaults" value={allPositions.length} />
          <StatCard label="Avg junior health" value={`${avgHealth}%`} />
        </div>

        {isLoading ? (
          <div className="surface rounded-lg p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading positions…
          </div>
        ) : allPositions.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="No positions yet"
            description="Browse graduated vaults and make your first deposit."
          />
        ) : (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-[17px] text-foreground">Senior positions</h2>
            {allPositions.map(p => (
              <div key={p.pubkey} className="surface rounded-[11px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        to={`/vault/${p.vaultConfigPubkey}`}
                        className="font-display font-semibold text-[15px] hover:text-primary transition-colors"
                      >
                        {p.vault?.name ?? shortAddr(p.vaultConfigPubkey)}
                      </Link>
                      {p.vault && <StatusBadge status={p.vault.status} />}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground mt-1">
                      Deposited {new Date(p.depositedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-8 text-[12px]">
                    <Link to={`/vault/${p.vaultConfigPubkey}`}>View vault</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-y border-border/40 py-3 mb-4">
                  {[
                    { l: "Deposited", v: `${fmtUSD(p.totalDeposited, { decimals: 2 })} USDC` },
                    { l: "Current claim", v: `${fmtUSD(p.currentValue, { decimals: 2 })} USDC` },
                    { l: "Principal left", v: `${fmtUSD(p.seniorPrincipalRemaining, { decimals: 2 })} USDC` },
                    { l: "Withdrawal", v: p.vault?.instantExit ? "Instant" : "24h cooldown" },
                  ].map(s => (
                    <div key={s.l}>
                      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">{s.l}</div>
                      <div className="font-mono font-semibold text-[13px] tabular">{s.v}</div>
                    </div>
                  ))}
                </div>

                {p.vault && <HealthMeter health={p.vault.juniorHealth} />}
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  This investor view shows risk, principal, claim value, and exit terms only. Trader execution controls stay in the manager console.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Portfolio;
