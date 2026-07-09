"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TraderCard } from "@/components/TraderCard";
import { SkeletonTraderCard } from "@/components/SkeletonCard";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { Search, Filter, Bookmark, BookmarkCheck } from "lucide-react";

type SortKey = "score" | "return_30d" | "aum" | "sortino";

function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("arcadia_watchlist");
      if (s) setWatchlist(JSON.parse(s));
    } catch {}
  }, []);
  const toggle = (handle: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle];
      localStorage.setItem("arcadia_watchlist", JSON.stringify(next));
      return next;
    });
  };
  return { watchlist, toggle };
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

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--color-ink)" }}>
            Trader Marketplace
          </h1>
          <p className="text-sm mt-2 font-medium" style={{ color: "var(--color-muted)" }}>
            {data?.length ?? 0} elite traders · Fund any vault with USDC · Capacity scales with score
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 p-4 rounded-xl"
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>

          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} style={{ color: "var(--color-faint)" }} />
              </div>
              <input
                type="search"
                placeholder="Search trader handle…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
                style={{
                  background: "var(--color-panel-2)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-ink)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--color-mint)"; e.target.style.boxShadow = "0 0 0 2px var(--color-mint-dim)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--color-line)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Watchlist filter */}
            <button
              onClick={() => setWatchlistOnly((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: watchlistOnly ? "rgba(79,158,255,0.12)" : "var(--color-panel-2)",
                border: `1px solid ${watchlistOnly ? "rgba(79,158,255,0.3)" : "var(--color-line)"}`,
                color: watchlistOnly ? "var(--color-mint)" : "var(--color-faint)",
              }}
            >
              {watchlistOnly ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
              <span className="hidden sm:inline">Watchlist{watchlist.length > 0 && ` (${watchlist.length})`}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Sort */}
            <div className="flex items-center p-1 rounded-lg" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
              {(["score", "return_30d", "aum", "sortino"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className="px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all"
                  style={{
                    background: sort === k ? "var(--color-mint)" : "transparent",
                    color: sort === k ? "#08090c" : "var(--color-faint)",
                  }}
                >
                  {k === "return_30d" ? "30d" : k === "aum" ? "AUM" : k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>

            <div className="h-8 w-px hidden md:block" style={{ background: "var(--color-line)" }} />

            {/* Open only toggle */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                className="w-8 h-4 rounded-full relative transition-colors duration-300"
                style={{
                  background: onlyOpen ? "var(--color-mint)" : "var(--color-panel-2)",
                  border: `1px solid ${onlyOpen ? "var(--color-mint)" : "var(--color-line)"}`,
                }}
              >
                <div
                  className="absolute top-[1px] w-3 h-3 rounded-full bg-white transition-all duration-300"
                  style={{ left: onlyOpen ? "calc(100% - 14px)" : "2px" }}
                />
              </div>
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="hidden" />
              <span
                className="text-xs font-bold uppercase tracking-widest transition-colors"
                style={{ color: onlyOpen ? "var(--color-ink)" : "var(--color-faint)" }}
              >
                Open Vaults
              </span>
            </label>
          </div>
        </div>

        {error && <ErrorState message="Failed to load traders" onRetry={() => refetch()} />}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonTraderCard key={i} />)
            : filtered.map((t) => (
                <div key={t.handle} className="relative group">
                  {/* Watchlist star overlay */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(t.handle); }}
                    className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    style={{
                      background: watchlist.includes(t.handle) ? "rgba(79,158,255,0.15)" : "rgba(8,9,12,0.6)",
                      border: `1px solid ${watchlist.includes(t.handle) ? "rgba(79,158,255,0.4)" : "var(--color-line)"}`,
                      backdropFilter: "blur(8px)",
                      opacity: watchlist.includes(t.handle) ? 1 : undefined,
                    }}
                    title={watchlist.includes(t.handle) ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    {watchlist.includes(t.handle)
                      ? <BookmarkCheck size={13} style={{ color: "var(--color-mint)" }} />
                      : <Bookmark size={13} style={{ color: "var(--color-faint)" }} />
                    }
                  </button>
                  <TraderCard trader={t} />
                </div>
              ))
          }
        </div>

        {!isLoading && filtered.length === 0 && (
          <div
            className="text-center py-24 rounded-xl"
            style={{ background: "var(--color-panel)", border: "1px dashed var(--color-line)" }}
          >
            <Filter size={32} className="mx-auto mb-4" style={{ color: "var(--color-faint)" }} />
            <p className="text-lg font-bold mb-2" style={{ color: "var(--color-ink)" }}>No traders found</p>
            <p className="text-sm font-medium mb-6" style={{ color: "var(--color-muted)" }}>
              {watchlistOnly && watchlist.length === 0
                ? "Your watchlist is empty — click the bookmark icon on any trader to follow them."
                : "Try adjusting your search or filters."}
            </p>
            <button
              onClick={() => { setSearch(""); setOnlyOpen(false); setSort("score"); setWatchlistOnly(false); }}
              className="text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-lg transition-colors"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
