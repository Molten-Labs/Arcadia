/**
 * Typed boundary between the backend's loose JSON and the app's domain types.
 *
 * Raw* interfaces describe what the Rust API may send (every field optional,
 * numerics possibly stringified); the transform functions are the only place
 * that coerces them. Nothing downstream should ever see `any`.
 */
import type {
  TraderListItem,
  TraderProfile,
  VaultInfo,
  LeaderboardEntry,
  PortfolioItem,
  TradeRecord,
  EquityPoint,
  ScoreTier,
  Confidence,
  VaultStatus,
} from "./types";

/* ── Raw backend shapes ─────────────────────────────────────────────── */

type Numeric = string | number | null | undefined;

interface RawTraderListItem {
  handle?: string;
  wallet?: string;
  profile?: string;
  score?: Numeric;
  tier?: string;
  confidence?: string;
  capacity_usd?: Numeric;
  aum_usd?: Numeric;
  return_30d?: Numeric;
  max_dd?: Numeric;
  sortino?: Numeric;
  deposits_open?: boolean;
  style_tags?: string[];
}

interface RawEquityPoint {
  day?: string;
  nav?: Numeric;
}

interface RawTrade {
  id?: string;
  market?: string;
  direction?: number | string;
  size_usd?: Numeric;
  leverage?: Numeric;
  leverage_x?: Numeric;
  entry_px?: Numeric;
  exit_px?: Numeric;
  realized_pnl?: Numeric;
  fees_usd?: Numeric;
  was_liquidated?: boolean;
  opened_at?: string;
  closed_at?: string;
  sig?: string;
}

interface RawTraderProfile {
  handle?: string;
  wallet?: string;
  profile?: string;
  score?: Numeric;
  tier?: string;
  confidence?: string;
  ci?: unknown;
  metrics?: {
    sortino?: Numeric;
    pct_profitable?: Numeric;
    max_dd?: Numeric;
  };
  sortino?: Numeric;
  pct_profitable?: Numeric;
  max_dd?: Numeric;
  equity_curve?: RawEquityPoint[];
  trades?: RawTrade[];
  aum_usd?: Numeric;
  capacity_usd?: Numeric;
  capacity?: { total_usd?: Numeric; used_usd?: Numeric };
  investors_count?: Numeric;
  investorsCount?: Numeric;
  deposits_open?: boolean;
  days_active?: Numeric;
  daysActive?: Numeric;
  trade_count?: Numeric;
  style_tags?: string[];
}

interface RawVaultInfo {
  nav_per_share?: Numeric;
  total_shares?: Numeric;
  aum_usd?: Numeric;
  aum?: Numeric;
  hwm_per_share?: Numeric;
  hwm?: Numeric;
  status?: string;
  capacity_usd?: Numeric;
  trader_shares?: Numeric;
  deposits_open?: boolean;
  trader_claimable?: Numeric;
  base_mint?: string;
  vault_token?: string;
  perf_fee_bps?: Numeric;
  mgmt_fee_bps?: Numeric;
  score_tier?: string;
}

interface RawLeaderboardEntry {
  handle?: string;
  score?: Numeric;
  tier?: string;
  confidence?: string;
  days_active?: Numeric;
}

interface RawLeaderboard {
  by_score?: RawLeaderboardEntry[];
}

interface RawPortfolioItem {
  profile?: string;
  trader_handle?: string;
  shares?: Numeric;
  value_usd?: Numeric;
  cost_basis_usd?: Numeric;
  pnl_usd?: Numeric;
  roi_pct?: Numeric;
}

/* ── Coercion helpers ───────────────────────────────────────────────── */

function strToNum(s: unknown): number {
  if (typeof s === "number") return s;
  if (typeof s === "string") return parseFloat(s) || 0;
  return 0;
}

function strArrToNumArr(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [0, 0];
  return arr.map(strToNum);
}

const SCORE_TIERS: readonly ScoreTier[] = ["Verified", "Established", "Advanced", "Elite"];
function asTier(v: unknown): ScoreTier {
  return SCORE_TIERS.includes(v as ScoreTier) ? (v as ScoreTier) : "Verified";
}

const CONFIDENCES: readonly Confidence[] = ["low", "med", "high"];
function asConfidence(v: unknown): Confidence {
  return CONFIDENCES.includes(v as Confidence) ? (v as Confidence) : "low";
}

const VAULT_STATUSES: readonly VaultStatus[] = ["active", "paused", "closed"];
function asVaultStatus(v: unknown): VaultStatus {
  return VAULT_STATUSES.includes(v as VaultStatus) ? (v as VaultStatus) : "active";
}

function asDirection(v: RawTrade["direction"]): "long" | "short" {
  if (typeof v === "number") return v === 1 ? "long" : "short";
  return v === "short" ? "short" : "long";
}

function isoToUnix(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() / 1000 : 0;
}

/* ── Transforms ─────────────────────────────────────────────────────── */

export function transformTraderList(
  raw: unknown[],
  knownHandles: Record<string, Partial<TraderProfile>> = {},
): TraderListItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTraderListItem[]).map((t) => {
    const known = (t.handle && knownHandles[t.handle]) || {};
    return {
      handle: t.handle ?? "",
      wallet: t.wallet ?? "",
      profile: t.profile ?? "",
      score: strToNum(t.score),
      tier: asTier(t.tier),
      confidence: asConfidence(t.confidence),
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

export function transformTraderProfile(
  rawInput: unknown,
  handle: string,
  fallback?: Partial<TraderProfile>,
): TraderProfile {
  const raw = (rawInput ?? {}) as RawTraderProfile;
  const f = fallback ?? {};
  const ci = strArrToNumArr(raw.ci);
  const rawMetrics = raw.metrics ?? {};
  const rawEquity = Array.isArray(raw.equity_curve) ? raw.equity_curve : [];
  const rawTrades = Array.isArray(raw.trades) ? raw.trades : [];

  const equity_curve: EquityPoint[] = rawEquity.map((ep, i) => ({
    ts: ep.day
      ? new Date(ep.day + "T00:00:00Z").getTime() / 1000
      : (f.equity_curve?.[i]?.ts ?? 0),
    value: strToNum(ep.nav ?? f.equity_curve?.[i]?.value),
  }));

  const trades: TradeRecord[] = rawTrades.map((tr, i) => ({
    id: tr.id ?? `${handle.slice(0, 4)}-t${i}`,
    market: tr.market ?? "",
    direction: asDirection(tr.direction),
    size_usd: strToNum(tr.size_usd),
    leverage: strToNum(tr.leverage_x ?? tr.leverage),
    entry_px: strToNum(tr.entry_px),
    exit_px: strToNum(tr.exit_px),
    realized_pnl: strToNum(tr.realized_pnl),
    fees_usd: strToNum(tr.fees_usd),
    was_liquidated: tr.was_liquidated ?? false,
    opened_at: isoToUnix(tr.opened_at),
    closed_at: isoToUnix(tr.closed_at),
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
    tier: asTier(raw.tier),
    confidence: asConfidence(raw.confidence),
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
    capacity: {
      total: capacityTotal || f.capacity?.total || 0,
      used: capacityUsed || f.capacity?.used || 0,
    },
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

export function transformVaultInfo(rawInput: unknown, fallback?: Partial<VaultInfo>): VaultInfo {
  const raw = (rawInput ?? {}) as RawVaultInfo;
  const f = fallback ?? {};
  return {
    nav_per_share: strToNum(raw.nav_per_share),
    total_shares: strToNum(raw.total_shares),
    aum: strToNum(raw.aum_usd ?? raw.aum),
    hwm: strToNum(raw.hwm_per_share ?? raw.hwm),
    status: asVaultStatus(raw.status),
    capacity_usd: strToNum(raw.capacity_usd),
    trader_shares: strToNum(raw.trader_shares),
    deposits_open: raw.deposits_open ?? true,
    trader_claimable: strToNum(raw.trader_claimable ?? f.trader_claimable),
    base_mint: raw.base_mint ?? f.base_mint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    vault_token: raw.vault_token ?? f.vault_token ?? "",
    perf_fee_bps: strToNum(raw.perf_fee_bps ?? f.perf_fee_bps ?? 500),
    mgmt_fee_bps: strToNum(raw.mgmt_fee_bps ?? f.mgmt_fee_bps ?? 100),
    score_tier: asTier(raw.score_tier ?? f.score_tier),
  };
}

export function transformVaultTrades(raw: unknown[], handle: string): TradeRecord[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTrade[]).map((tr, i) => ({
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
    opened_at: isoToUnix(tr.opened_at),
    closed_at: isoToUnix(tr.closed_at),
  }));
}

export function transformLeaderboard(
  rawInput: unknown,
  knownHandles: Record<string, Partial<TraderProfile>> = {},
): LeaderboardEntry[] {
  const raw = (rawInput ?? {}) as RawLeaderboard;
  const byScore = Array.isArray(raw.by_score) ? raw.by_score : [];
  return byScore.map((entry, i) => {
    const known = (entry.handle && knownHandles[entry.handle]) || {};
    return {
      rank: i + 1,
      handle: entry.handle ?? "",
      wallet: known.wallet ?? "",
      profile: known.profile ?? "",
      score: strToNum(entry.score),
      tier: asTier(entry.tier),
      confidence: asConfidence(entry.confidence),
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

export function transformPortfolio(
  raw: unknown[],
  handleLookup?: Record<string, { handle?: string }>,
): PortfolioItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawPortfolioItem[]).map((p) => {
    const profile = p.profile ?? "";
    const trader_handle =
      p.trader_handle ?? handleLookup?.[profile]?.handle ?? profile.slice(0, 8);
    const value_usd = strToNum(p.value_usd);
    const cost_basis_usd = strToNum(p.cost_basis_usd);
    const pnl_usd = strToNum(p.pnl_usd ?? value_usd - cost_basis_usd);
    return {
      profile,
      trader_handle,
      shares: strToNum(p.shares),
      value_usd,
      cost_basis_usd,
      pnl_usd,
      roi_pct: cost_basis_usd > 0 ? strToNum(p.roi_pct ?? (pnl_usd / cost_basis_usd) * 100) : 0,
    };
  });
}
