import type {
  TraderListItem,
  TraderProfile,
  VaultInfo,
  LeaderboardEntry,
  PortfolioItem,
  TradeRecord,
  EquityPoint,
} from "./types";

function strToNum(s: unknown): number {
  if (typeof s === "number") return s;
  if (typeof s === "string") return parseFloat(s) || 0;
  return 0;
}

function strArrToNumArr(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [0, 0];
  return arr.map(strToNum);
}

export function transformTraderList(raw: unknown[], knownHandles: Record<string, Partial<TraderProfile>> = {}): TraderListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: any) => {
    const known = knownHandles[t.handle] || {};
    return {
      handle: t.handle ?? "",
      wallet: t.wallet ?? "",
      profile: t.profile ?? "",
      score: strToNum(t.score),
      tier: t.tier ?? "Verified",
      confidence: t.confidence ?? "low",
      capacity_usd: strToNum(t.capacity_usd),
      aum: strToNum(t.aum_usd),
      return_30d: known.metrics?.return_30d ?? strToNum(t.return_30d ?? 0),
      max_dd: known.metrics?.max_dd ?? strToNum(t.max_dd ?? 0),
      sortino: known.metrics?.sortino ?? strToNum(t.sortino ?? 0),
      deposits_open: t.deposits_open ?? true,
      style_tags: t.style_tags ?? known.style_tags ?? [],
      trader_self_funded: known.trader_self_funded ?? 0,
    };
  });
}

export function transformTraderProfile(raw: any, handle: string, fallback?: Partial<TraderProfile>): TraderProfile {
  const f = fallback ?? {};
  const ci = strArrToNumArr(raw.ci);
  const rawMetrics = raw.metrics ?? {};
  const rawEquity = Array.isArray(raw.equity_curve) ? raw.equity_curve : [];
  const rawTrades = Array.isArray(raw.trades) ? raw.trades : [];

  const equity_curve: EquityPoint[] = rawEquity.map((ep: any, i: number) => ({
    ts: ep.day ? new Date(ep.day + "T00:00:00Z").getTime() / 1000 : (f.equity_curve?.[i]?.ts ?? 0),
    value: strToNum(ep.nav ?? f.equity_curve?.[i]?.value),
  }));

  const trades: TradeRecord[] = rawTrades.map((tr: any, i: number) => ({
    id: tr.id ?? `${handle.slice(0, 4)}-t${i}`,
    market: tr.market ?? "",
    direction: typeof tr.direction === "number" ? (tr.direction === 1 ? "long" : "short") : (tr.direction ?? "long"),
    size_usd: strToNum(tr.size_usd),
    leverage: strToNum(tr.leverage_x ?? tr.leverage),
    entry_px: strToNum(tr.entry_px),
    exit_px: strToNum(tr.exit_px),
    realized_pnl: strToNum(tr.realized_pnl),
    fees_usd: strToNum(tr.fees_usd),
    was_liquidated: tr.was_liquidated ?? false,
    opened_at: tr.opened_at ? new Date(tr.opened_at).getTime() / 1000 : 0,
    closed_at: tr.closed_at ? new Date(tr.closed_at).getTime() / 1000 : 0,
    sig: tr.sig ?? undefined,
  }));

  const aum = strToNum(raw.aum_usd);
  const capacityTotal = strToNum(raw.capacity?.total_usd ?? raw.capacity_usd);
  const capacityUsed = strToNum(raw.capacity?.used_usd ?? raw.aum_usd);

  return {
    handle: raw.handle ?? handle,
    wallet: raw.wallet ?? f.wallet ?? "",
    profile: raw.profile ?? f.profile ?? "",
    score: strToNum(raw.score),
    tier: raw.tier ?? "Verified",
    confidence: (raw.confidence as any) ?? "low",
    ci: { lo: ci[0] || f.ci?.lo || 0, point: strToNum(raw.score), hi: ci[1] || f.ci?.hi || 0 },
    metrics: {
      sharpe: f.metrics?.sharpe ?? 0,
      sortino: strToNum(rawMetrics.sortino ?? raw.sortino ?? f.metrics?.sortino),
      win_rate: strToNum(rawMetrics.pct_profitable ?? raw.pct_profitable ?? f.metrics?.win_rate),
      avg_trade_duration_hours: f.metrics?.avg_trade_duration_hours ?? 0,
      total_trades: trades.length || f.metrics?.total_trades || 0,
      max_dd: strToNum(rawMetrics.max_dd ?? raw.max_dd ?? f.metrics?.max_dd),
      return_7d: f.metrics?.return_7d ?? 0,
      return_30d: f.metrics?.return_30d ?? 0,
      return_90d: f.metrics?.return_90d ?? 0,
      return_all: f.metrics?.return_all ?? 0,
      vol_30d: f.metrics?.vol_30d ?? 0,
    },
    equity_curve,
    trades,
    capacity: { total: capacityTotal || f.capacity?.total || 0, used: capacityUsed || f.capacity?.used || 0 },
    aum,
    investors_count: strToNum(raw.investors_count ?? raw.investorsCount ?? f.investors_count),
    trader_self_funded: f.trader_self_funded ?? 0,
    deposits_open: raw.deposits_open ?? true,
    days_active: strToNum(raw.days_active ?? raw.daysActive ?? f.days_active),
    trade_count: trades.length || strToNum(raw.trade_count ?? f.trade_count),
    style_tags: raw.style_tags ?? f.style_tags ?? [],
    max_leverage: f.max_leverage ?? 0,
    bio: f.bio ?? undefined,
  };
}

export function transformVaultInfo(raw: any, fallback?: Partial<VaultInfo>): VaultInfo {
  const f = fallback ?? {};
  return {
    nav_per_share: strToNum(raw.nav_per_share),
    total_shares: strToNum(raw.total_shares),
    aum: strToNum(raw.aum_usd ?? raw.aum),
    hwm: strToNum(raw.hwm_per_share ?? raw.hwm),
    status: (raw.status as any) ?? "active",
    capacity_usd: strToNum(raw.capacity_usd),
    trader_shares: strToNum(raw.trader_shares),
    deposits_open: raw.deposits_open ?? true,
    trader_claimable: strToNum(raw.trader_claimable ?? f.trader_claimable),
    base_mint: raw.base_mint ?? f.base_mint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    vault_token: raw.vault_token ?? f.vault_token ?? "",
    perf_fee_bps: strToNum(raw.perf_fee_bps ?? f.perf_fee_bps ?? 500),
    mgmt_fee_bps: strToNum(raw.mgmt_fee_bps ?? f.mgmt_fee_bps ?? 100),
    score_tier: (raw.score_tier ?? f.score_tier ?? "Verified") as any,
  };
}

export function transformVaultTrades(raw: unknown[], handle: string): TradeRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((tr: any, i: number) => ({
    id: `${handle.slice(0, 4)}-vt${i}`,
    market: tr.market ?? "",
    direction: typeof tr.direction === "number" ? (tr.direction === 1 ? "long" : "short") : "long",
    size_usd: strToNum(tr.size_usd),
    leverage: strToNum(tr.leverage_x ?? tr.leverage),
    entry_px: strToNum(tr.entry_px),
    exit_px: strToNum(tr.exit_px),
    realized_pnl: strToNum(tr.realized_pnl),
    fees_usd: strToNum(tr.fees_usd),
    was_liquidated: tr.was_liquidated ?? false,
    opened_at: tr.opened_at ? new Date(tr.opened_at).getTime() / 1000 : 0,
    closed_at: tr.closed_at ? new Date(tr.closed_at).getTime() / 1000 : 0,
  }));
}

export function transformLeaderboard(raw: any, knownHandles: Record<string, Partial<TraderProfile>> = {}): LeaderboardEntry[] {
  const byScore = Array.isArray(raw.by_score) ? raw.by_score : [];
  return byScore.map((entry: any, i: number) => {
    const known = knownHandles[entry.handle] || {};
    return {
      rank: i + 1,
      handle: entry.handle ?? "",
      wallet: known.wallet ?? "",
      profile: known.profile ?? "",
      score: strToNum(entry.score),
      tier: entry.tier ?? "Verified",
      confidence: (entry.confidence as any) ?? "low",
      return_30d: known.metrics?.return_30d ?? 0,
      return_90d: known.metrics?.return_90d ?? 0,
      max_dd: known.metrics?.max_dd ?? 0,
      sortino: known.metrics?.sortino ?? 0,
      aum: known.aum ?? 0,
      trade_count: known.trade_count ?? 0,
      days_active: strToNum(entry.days_active ?? known.days_active),
    };
  });
}

export function transformPortfolio(raw: unknown[], handleLookup?: Record<string, any>): PortfolioItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const profile = p.profile ?? "";
    const trader_handle = p.trader_handle ?? profile.slice(0, 8);
    const value_usd = strToNum(p.value_usd);
    const cost_basis_usd = strToNum(p.cost_basis_usd);
    const pnl_usd = strToNum(p.pnl_usd ?? (value_usd - cost_basis_usd));
    return {
      profile,
      trader_handle,
      shares: strToNum(p.shares),
      value_usd,
      cost_basis_usd,
      pnl_usd,
      roi_pct: cost_basis_usd > 0 ? strToNum(p.roi_pct ?? ((pnl_usd / cost_basis_usd) * 100)) : 0,
    };
  });
}
