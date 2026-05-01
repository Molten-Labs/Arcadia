import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useVaults, type VaultView } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtUSD } from "@/lib/format";
import { Search, SlidersHorizontal, X, Loader2, ShieldCheck, Activity, WalletCards } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VaultStatus } from "@/components/StatusBadge";
import { DataModeToggle } from "@/components/DataModeToggle";
import { usePositions } from "@/hooks/usePositions";

const statusOptions: VaultStatus[] = ["active", "paper", "cooldown", "frozen"];

const Vaults = () => {
  const { data: vaults, isLoading, error } = useVaults();
  const { data: positions } = usePositions();
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<VaultStatus[]>(["active", "paper"]);
  const [minHealth, setMinHealth] = useState([0]);
  const [instantOnly, setInstantOnly] = useState(false);
  const [sort, setSort] = useState<"tvl" | "health" | "recent">("tvl");

  const allVaults = useMemo(() => vaults ?? [], [vaults]);

  const protocolStats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL: allVaults.reduce((s, v) => s + v.tvl, 0),
    graduatedVaults: allVaults.filter(v => v.status !== "paper").length,
    protectedCapital: allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

  const portfolioStats = useMemo(() => {
    const allPositions = positions ?? [];
    const currentValue = allPositions.reduce((sum, position) => sum + position.currentValue, 0);
    const deposited = allPositions.reduce((sum, position) => sum + position.totalDeposited, 0);
    const avgHealth = allPositions.length
      ? Math.round(allPositions.reduce((sum, position) => sum + (position.vault?.juniorHealth ?? 0), 0) / allPositions.length)
      : 0;
    return { count: allPositions.length, currentValue, pnl: currentValue - deposited, avgHealth };
  }, [positions]);

  const filtered = useMemo(() => {
    return allVaults
      .filter(v => statuses.length === 0 || statuses.includes(v.status))
      .filter(v => v.juniorHealth >= minHealth[0])
      .filter(v => !instantOnly || v.instantExit)
      .filter(v => v.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sort === "tvl") return b.tvl - a.tvl;
        if (sort === "health") return b.juniorHealth - a.juniorHealth;
        if (sort === "recent") return b.createdAt - a.createdAt;
        return 0;
      });
  }, [allVaults, statuses, minHealth, instantOnly, query, sort]);

  const toggle = <T,>(arr: T[], setter: (v: T[]) => void, val: T) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const Filters = (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status</h3>
        <div className="space-y-2">
          {statusOptions.map(s => (
            <label key={s} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
              <Checkbox checked={statuses.includes(s)} onCheckedChange={() => toggle(statuses, setStatuses, s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Min junior health: {minHealth[0]}%</h3>
        <Slider value={minHealth} onValueChange={setMinHealth} min={0} max={100} step={5} />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={instantOnly} onCheckedChange={(v) => setInstantOnly(!!v)} />
          Instant exit available
        </label>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Investor marketplace</div>
            <h1 className="font-display font-bold text-4xl">SynQ graduated vaults</h1>
            <p className="text-muted-foreground mt-2">Discover trader vaults backed by first-loss junior capital.</p>
          </div>
          <DataModeToggle compact />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { l: "Live vaults", v: protocolStats.totalVaults },
            { l: "Total TVL", v: `${fmtUSD(protocolStats.totalTVL, { compact: true })} USDC` },
            { l: "Graduated", v: protocolStats.graduatedVaults },
            { l: "Protected capital", v: `${fmtUSD(protocolStats.protectedCapital, { compact: true })} USDC` },
          ].map(k => (
            <div key={k.l} className="surface rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
              <div className="font-display font-semibold text-xl mt-1 tabular">{k.v}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 shrink-0 surface rounded-2xl p-5 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-auto scrollbar-thin">
            {Filters}
          </aside>

          <div className="flex-1 min-w-0">
            <div className="surface mb-5 flex flex-wrap items-center gap-3 rounded-xl p-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vaults..." className="pl-9" />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="tvl">Sort: TVL</option>
                <option value="health">Sort: Junior health</option>
                <option value="recent">Sort: Recently created</option>
              </select>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                  <div className="mt-6">{Filters}</div>
                </SheetContent>
              </Sheet>
              {(statuses.length > 0 || instantOnly || minHealth[0] > 0) && (
                <Button variant="ghost" size="sm" onClick={() => { setStatuses([]); setMinHealth([0]); setInstantOnly(false); }}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="surface rounded-2xl p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading vaults...
              </div>
            ) : error ? (
              <div className="surface rounded-2xl p-10 text-center text-muted-foreground">
                Connect your wallet or configure the SynQ API to browse vaults.
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{filtered.length} vault{filtered.length !== 1 && "s"} · senior deposits never expose trader execution controls</span>
                  <span className="hidden font-mono text-primary sm:inline">SENIOR CAPITAL VIEW</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="surface rounded-2xl p-10 text-center text-muted-foreground">
                    {allVaults.length === 0
                      ? "No vaults created yet. Be the first to create a vault!"
                      : "No vaults match your filters."}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(v => <VaultCard key={v.id} vault={v} />)}
                  </div>
                )}
              </>
            )}
          </div>
          <aside className="hidden w-72 shrink-0 space-y-4 xl:block">
            <div className="surface rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" />
                My portfolio
              </div>
              <div className="font-display text-3xl font-bold tabular">{fmtUSD(portfolioStats.currentValue, { compact: true })}</div>
              <div className={portfolioStats.pnl >= 0 ? "mt-1 font-mono text-xs text-success" : "mt-1 font-mono text-xs text-destructive"}>
                {portfolioStats.pnl >= 0 ? "+" : ""}{fmtUSD(portfolioStats.pnl, { compact: true })} unrealized
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-secondary/50 p-3">
                  <div className="text-muted-foreground">Positions</div>
                  <div className="mt-1 font-mono text-sm text-foreground">{portfolioStats.count}</div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/50 p-3">
                  <div className="text-muted-foreground">Avg health</div>
                  <div className="mt-1 font-mono text-sm text-success">{portfolioStats.avgHealth}%</div>
                </div>
              </div>
            </div>
            <div className="surface rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                Trust rails
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>Trader junior capital takes first loss before senior deposits.</div>
                <div>Instant exits unlock when the junior buffer drops below 20%.</div>
                <div>Paper vaults cannot accept investor deposits until graduation.</div>
              </div>
            </div>
            <div className="surface rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                Live activity
              </div>
              <div className="space-y-3 text-xs text-muted-foreground">
                {allVaults.slice(0, 4).map((vault) => (
                  <div key={vault.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="truncate">{vault.name}</span>
                    <span className="font-mono text-foreground">{vault.juniorHealth}%</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default Vaults;
