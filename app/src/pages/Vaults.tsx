import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useVaults, type VaultView } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtUSD } from "@/lib/format";
import { Search, SlidersHorizontal, X, Loader2, ShieldCheck, Shield, Activity, WalletCards, TrendingUp, TrendingDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VaultStatus } from "@/components/StatusBadge";
import { DataModeToggle } from "@/components/DataModeToggle";
import { usePositions } from "@/hooks/usePositions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
    const all = positions ?? [];
    const currentValue = all.reduce((sum, p) => sum + p.currentValue, 0);
    const deposited = all.reduce((sum, p) => sum + p.totalDeposited, 0);
    const avgHealth = all.length
      ? Math.round(all.reduce((sum, p) => sum + (p.vault?.juniorHealth ?? 0), 0) / all.length)
      : 0;
    return { count: all.length, currentValue, pnl: currentValue - deposited, avgHealth };
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

  const toggle = <T,>(arr: T[], setter: (v: T[]) => void, val: T) =>
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const Filters = (
    <div className="space-y-6">
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Status</h3>
        <div className="space-y-2">
          {statusOptions.map(s => (
            <label key={s} className="flex items-center gap-2.5 text-sm capitalize cursor-pointer select-none">
              <Checkbox checked={statuses.includes(s)} onCheckedChange={() => toggle(statuses, setStatuses, s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
          Min junior health: <span className="text-foreground">{minHealth[0]}%</span>
        </h3>
        <Slider value={minHealth} onValueChange={setMinHealth} min={0} max={100} step={5} />
      </div>
      <div>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
          <Checkbox checked={instantOnly} onCheckedChange={(v) => setInstantOnly(!!v)} />
          Instant exit available
        </label>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container py-10">
        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="page-header-label">Investor marketplace</span>
            <h1 className="font-display type-h1 font-semibold mt-3">Graduated vaults</h1>
            <p className="text-muted-foreground mt-2 text-[14px]">Discover trader vaults backed by first-loss junior capital.</p>
          </div>
          <DataModeToggle compact />
        </div>

        {/* Protocol stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { l: "Live vaults",       v: String(protocolStats.totalVaults) },
            { l: "Total TVL",         v: `${fmtUSD(protocolStats.totalTVL, { compact: true })} USDC` },
            { l: "Graduated",         v: String(protocolStats.graduatedVaults) },
            { l: "Protected capital", v: `${fmtUSD(protocolStats.protectedCapital, { compact: true })} USDC` },
          ].map((k, i) => (
            <motion.div
              key={k.l}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="surface rounded-lg p-4 relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground mb-1">{k.l}</div>
              <div className="font-display font-semibold text-xl tabular">{k.v}</div>
            </motion.div>
          ))}
        </div>

        {/* My positions strip */}
        {positions && positions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <WalletCards className="w-3 h-3 text-primary" /> My positions
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
              {positions.map((pos, i) => {
                if (!pos.vault) return null;
                const pnl = pos.currentValue - pos.totalDeposited;
                const pnlPct = pos.totalDeposited > 0
                  ? ((pnl / pos.totalDeposited) * 100)
                  : 0;
                const pnlPos = pnl >= 0;
                const health = pos.vault.juniorHealth;
                const healthBg = health < 20 ? "bg-destructive" : health < 50 ? "bg-warning" : "bg-success";
                return (
                  <motion.div
                    key={pos.pubkey}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.07 }}
                  >
                    <Link
                      to={`/vault/${pos.vault.id}`}
                      className="flex-shrink-0 w-[190px] surface rounded-[11px] p-4 block relative overflow-hidden
                        hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 group"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                      <p className="font-display font-semibold text-[13px] truncate leading-tight">
                        {pos.vault.name}
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5 mb-3">
                        {pos.vault.strategyTags?.slice(0, 2).join(" · ") || "Vault"}
                      </p>
                      <div className="font-display font-bold text-[18px] tabular leading-none">
                        {fmtUSD(pos.currentValue, { compact: true })}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 font-mono text-[10px] mt-1 font-medium tabular",
                        pnlPos ? "text-success" : "text-destructive"
                      )}>
                        {pnlPos
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />
                        }
                        {pnlPos ? "+" : ""}{fmtUSD(pnl, { compact: true })} ({pnlPos ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> Buffer</span>
                          <span className={cn(
                            health < 20 ? "text-destructive" : health < 50 ? "text-warning" : "text-success"
                          )}>{Math.round(health)}%</span>
                        </div>
                        <div className="h-[2px] bg-secondary/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", healthBg)} style={{ width: `${health}%` }} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="hidden lg:block w-60 shrink-0 surface rounded-lg p-5 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-auto scrollbar-thin">
            {Filters}
          </aside>

          {/* Main vault grid */}
          <div className="flex-1 min-w-0">
            <div className="surface mb-5 flex flex-wrap items-center gap-2.5 rounded-lg p-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vaults…"
                  className="pl-8 h-9 text-[13px]"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground"
              >
                <option value="tvl">Sort: TVL</option>
                <option value="health">Sort: Junior health</option>
                <option value="recent">Sort: Recently created</option>
              </select>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 lg:hidden">
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                  <div className="mt-6">{Filters}</div>
                </SheetContent>
              </Sheet>
              {(statuses.length > 0 || instantOnly || minHealth[0] > 0) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => { setStatuses([]); setMinHealth([0]); setInstantOnly(false); }}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="surface rounded-lg p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading vaults…
              </div>
            ) : error ? (
              <div className="surface rounded-lg p-12 text-center text-muted-foreground text-sm">
                Connect your wallet or configure the Arcadia API to browse vaults.
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {filtered.length} vault{filtered.length !== 1 && "s"} · senior deposits never expose trader execution controls
                  </span>
                  <span className="hidden font-mono text-[10px] text-primary/70 uppercase tracking-wider sm:inline">
                    Senior capital view
                  </span>
                </div>
                {filtered.length === 0 ? (
                  <div className="surface rounded-lg p-12 text-center text-muted-foreground text-sm">
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

          {/* Right sidebar */}
          <aside className="hidden w-68 shrink-0 space-y-4 xl:block">
            <div className="surface rounded-lg p-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <WalletCards className="h-3.5 w-3.5 text-primary" />
                My portfolio
              </div>
              <div className="font-display text-2xl font-bold tabular">{fmtUSD(portfolioStats.currentValue, { compact: true })}</div>
              <div className={portfolioStats.pnl >= 0 ? "mt-1 font-mono text-[11px] text-success" : "mt-1 font-mono text-[11px] text-destructive"}>
                {portfolioStats.pnl >= 0 ? "+" : ""}{fmtUSD(portfolioStats.pnl, { compact: true })} unrealized
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-secondary/50 border border-border/50 p-3">
                  <div className="font-mono text-[10px] text-muted-foreground">Positions</div>
                  <div className="mt-1 font-mono text-[12px] text-foreground">{portfolioStats.count}</div>
                </div>
                <div className="rounded-lg bg-secondary/50 border border-border/50 p-3">
                  <div className="font-mono text-[10px] text-muted-foreground">Avg health</div>
                  <div className="mt-1 font-mono text-[12px] text-success">{portfolioStats.avgHealth}%</div>
                </div>
              </div>
            </div>

            <div className="surface rounded-lg p-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Trust rails
              </div>
              <div className="space-y-3 text-[12px] text-muted-foreground leading-relaxed">
                <p>Trader junior capital takes first loss before senior deposits.</p>
                <p>Instant exits unlock when the junior buffer drops below 20%.</p>
                <p>Paper vaults cannot accept investor deposits until graduation.</p>
              </div>
            </div>

            <div className="surface rounded-lg p-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Live activity
              </div>
              <div className="space-y-2">
                {allVaults.slice(0, 5).map((vault) => (
                  <div key={vault.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-mono text-[11px] text-muted-foreground truncate">{vault.name}</span>
                    <span className="font-mono text-[11px] text-foreground shrink-0">{vault.juniorHealth}%</span>
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
