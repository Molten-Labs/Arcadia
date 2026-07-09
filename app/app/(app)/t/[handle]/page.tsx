"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Share2,
  TrendingDown,
} from "lucide-react";

import { apiFetch, cn } from "@/lib/utils";
import { formatUSD, type TradeRecord, type TraderProfile } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import { MOCK_DAILY_PNL, MOCK_SCORE_HISTORY, MOCK_TRADERS } from "@/lib/mock-data";
import { EquityChart } from "@/components/EquityChart";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { ErrorState } from "@/components/ErrorState";
import { DepositModal } from "@/components/DepositModal";
import { ShareCardModal } from "@/components/ShareCardModal";
import { AcidButton, ChromeText, CountUp, Reveal, ScoreDial } from "@/components/acid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HeaderAura,
  Kicker,
  MonoLabel,
  PageContainer,
  Panel,
  StatTile,
  signTone,
} from "@/components/pages/discovery/bits";
import { Avatar } from "@/components/pages/discovery/Avatar";
import { acidTier, TierChip } from "@/components/pages/discovery/TierChip";
import { StatusPill } from "@/components/pages/discovery/StatusPill";
import { AllocationBar } from "@/components/pages/discovery/AllocationBar";
import { RiskRadar } from "@/components/pages/discovery/RiskRadar";
import { SideBadge, SolscanAccountLink, SolscanTxLink } from "@/components/pages/discovery/trade-cells";
import { useWatchlist } from "@/components/pages/discovery/use-watchlist";

/* -- Panel header used across profile sections -- */
function PanelHead({
  label,
  sub,
  right,
}: {
  label: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-panel-2 px-5 py-3.5">
      <div>
        <MonoLabel>{label}</MonoLabel>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

/* -- Overview: eight most recent trades -- */
function RecentTradesTable({ trades }: { trades: TradeRecord[] }) {
  return (
    <Table className="min-w-[640px] text-xs">
      <TableHeader>
        <TableRow className="bg-void hover:bg-transparent">
          <TableHead>Market</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Leverage</TableHead>
          <TableHead>PnL</TableHead>
          <TableHead>Closed</TableHead>
          <TableHead>On-chain</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-bold text-ink">{t.market.replace("-PERP", "")}</TableCell>
            <TableCell>
              <SideBadge direction={t.direction} />
            </TableCell>
            <TableCell className="text-muted tabular-nums">{formatUSD(t.size_usd, 0)}</TableCell>
            <TableCell className="font-bold text-ink tabular-nums">{t.leverage}x</TableCell>
            <TableCell className={`font-bold tabular-nums ${signTone(t.realized_pnl)}`}>
              {t.realized_pnl >= 0 ? "+" : ""}
              {formatUSD(t.realized_pnl, 0)}
            </TableCell>
            <TableCell className="text-[11px] text-faint tabular-nums">
              {new Date(t.closed_at * 1000).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <SolscanTxLink sig={t.sig} chars={6} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* -- Trades tab: full trade list -- */
function AllTradesTable({ trades }: { trades: TradeRecord[] }) {
  return (
    <Table className="min-w-[720px] text-xs">
      <TableHeader>
        <TableRow className="bg-void hover:bg-transparent">
          <TableHead>Market</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Leverage</TableHead>
          <TableHead>PnL</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Closed</TableHead>
          <TableHead>Sig</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-bold text-ink">{t.market.replace("-PERP", "")}</TableCell>
            <TableCell>
              <SideBadge direction={t.direction} />
            </TableCell>
            <TableCell className="text-muted tabular-nums">{formatUSD(t.size_usd, 0)}</TableCell>
            <TableCell className="font-bold tabular-nums">{t.leverage}x</TableCell>
            <TableCell className={`font-bold tabular-nums ${signTone(t.realized_pnl)}`}>
              {t.realized_pnl >= 0 ? "+" : ""}
              {formatUSD(t.realized_pnl, 0)}
            </TableCell>
            <TableCell className="text-[11px] text-faint tabular-nums">
              {((t.closed_at - t.opened_at) / 3600).toFixed(1)}h
            </TableCell>
            <TableCell className="text-[11px] text-faint tabular-nums">
              {new Date(t.closed_at * 1000).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <SolscanTxLink sig={t.sig} chars={5} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* -- Due diligence: drawdown analysis + benchmark -- */
function DrawdownTimeline({ trader }: { trader: TraderProfile }) {
  const curve = trader.equity_curve;
  let peak = curve[0]?.value ?? 1;
  const periods: { start: number; end: number; depth: number }[] = [];
  let inDD = false;
  let start = 0;
  let depth = 0;
  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    const dd = peak > 0 ? ((pt.value - peak) / peak) * 100 : 0;
    if (dd < -2 && !inDD) {
      inDD = true;
      start = pt.ts;
      depth = dd;
    } else if (inDD) {
      if (dd < depth) depth = dd;
      if (dd >= -0.5) {
        periods.push({ start, end: pt.ts, depth });
        inDD = false;
      }
    }
  }
  const btcCurve = trader.equity_curve.map((pt, i) => ({
    ts: pt.ts,
    value: 1.0 + (i / trader.equity_curve.length) * 0.38 + Math.sin(i * 0.4) * 0.06,
  }));

  const calmar = (trader.metrics.return_90d / Math.abs(trader.metrics.max_dd)).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Max Drawdown" valueClassName="text-danger" className="acid-int">
          {trader.metrics.max_dd.toFixed(1)}%
        </StatTile>
        <StatTile label="Calmar Ratio" className="acid-int">{calmar}</StatTile>
        <StatTile label="Volatility 30d" className="acid-int">
          {trader.metrics.vol_30d.toFixed(1)}%
        </StatTile>
        <StatTile label="Avg Win Duration" className="acid-int">
          {trader.metrics.avg_trade_duration_hours.toFixed(1)}h
        </StatTile>
      </div>

      {periods.length > 0 ? (
        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="size-3.5 text-danger" aria-hidden />
            <MonoLabel>Drawdown Periods</MonoLabel>
          </div>
          <div className="flex flex-col gap-2">
            {periods.slice(0, 5).map((p) => (
              <div key={`${p.start}-${p.end}`} className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[10px] text-faint tabular-nums">
                  {new Date(p.start * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <ArrowUpRight className="size-3 rotate-45 text-faint" aria-hidden />
                <span className="w-14 shrink-0 font-mono text-[10px] text-faint tabular-nums">
                  {new Date(p.end * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${Math.min(100, Math.abs(p.depth) * 5)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs font-bold text-danger tabular-nums">
                  {p.depth.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-3.5 text-acid" aria-hidden />
            <MonoLabel>vs BTC Benchmark</MonoLabel>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5 text-faint">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-ink" />@
              {trader.handle}
            </span>
            <span className="flex items-center gap-1.5 text-faint">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ background: "var(--color-cyan)" }}
              />
              BTC HODL
            </span>
          </div>
        </div>
        <EquityChart data={trader.equity_curve} benchmarkData={btcCurve} height={180} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="Trader 90d" valueClassName="text-success" className="acid-int">
            +{trader.metrics.return_90d.toFixed(1)}%
          </StatTile>
          <StatTile label="BTC HODL 90d" valueClassName="text-cyan" className="acid-int">
            +38.4%
          </StatTile>
        </div>
      </Panel>
    </div>
  );
}

/* -- Page -- */
export default function TraderProfilePage() {
  const params = useParams();
  const handle = params?.handle as string;
  const { role } = useRole();
  const isInvestor = role === "investor";
  const { watchlist, toggle } = useWatchlist();
  const [showShare, setShowShare] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  const { data: trader, isLoading, error, refetch } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  /* Estimate leaderboard rank from mock data */
  const rank = (() => {
    if (!trader) return null;
    const sorted = [...MOCK_TRADERS].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((t) => t.handle === trader.handle);
    return idx >= 0 ? idx + 1 : null;
  })();

  if (isLoading) {
    return (
      <div className="min-h-full bg-void">
        <PageContainer>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="size-44 rounded-full" />
          </div>
          <Skeleton className="mt-8 h-20 w-full" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </PageContainer>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="flex min-h-full items-center justify-center bg-void">
        <ErrorState message="Trader not found" onRetry={() => refetch()} />
      </div>
    );
  }

  const riskItems = [
    { label: "Sortino", value: trader.metrics.sortino, max: 5, fmt: (v: number) => v.toFixed(2) },
    { label: "Sharpe", value: trader.metrics.sharpe, max: 4, fmt: (v: number) => v.toFixed(2) },
    { label: "Win Rate", value: trader.metrics.win_rate, max: 100, fmt: (v: number) => `${v.toFixed(1)}%` },
    {
      label: "Max DD",
      value: Math.abs(trader.metrics.max_dd),
      max: 30,
      fmt: (v: number) => `-${v.toFixed(1)}%`,
      invert: true,
    },
  ];

  const isWatched = watchlist.includes(trader.handle);
  const scoreHistory = MOCK_SCORE_HISTORY[trader.handle];
  const dailyPnl = MOCK_DAILY_PNL[trader.handle];
  const capacityPct = Math.round((trader.aum / trader.capacity.total) * 100);

  const returns = [
    { label: "7d Return", value: trader.metrics.return_7d },
    { label: "30d Return", value: trader.metrics.return_30d },
    { label: "90d Return", value: trader.metrics.return_90d },
    { label: "All-time", value: trader.metrics.return_all },
  ];

  const quickStats = [
    { label: "Investors", value: trader.investors_count.toString() },
    { label: "Active Days", value: trader.days_active.toString() },
    { label: "Total Trades", value: trader.trade_count.toString() },
    { label: "Max Leverage", value: `${trader.max_leverage}x` },
  ];

  return (
    <div className="relative min-h-full bg-void">
      {/* -- HERO -- */}
      <div className="relative overflow-hidden border-b border-line">
        <HeaderAura />
        <PageContainer>
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-faint uppercase"
          >
            <Link href="/traders" className="transition-colors hover:text-acid">
              Marketplace
            </Link>
            <span aria-hidden>/</span>
            <span className="text-muted">@{trader.handle}</span>
          </nav>

          <Reveal>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              {/* identity */}
              <div className="min-w-0">
                <Kicker>Verified Trader</Kicker>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar handle={trader.handle} size={56} className="rounded-2xl" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ChromeText
                        as="h1"
                        className="font-display text-[clamp(1.9rem,5vw,3rem)] leading-none font-extrabold tracking-[-0.03em] uppercase"
                      >
                        @{trader.handle}
                      </ChromeText>
                      <CheckCircle className="size-4 shrink-0 text-acid" aria-hidden />
                    </div>
                    <SolscanAccountLink wallet={trader.wallet} className="mt-1" />
                  </div>
                </div>

                {trader.bio ? (
                  <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-muted">{trader.bio}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <TierChip tier={trader.tier} />
                  <StatusPill
                    deposits_open={trader.deposits_open}
                    capacityLeft={
                      trader.deposits_open
                        ? trader.capacity.total - trader.capacity.used
                        : undefined
                    }
                  />
                  {trader.style_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-line bg-panel-2 px-2.5 py-0.5 font-mono text-[10px] text-faint"
                    >
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShare(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-transparent px-3.5 py-2 font-mono text-xs font-semibold text-muted transition hover:border-acid/35 hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.97] motion-reduce:transition-none"
                  >
                    <Share2 className="size-3.5" aria-hidden /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(trader.handle)}
                    aria-pressed={isWatched}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-mono text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.97] motion-reduce:transition-none",
                      isWatched
                        ? "border-acid/40 bg-acid/10 text-acid"
                        : "border-line text-muted hover:text-ink",
                    )}
                  >
                    {isWatched ? (
                      <BookmarkCheck className="size-3.5" aria-hidden />
                    ) : (
                      <Bookmark className="size-3.5" aria-hidden />
                    )}
                    {isWatched ? "Watching" : "Watch"}
                  </button>
                </div>
              </div>

              {/* score dial hero */}
              <div className="flex shrink-0 items-center gap-6">
                {rank !== null ? (
                  <div className="text-right">
                    <MonoLabel>Rank</MonoLabel>
                    <p className="font-mono text-3xl font-bold text-ink tabular-nums">#{rank}</p>
                  </div>
                ) : null}
                <ScoreDial value={trader.score} tier={acidTier(trader.tier)} size={180} />
              </div>
            </div>
          </Reveal>
        </PageContainer>
      </div>

      {/* -- RETURN STRIP -- */}
      <div className="border-b border-line bg-onyx">
        <PageContainer className="py-0">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {returns.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "py-5",
                  i > 0 ? "md:border-l md:border-line md:pl-6" : "",
                  i < 3 ? "md:pr-6" : "",
                )}
              >
                <MonoLabel>{s.label}</MonoLabel>
                <p className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", signTone(s.value))}>
                  <CountUp
                    value={s.value}
                    decimals={1}
                    prefix={s.value >= 0 ? "+" : ""}
                    suffix="%"
                  />
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </div>

      {/* -- MAIN -- */}
      <PageContainer>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          {/* LEFT: tabs */}
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <div className="overflow-x-auto pb-1">
                <TabsList className="w-max">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trades">Trades</TabsTrigger>
                  <TabsTrigger value="dd">Due Diligence</TabsTrigger>
                  <TabsTrigger value="score">Score History</TabsTrigger>
                  <TabsTrigger value="heatmap">P&amp;L Heatmap</TabsTrigger>
                </TabsList>
              </div>

              {/* Overview */}
              <TabsContent value="overview" className="flex flex-col gap-6">
                <Panel className="overflow-hidden">
                  <PanelHead
                    label="Equity Curve"
                    sub="90-day performance history"
                    right={
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="acid-animate size-1.5 rounded-full bg-success"
                          style={{ animation: "acid-pulse 2s infinite" }}
                        />
                        <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
                          Live
                        </span>
                      </span>
                    }
                  />
                  <div className="px-4 pt-4 pb-2">
                    <EquityChart data={trader.equity_curve} height={280} />
                  </div>
                </Panel>

                {!isInvestor ? (
                  <Panel className="overflow-hidden">
                    <PanelHead
                      label="Recent Trades"
                      sub="On-chain verifiable execution history"
                      right={
                        <Link
                          href={`/t/${trader.handle}/trades`}
                          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] text-acid uppercase transition-opacity hover:opacity-70"
                        >
                          All {trader.trade_count} <ArrowUpRight className="size-3" aria-hidden />
                        </Link>
                      }
                    />
                    <RecentTradesTable trades={trader.trades.slice(0, 8)} />
                  </Panel>
                ) : null}
              </TabsContent>

              {/* Trades */}
              <TabsContent value="trades">
                <Panel className="overflow-hidden">
                  <PanelHead label={`All Trades // ${trader.trade_count} records`} />
                  <AllTradesTable trades={trader.trades} />
                </Panel>
              </TabsContent>

              {/* Due Diligence */}
              <TabsContent value="dd">
                <DrawdownTimeline trader={trader} />
              </TabsContent>

              {/* Score History */}
              <TabsContent value="score">
                <Panel className="p-5">
                  <MonoLabel>{`Score History // ${scoreHistory?.length ?? 0} days`}</MonoLabel>
                  <div className="mt-5">
                    {scoreHistory ? (
                      <ScoreHistoryChart data={scoreHistory} height={280} />
                    ) : (
                      <p className="py-16 text-center text-sm text-faint">
                        No score history available
                      </p>
                    )}
                  </div>
                </Panel>
              </TabsContent>

              {/* P&L Heatmap */}
              <TabsContent value="heatmap">
                <Panel className="p-5">
                  <MonoLabel>Daily P&amp;L Heatmap</MonoLabel>
                  <div className="mt-5">
                    {dailyPnl ? (
                      <PnLHeatmap data={dailyPnl} />
                    ) : (
                      <p className="py-16 text-center text-sm text-faint">No trade data available</p>
                    )}
                  </div>
                </Panel>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: sidebar */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            {/* Vault status */}
            <Panel className="acid-int p-5">
              <MonoLabel>Vault Status</MonoLabel>
              <div className="mt-3 flex items-center justify-between gap-3">
                <StatusPill
                  deposits_open={trader.deposits_open}
                  capacityLeft={
                    trader.deposits_open ? trader.capacity.total - trader.capacity.used : undefined
                  }
                />
                <span className="font-mono text-sm font-bold text-ink tabular-nums">
                  {formatUSD(trader.aum, 0)}
                </span>
              </div>
              <AllocationBar aum={trader.aum} total={trader.capacity.total} className="mt-3" />
              <p className="mt-2 font-mono text-[10px] text-faint tabular-nums">
                {`${formatUSD(trader.aum, 0)} of ${formatUSD(trader.capacity.total, 0)} // ${capacityPct}%`}
              </p>
              <AcidButton
                variant={trader.deposits_open ? "acid" : "ghost"}
                size="sm"
                className="mt-4 w-full"
                onClick={() => setShowDeposit(true)}
                disabled={!trader.deposits_open}
              >
                {trader.deposits_open ? "Fund Vault" : "Deposits Closed"}
              </AcidButton>
            </Panel>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
              {quickStats.map((s) => (
                <StatTile key={s.label} label={s.label} className="acid-int">
                  {s.value}
                </StatTile>
              ))}
            </div>

            {/* Risk profile */}
            <Panel className="acid-int p-5">
              <MonoLabel>Risk Profile</MonoLabel>
              <div className="mt-2">
                <RiskRadar items={riskItems} />
              </div>
            </Panel>
          </div>
        </div>
      </PageContainer>

      {showDeposit ? <DepositModal trader={trader} onClose={() => setShowDeposit(false)} /> : null}

      {showShare ? (
        <ShareCardModal
          data={{
            handle: trader.handle,
            score: trader.score,
            tier: trader.tier,
            return_30d: trader.metrics.return_30d,
            sortino: trader.metrics.sortino,
            max_dd: trader.metrics.max_dd,
            win_rate: trader.metrics.win_rate,
            wallet: trader.wallet,
          }}
          profileUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/arcadia/t/${trader.handle}`
              : `/arcadia/t/${trader.handle}`
          }
          onClose={() => setShowShare(false)}
        />
      ) : null}
    </div>
  );
}
