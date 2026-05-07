import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useManagers } from "@/hooks/useVaults";
import type { ManagerView } from "@/hooks/useVaults";
import { traders as MOCK_TRADERS } from "@/lib/mockData";
import type { TraderTier } from "@/lib/mockData";
import { TierBadge } from "@/components/TierBadge";
import { fmtUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
    Search, ArrowUpRight, BadgeCheck,
    ChevronUp, ChevronDown, ChevronsUpDown,
    Loader2, AlertTriangle, Zap, Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { shortAddr } from "@/lib/wallet";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderEntry extends ManagerView {
    rank: number;
    name: string;
    handle: string;
    tier: TraderTier;
    reputation: number;
    nextTierAt: number;
    pnl30d: number;
    pnl90d: number;
    pnlAllTime: number;
    maxDrawdown: number;
    totalAUM: number;
    freezeCount: number;
    cooldownCount: number;
    strategyTags: string[];
    joinedAt: string;
}

type SortKey = "rank" | "reputation" | "totalAUM" | "pnl30d" | "pnl90d" | "pnlAllTime" | "maxDrawdown" | "totalVaults";
type SortDir = "asc" | "desc";

const TIER_ORDER: TraderTier[] = ["elite", "veteran", "established", "proven", "novice"];

const AVATAR_SEEDS = [
    "from-primary to-primary-glow",
    "from-primary-deep to-primary",
    "from-foreground to-primary",
    "from-primary-glow to-primary",
    "from-primary-deep to-primary-glow",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradient(seed: string): string {
    return AVATAR_SEEDS[seed.charCodeAt(0) % AVATAR_SEEDS.length];
}

function pnlClass(v: number): string {
    return v > 0 ? "text-foreground/80" : v < 0 ? "text-muted-foreground" : "text-muted-foreground";
}

function pnlFmt(v: number): string {
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
    if (col !== active) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return dir === "desc"
        ? <ChevronDown className="w-3 h-3 text-primary" />
        : <ChevronUp className="w-3 h-3 text-primary" />;
}

// ─── Leaderboard page ─────────────────────────────────────────────────────────

const Traders = () => {
    const { data: managers, isLoading } = useManagers();

    const [query,   setQuery]   = useState("");
    const [tier,    setTier]    = useState<TraderTier | "all">("all");
    const [sortKey, setSortKey] = useState<SortKey>("rank");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // Merge on-chain manager records with rich mock data
    const entries: LeaderEntry[] = useMemo(() => {
        const raw = managers ?? [];
        const enriched = raw.map<LeaderEntry>((m, i) => {
            const mock = MOCK_TRADERS.find(t => t.wallet === m.owner);
            return {
                ...m,
                rank: i + 1,
                name:        mock?.name         ?? shortAddr(m.owner),
                handle:      mock?.handle       ?? m.owner.slice(0, 6),
                tier:        mock?.tier         ?? "novice",
                reputation:  Math.round(m.reputationScore ?? mock?.reputation ?? 0),
                nextTierAt:  mock?.nextTierAt   ?? 100,
                pnl30d:      m.pnl30d ?? mock?.pnl30d ?? 0,
                pnl90d:      mock?.pnl90d       ?? 0,
                pnlAllTime:  mock?.pnlAllTime   ?? 0,
                maxDrawdown: m.maxDrawdown ?? mock?.maxDrawdown ?? 0,
                totalAUM:    m.capitalHandled ?? mock?.totalAUM ?? m.totalJuniorDeposited,
                freezeCount: m.frozenVaultCount ?? mock?.freezeCount ?? 0,
                cooldownCount: mock?.cooldownCount ?? 0,
                strategyTags: mock?.strategyTags ?? [],
                joinedAt:    mock?.joinedAt     ?? new Date(m.createdAt * 1000).toISOString().slice(0, 10),
            };
        });

        // Rank by reputation desc before applying user sort
        enriched.sort((a, b) => b.reputation - a.reputation);
        enriched.forEach((e, i) => { e.rank = i + 1; });
        return enriched;
    }, [managers]);

    // Summary stats
    const stats = useMemo(() => ({
        total:    entries.length,
        active:   entries.filter(e => e.activeVaults > 0).length,
        aum:      entries.reduce((s, e) => s + e.totalAUM, 0),
        junior:   entries.reduce((s, e) => s + e.totalJuniorDeposited, 0),
        elite:    entries.filter(e => e.tier === "elite" || e.tier === "veteran").length,
    }), [entries]);

    // Filter + sort
    const displayed = useMemo(() => {
        let list = entries.filter(e => {
            const q = query.toLowerCase();
            const matchQ = !q
                || e.name.toLowerCase().includes(q)
                || e.handle.toLowerCase().includes(q)
                || e.owner.toLowerCase().includes(q);
            const matchT = tier === "all" || e.tier === tier;
            return matchQ && matchT;
        });

        list = [...list].sort((a, b) => {
            const mul = sortDir === "desc" ? -1 : 1;
            switch (sortKey) {
                case "rank":        return mul * (a.rank - b.rank);
                case "reputation":  return mul * (a.reputation - b.reputation);
                case "totalAUM":    return mul * (a.totalAUM - b.totalAUM);
                case "pnl30d":      return mul * (a.pnl30d - b.pnl30d);
                case "pnl90d":      return mul * (a.pnl90d - b.pnl90d);
                case "pnlAllTime":  return mul * (a.pnlAllTime - b.pnlAllTime);
                case "maxDrawdown": return mul * (a.maxDrawdown - b.maxDrawdown);
                case "totalVaults": return mul * (a.totalVaults - b.totalVaults);
                default:            return 0;
            }
        });
        return list;
    }, [entries, query, tier, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === "desc" ? "asc" : "desc");
        } else {
            setSortKey(key);
            setSortDir(key === "maxDrawdown" ? "asc" : "desc");
        }
    };

    const thClass = "px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-normal whitespace-nowrap text-right cursor-pointer hover:text-foreground transition-colors select-none";
    const thFirst = "px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-normal whitespace-nowrap text-left cursor-pointer hover:text-foreground transition-colors select-none";

    return (
        <Layout>
            <div className="container py-10">

                {/* ── Header ── */}
                <div className="mb-8">
                    <span className="page-header-label">
                        <Activity className="w-3 h-3" /> Trader records
                    </span>
                    <h1 className="font-display type-h1 font-semibold mt-3">Arcadia Traders</h1>
                    <p className="text-muted-foreground mt-2 max-w-xl text-[14px]">
                        Ranked by reputation score. Every metric earned on-chain — verified track records, junior capital at risk, and drawdown history.
                    </p>
                </div>

                {/* ── Summary stats ── */}
                {!isLoading && entries.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        {[
                            { label: "Registered",      value: stats.total,                      sub: `${stats.active} active now` },
                            { label: "Elite + Veteran", value: stats.elite,                      sub: "top-tier managers" },
                            { label: "Total AUM",       value: fmtUSD(stats.aum, { compact: true }), sub: "across all vaults" },
                            { label: "Junior Capital",  value: fmtUSD(stats.junior, { compact: true }), sub: "at-risk first-loss" },
                        ].map(s => (
                            <div key={s.label} className="surface rounded-lg px-4 py-3">
                                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-1">{s.label}</div>
                                <div className="font-display font-semibold text-xl tabular-nums">{s.value}</div>
                                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filters ── */}
                <div className="flex flex-wrap gap-2.5 mb-5">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search name, handle, wallet…"
                            className="pl-8 h-9 text-[13px]"
                        />
                    </div>
                    <select
                        value={tier}
                        onChange={e => setTier(e.target.value as typeof tier)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground outline-none cursor-pointer"
                    >
                        <option value="all">All tiers</option>
                        {TIER_ORDER.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                    <div className="ml-auto font-mono text-[11px] text-muted-foreground flex items-center">
                        {displayed.length} trader{displayed.length !== 1 && "s"}
                    </div>
                </div>

                {/* ── Loading / empty ── */}
                {isLoading ? (
                    <div className="surface rounded-lg p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading leaderboard…
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="surface rounded-lg p-12 text-center text-muted-foreground text-sm">
                        {entries.length === 0 ? "No traders found on-chain yet." : "No traders match your filter."}
                    </div>
                ) : (

                    /* ── Leaderboard table ── */
                    <div className="surface rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-border/40">
                                    <tr>
                                        <th className={thFirst} style={{ width: 44 }} onClick={() => toggleSort("rank")}>
                                            <span className="flex items-center gap-1"># <SortIcon col="rank" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={cn(thFirst, "min-w-[180px]")}>Trader</th>
                                        <th className={thFirst}>Tier</th>
                                        <th className={cn(thClass, "min-w-[120px]")} onClick={() => toggleSort("reputation")}>
                                            <span className="flex items-center justify-end gap-1">Rep <SortIcon col="reputation" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("totalVaults")}>
                                            <span className="flex items-center justify-end gap-1">Vaults <SortIcon col="totalVaults" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("totalAUM")}>
                                            <span className="flex items-center justify-end gap-1">AUM <SortIcon col="totalAUM" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("pnl30d")}>
                                            <span className="flex items-center justify-end gap-1">30D <SortIcon col="pnl30d" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("pnl90d")}>
                                            <span className="flex items-center justify-end gap-1">90D <SortIcon col="pnl90d" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("pnlAllTime")}>
                                            <span className="flex items-center justify-end gap-1">All-time <SortIcon col="pnlAllTime" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={thClass} onClick={() => toggleSort("maxDrawdown")}>
                                            <span className="flex items-center justify-end gap-1">Max DD <SortIcon col="maxDrawdown" active={sortKey} dir={sortDir} /></span>
                                        </th>
                                        <th className={cn(thFirst, "text-left")}>Status</th>
                                        <th className="w-8" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayed.map((e, rowIdx) => {
                                        const repProgress = Math.min(100, (e.reputation / e.nextTierAt) * 100);
                                        const isTopThree = e.rank <= 3;
                                        return (
                                            <tr
                                                key={e.pubkey}
                                                className={cn(
                                                    "border-b border-border/20 hover:bg-card/50 transition-colors group",
                                                    rowIdx === 0 && "bg-primary/[0.025]"
                                                )}
                                            >
                                                {/* Rank */}
                                                <td className="px-3 py-3.5">
                                                    <span className={cn(
                                                        "font-mono text-[12px] font-semibold tabular-nums",
                                                        isTopThree ? "text-primary/80" : "text-muted-foreground/50"
                                                    )}>
                                                        {String(e.rank).padStart(2, "0")}
                                                    </span>
                                                </td>

                                                {/* Identity */}
                                                <td className="px-3 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-display font-bold text-[11px] shrink-0",
                                                            gradient(e.owner)
                                                        )}>
                                                            {e.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium text-[13px] text-foreground truncate">{e.name}</span>
                                                                <BadgeCheck className="w-3 h-3 text-primary/50 shrink-0" />
                                                            </div>
                                                            <div className="font-mono text-[10px] text-muted-foreground">
                                                                @{e.handle} · {shortAddr(e.owner)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Tier */}
                                                <td className="px-3 py-3.5">
                                                    <TierBadge tier={e.tier} className="text-[10px] py-0.5 px-2" />
                                                </td>

                                                {/* Reputation + progress */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="font-mono text-[12px] font-semibold text-foreground tabular-nums">{e.reputation.toLocaleString()}</span>
                                                        <div className="w-16 h-[3px] bg-card/80 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary/60 rounded-full transition-all"
                                                                style={{ width: `${repProgress}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-mono text-[8px] text-muted-foreground/60">
                                                            {e.reputation}/{e.nextTierAt}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Vaults */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <div className="font-mono text-[12px] text-foreground tabular-nums">{e.totalVaults}</div>
                                                    <div className="font-mono text-[10px] text-muted-foreground">
                                                        {e.activeVaults} active
                                                    </div>
                                                </td>

                                                {/* AUM */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <span className="font-mono text-[12px] text-foreground tabular-nums">
                                                        {fmtUSD(e.totalAUM, { compact: true })}
                                                    </span>
                                                </td>

                                                {/* PnL 30D */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <span className={cn("font-mono text-[12px] tabular-nums font-medium", pnlClass(e.pnl30d))}>
                                                        {pnlFmt(e.pnl30d)}
                                                    </span>
                                                </td>

                                                {/* PnL 90D */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <span className={cn("font-mono text-[12px] tabular-nums font-medium", pnlClass(e.pnl90d))}>
                                                        {pnlFmt(e.pnl90d)}
                                                    </span>
                                                </td>

                                                {/* All-time */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <span className={cn("font-mono text-[12px] tabular-nums font-medium", pnlClass(e.pnlAllTime))}>
                                                        {pnlFmt(e.pnlAllTime)}
                                                    </span>
                                                </td>

                                                {/* Max drawdown */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <span className={cn(
                                                        "font-mono text-[12px] tabular-nums",
                                                        e.maxDrawdown < -15 ? "text-muted-foreground" : "text-foreground/70"
                                                    )}>
                                                        {e.maxDrawdown.toFixed(1)}%
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-3 py-3.5">
                                                    <div className="flex flex-col gap-1">
                                                        {e.activeVaults > 0 && (
                                                            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-primary/80 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5 w-fit">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                                                                {e.activeVaults} live
                                                            </span>
                                                        )}
                                                        {e.freezeCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground bg-card/60 border border-border/40 rounded-full px-2 py-0.5 w-fit">
                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                {e.freezeCount} freeze{e.freezeCount !== 1 && "s"}
                                                            </span>
                                                        )}
                                                        {e.cooldownCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground bg-card/60 border border-border/40 rounded-full px-2 py-0.5 w-fit">
                                                                <Zap className="w-2.5 h-2.5" />
                                                                {e.cooldownCount} cooldown{e.cooldownCount !== 1 && "s"}
                                                            </span>
                                                        )}
                                                        {e.activeVaults === 0 && e.freezeCount === 0 && e.cooldownCount === 0 && (
                                                            <span className="font-mono text-[9px] text-muted-foreground/50">—</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="px-3 py-3.5 text-right">
                                                    <Link
                                                        to={`/trader/${e.owner}`}
                                                        className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        View <ArrowUpRight className="w-3 h-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer hint */}
                        <div className="px-4 py-3 border-t border-border/20 flex items-center justify-between">
                            <p className="font-mono text-[10px] text-muted-foreground/60">
                                Reputation = on-chain vault performance × graduated vaults × investor trust score
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground/40">
                                Arcadia realtime · API-backed when configured
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Traders;
