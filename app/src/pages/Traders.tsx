import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useManagers } from "@/hooks/useVaults";
import { TraderCard } from "@/components/TraderCard";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

const Traders = () => {
  const { data: managers, isLoading } = useManagers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"vaults" | "junior" | "recent">("vaults");

  const allManagers = managers ?? [];

  const filtered = useMemo(() => {
    return allManagers
      .filter(m => m.owner.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sort === "junior") return b.totalJuniorDeposited - a.totalJuniorDeposited;
        if (sort === "recent") return b.createdAt - a.createdAt;
        return b.totalVaults - a.totalVaults;
      });
  }, [allManagers, query, sort]);

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl">Traders</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Discover managers who earned investor trust on-chain. Compare track records and vault performance.</p>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by address..." className="pl-9" />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as typeof sort)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="vaults">Sort: Most vaults</option>
              <option value="junior">Sort: Most junior capital</option>
              <option value="recent">Sort: Recently joined</option>
            </select>
          </div>

          {isLoading ? (
            <div className="surface rounded-2xl p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading managers...
            </div>
          ) : filtered.length === 0 ? (
            <div className="surface rounded-2xl p-10 text-center text-muted-foreground">
              {allManagers.length === 0
                ? "No managers found on-chain yet."
                : "No managers match your search."}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(m => <TraderCard key={m.pubkey} manager={m} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Traders;
