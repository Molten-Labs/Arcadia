import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useVaults, type VaultView } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtUSD } from "@/lib/format";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VaultStatus } from "@/components/StatusBadge";

const statusOptions: VaultStatus[] = ["active", "paper", "cooldown", "frozen"];

const Vaults = () => {
  const { data: vaults, isLoading, error } = useVaults();
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<VaultStatus[]>(["active", "paper"]);
  const [minHealth, setMinHealth] = useState([0]);
  const [instantOnly, setInstantOnly] = useState(false);
  const [sort, setSort] = useState<"tvl" | "health" | "recent">("tvl");

  const allVaults = vaults ?? [];

  const protocolStats = useMemo(() => ({
    totalVaults: allVaults.length,
    totalTVL: allVaults.reduce((s, v) => s + v.tvl, 0),
    graduatedVaults: allVaults.filter(v => v.status !== "paper").length,
    protectedCapital: allVaults.reduce((s, v) => s + v.seniorCapital, 0),
  }), [allVaults]);

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
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl">Vault marketplace</h1>
          <p className="text-muted-foreground mt-2">Discover managed vaults backed by trader skin in the game.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { l: "Live vaults", v: protocolStats.totalVaults },
            { l: "Total TVL", v: `${fmtUSD(protocolStats.totalTVL, { compact: true })} SOL` },
            { l: "Graduated", v: protocolStats.graduatedVaults },
            { l: "Protected capital", v: `${fmtUSD(protocolStats.protectedCapital, { compact: true })} SOL` },
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
            <div className="flex flex-wrap items-center gap-3 mb-5">
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
                Connect your wallet or configure the Kiln API to browse vaults.
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-4">{filtered.length} vault{filtered.length !== 1 && "s"}</div>
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
        </div>
      </div>
    </Layout>
  );
};

export default Vaults;
