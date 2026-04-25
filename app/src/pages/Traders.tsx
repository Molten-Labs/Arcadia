import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { traders, TraderTier } from "@/lib/mockData";
import { TraderCard } from "@/components/TraderCard";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

const tierOptions: TraderTier[] = ["novice", "proven", "established", "veteran", "elite"];

const Traders = () => {
  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<TraderTier[]>([]);
  const [sort, setSort] = useState<"reputation" | "pnl" | "drawdown" | "tvl">("reputation");

  const filtered = useMemo(() => {
    return traders
      .filter(t => tiers.length === 0 || tiers.includes(t.tier))
      .filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.handle.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sort === "pnl") return b.pnl90d - a.pnl90d;
        if (sort === "drawdown") return b.maxDrawdown - a.maxDrawdown;
        if (sort === "tvl") return b.totalAUM - a.totalAUM;
        return b.reputation - a.reputation;
      });
  }, [tiers, query, sort]);

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl">Traders</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Discover traders who earned investor trust on-chain. Compare track records, drawdowns, and risk behavior side-by-side.</p>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-60 shrink-0 surface rounded-2xl p-5 sticky top-24 self-start">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tier</h3>
            <div className="space-y-2">
              {tierOptions.map(t => (
                <label key={t} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                  <Checkbox checked={tiers.includes(t)} onCheckedChange={() => setTiers(tiers.includes(t) ? tiers.filter(x => x !== t) : [...tiers, t])} />
                  {t}
                </label>
              ))}
            </div>
          </aside>
          <div className="flex-1">
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search traders..." className="pl-9" />
              </div>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as "reputation" | "pnl" | "drawdown" | "tvl")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="reputation">Sort: Reputation</option>
                <option value="pnl">Sort: 90d PnL</option>
                <option value="drawdown">Sort: Lowest drawdown</option>
                <option value="tvl">Sort: TVL managed</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(t => <TraderCard key={t.wallet} trader={t} />)}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Traders;
