"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Filter, Search } from "lucide-react";

import { apiFetch, cn } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { Reveal } from "@/components/acid";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import {
  HeaderAura,
  Kicker,
  PageContainer,
  Panel,
  SectionTitle,
} from "@/components/pages/discovery/bits";
import { TraderMarketCard } from "@/components/pages/discovery/TraderMarketCard";
import { useWatchlist } from "@/components/pages/discovery/use-watchlist";

type SortKey = "score" | "return_30d" | "aum" | "sortino";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "return_30d", label: "30d" },
  { key: "aum", label: "AUM" },
  { key: "sortino", label: "Sortino" },
];

function SkeletonMarketCard() {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="h-7 w-10" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-4 h-12 w-full" />
      <Skeleton className="mt-4 h-8 w-full" />
    </Panel>
  );
}

export default function TradersPage() {
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const { watchlist, toggle } = useWatchlist();

  const { data, isLoading, error, refetch } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const filtered = (data ?? [])
    .filter((t) => {
      if (onlyOpen && !t.deposits_open) return false;
      if (watchlistOnly && !watchlist.includes(t.handle)) return false;
      if (search && !t.handle.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "return_30d") return b.return_30d - a.return_30d;
      if (sort === "aum") return b.aum - a.aum;
      if (sort === "sortino") return b.sortino - a.sortino;
      return 0;
    });

  const clearFilters = () => {
    setSearch("");
    setOnlyOpen(false);
    setSort("score");
    setWatchlistOnly(false);
  };

  return (
    <div className="relative min-h-full bg-void">
      <PageContainer>
        {/* header */}
        <div className="relative">
          <HeaderAura />
          <Reveal>
            <Kicker>Trader Marketplace</Kicker>
            <SectionTitle className="mt-4">Back the proven.</SectionTitle>
            <p className="mt-3 max-w-[60ch] font-mono text-sm text-muted tabular-nums">
              {`${data?.length ?? 0} verified traders // fund any vault with USDC // capacity scales with score`}
            </p>
          </Reveal>
        </div>

        {/* filter bar */}
        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
              />
              <Input
                type="search"
                aria-label="Search trader handle"
                placeholder="Search trader handle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setWatchlistOnly((v) => !v)}
              aria-pressed={watchlistOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 font-mono text-xs font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
                watchlistOnly
                  ? "border-acid/40 bg-acid/10 text-acid"
                  : "border-line bg-panel-2 text-faint hover:text-ink",
              )}
            >
              {watchlistOnly ? (
                <BookmarkCheck className="size-3.5" aria-hidden />
              ) : (
                <Bookmark className="size-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">
                Watchlist{watchlist.length > 0 ? ` (${watchlist.length})` : ""}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div
              role="group"
              aria-label="Sort traders"
              className="flex items-center rounded-lg border border-line bg-panel-2 p-1"
            >
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={cn(
                    "rounded-md px-4 py-1.5 font-mono text-[11px] font-bold tracking-[0.14em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
                    sort === s.key ? "bg-acid text-void" : "text-faint hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={onlyOpen}
              onClick={() => setOnlyOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-1 py-1 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <span
                aria-hidden
                className={cn(
                  "relative h-4 w-8 rounded-full border transition-colors motion-reduce:transition-none",
                  onlyOpen ? "border-acid bg-acid" : "border-line bg-panel-2",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 size-3 rounded-full transition-transform motion-reduce:transition-none",
                    onlyOpen ? "translate-x-4 bg-void" : "bg-ink",
                  )}
                />
              </span>
              <span
                className={cn(
                  "font-mono text-xs font-bold tracking-[0.14em] uppercase",
                  onlyOpen ? "text-ink" : "text-faint",
                )}
              >
                Open Vaults
              </span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-8">
            <ErrorState message="Failed to load traders" onRetry={() => refetch()} />
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonMarketCard key={i} />)
            : filtered.map((t) => {
                const watched = watchlist.includes(t.handle);
                return (
                  <TraderMarketCard
                    key={t.handle}
                    trader={t}
                    action={
                      <button
                        type="button"
                        onClick={() => toggle(t.handle)}
                        aria-pressed={watched}
                        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                        className={cn(
                          "grid size-7 place-items-center rounded-lg border backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void motion-reduce:transition-none",
                          watched
                            ? "border-acid/40 bg-acid/10 text-acid"
                            : "border-line bg-void/60 text-faint hover:text-ink",
                        )}
                      >
                        {watched ? (
                          <BookmarkCheck className="size-3.5" aria-hidden />
                        ) : (
                          <Bookmark className="size-3.5" aria-hidden />
                        )}
                      </button>
                    }
                  />
                );
              })}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-line bg-panel py-24 text-center">
            <Filter aria-hidden className="mx-auto mb-4 size-8 text-faint" />
            <p className="text-lg font-bold text-ink">No traders found</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {watchlistOnly && watchlist.length === 0
                ? "Your watchlist is empty. Tap the bookmark on any trader to follow them."
                : "Try adjusting your search or filters."}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-lg border border-line bg-panel-2 px-6 py-2 font-mono text-xs font-bold tracking-[0.14em] text-ink uppercase transition-colors hover:border-acid/40 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              Clear all filters
            </button>
          </div>
        ) : null}
      </PageContainer>
    </div>
  );
}
