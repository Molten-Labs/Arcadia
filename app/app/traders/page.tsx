"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TraderCard } from "@/components/TraderCard";
import { SkeletonTraderCard } from "@/components/SkeletonCard";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";

type SortKey = "score" | "return_30d" | "aum" | "sortino";

export default function TradersPage() {
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const filtered = (data ?? [])
    .filter((t) => {
      if (onlyOpen && !t.deposits_open) return false;
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
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
              Trader Marketplace
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
              {data?.length ?? 0} traders · fund any vault with USDC
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input
            type="search"
            placeholder="Search handle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm outline-none w-48"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              color: "var(--color-ink)",
            }}
          />

          <div className="flex items-center gap-1">
            {(["score", "return_30d", "aum", "sortino"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: sort === k ? "var(--color-purple)" : "var(--color-panel)",
                  border: `1px solid ${sort === k ? "var(--color-purple)" : "var(--color-line)"}`,
                  color: sort === k ? "white" : "var(--color-muted)",
                  boxShadow: sort === k ? "0 0 12px rgba(124,58,237,0.3)" : "none",
                }}
              >
                {k === "return_30d" ? "30d Return" : k === "aum" ? "AUM" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-muted)" }}>
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
              className="rounded"
            />
            Deposits open only
          </label>
        </div>

        {error && <ErrorState message="Failed to load traders" onRetry={() => refetch()} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonTraderCard key={i} />)
            : filtered.map((t) => <TraderCard key={t.handle} trader={t} />)}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              No traders match your filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
