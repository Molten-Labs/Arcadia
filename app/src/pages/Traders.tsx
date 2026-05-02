import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useManagers } from "@/hooks/useVaults";
import { TraderCard } from "@/components/TraderCard";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Users } from "lucide-react";

const Traders = () => {
  const { data: managers, isLoading } = useManagers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"vaults" | "junior" | "recent">("vaults");

  const allManagers = useMemo(() => managers ?? [], [managers]);

  const filtered = useMemo(() => {
    return allManagers
      .filter(m => m.owner.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sort === "junior") return b.totalJuniorDeposited - a.totalJuniorDeposited;
        if (sort === "recent") return b.createdAt - a.createdAt;
        return b.totalVaults - a.totalVaults;
      });
  }, [allManagers, query, sort]);

  const activeCount = allManagers.filter(m => m.activeVaults > 0).length;

  return (
    <Layout>
      <div className="container py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="page-header-label">
              <Users className="w-3 h-3" /> Verified managers
            </span>
            <h1 className="font-display type-h1 font-semibold mt-3">Arcadia traders</h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-[14px]">
              Discover managers who earned investor trust on-chain. Compare track records, junior capital committed, and vault performance.
            </p>
          </div>
          {allManagers.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="surface rounded-lg px-4 py-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Registered</div>
                <div className="font-display font-semibold text-xl tabular mt-0.5">{allManagers.length}</div>
              </div>
              <div className="surface rounded-lg px-4 py-2.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Active</div>
                <div className="font-display font-semibold text-xl tabular mt-0.5 text-success">{activeCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* Search + sort */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by address…"
              className="pl-8 h-9 text-[13px]"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground"
          >
            <option value="vaults">Sort: Most vaults</option>
            <option value="junior">Sort: Most junior capital</option>
            <option value="recent">Sort: Recently joined</option>
          </select>
        </div>

        {isLoading ? (
          <div className="surface rounded-lg p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading managers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface rounded-lg p-12 text-center text-muted-foreground text-sm">
            {allManagers.length === 0
              ? "No managers found on-chain yet."
              : "No managers match your search."}
          </div>
        ) : (
          <>
            <p className="font-mono text-[11px] text-muted-foreground mb-4">
              {filtered.length} manager{filtered.length !== 1 && "s"} registered
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(m => <TraderCard key={m.pubkey} manager={m} />)}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Traders;
