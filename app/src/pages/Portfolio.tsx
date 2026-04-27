import { useMemo } from "react";
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
import { Wallet, ArrowRight, Loader2 } from "lucide-react";
import { DataModeToggle } from "@/components/DataModeToggle";

const Portfolio = () => {
  const { connected } = useWallet();
  const { data: positions, isLoading } = usePositions();
  const { isMock } = useDataMode();

  if (!connected && !isMock) {
    return (
      <Layout>
        <div className="container py-20">
          <EmptyState icon={<Wallet className="w-5 h-5" />} title="Connect your wallet" description="Connect to view your portfolio and active positions." />
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
        <div className="mb-8 flex flex-wrap justify-between gap-4 items-end">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Investor capital</div>
            <h1 className="font-display font-bold text-4xl">SynQ portfolio</h1>
            <p className="text-muted-foreground mt-2">Investor positions, senior shares, and first-loss buffer exposure.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DataModeToggle compact />
            <Button asChild variant="outline"><Link to="/vaults">Browse vaults</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total invested" value={`${fmtUSD(totalDeposited, { decimals: 2 })} SOL`} />
          <StatCard label="Current value" value={`${fmtUSD(totalValue, { decimals: 2 })} SOL`} />
          <StatCard label="Unrealized PnL" value={`${pnl >= 0 ? "+" : ""}${fmtUSD(pnl, { decimals: 2 })} SOL`} trend={totalDeposited > 0 ? (pnl / totalDeposited) * 100 : 0} />
          <StatCard label="Active vaults" value={allPositions.length} />
          <StatCard label="Avg junior health" value={`${avgHealth}%`} />
        </div>

        {isLoading ? (
          <div className="surface rounded-2xl p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading positions...
          </div>
        ) : allPositions.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="No positions yet"
            description="Browse graduated vaults and make your first deposit."
          />
        ) : (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-lg">Senior positions</h2>
            {allPositions.map(p => (
              <div key={p.pubkey} className="surface rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to={`/vault/${p.vaultConfigPubkey}`} className="font-display font-semibold hover:text-primary">
                        {p.vault?.name ?? shortAddr(p.vaultConfigPubkey)}
                      </Link>
                      {p.vault && <StatusBadge status={p.vault.status} />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Deposited {new Date(p.depositedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/vault/${p.vaultConfigPubkey}`}>View</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-y border-border py-3 mb-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Deposited</div>
                    <div className="tabular font-semibold">{fmtUSD(p.totalDeposited, { decimals: 2 })} SOL</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Value</div>
                    <div className="tabular font-semibold">{fmtUSD(p.currentValue, { decimals: 2 })} SOL</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Shares</div>
                    <div className="tabular font-semibold">{p.seniorShares}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Withdrawal</div>
                    <div className="tabular text-xs">{p.vault?.instantExit ? "Instant" : "24h cooldown"}</div>
                  </div>
                </div>
                {p.vault && <HealthMeter health={p.vault.juniorHealth} />}
                <p className="mt-3 text-xs text-muted-foreground">
                  This investor view shows risk, value, shares, and exit terms only. Trader execution controls stay in the manager console.
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
