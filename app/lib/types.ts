export type ScoreTier = "Verified" | "Established" | "Advanced" | "Elite";
export type Confidence = "low" | "med" | "high";
export type VaultStatus = "active" | "paused" | "closed";

export interface TraderListItem {
  handle: string;
  wallet: string;
  profile: string;
  score: number;
  tier: ScoreTier;
  confidence: Confidence;
  capacity_usd: number;
  aum: number;
  return_30d: number;
  max_dd: number;
  sortino: number;
  deposits_open: boolean;
  style_tags: string[];
  trader_self_funded: number;
}

export interface TraderMetrics {
  sharpe: number;
  sortino: number;
  win_rate: number;
  avg_trade_duration_hours: number;
  total_trades: number;
  max_dd: number;
  return_7d: number;
  return_30d: number;
  return_90d: number;
  return_all: number;
  vol_30d: number;
}

export interface EquityPoint {
  ts: number;
  value: number;
}

export interface TradeRecord {
  id: string;
  market: string;
  direction: "long" | "short";
  size_usd: number;
  leverage: number;
  entry_px: number;
  exit_px: number;
  realized_pnl: number;
  fees_usd: number;
  was_liquidated: boolean;
  opened_at: number;
  closed_at: number;
  sig?: string;
}

export interface ConfidenceInterval {
  lo: number;
  point: number;
  hi: number;
}

export interface TraderProfile {
  handle: string;
  wallet: string;
  profile: string;
  score: number;
  tier: ScoreTier;
  confidence: Confidence;
  ci: ConfidenceInterval;
  metrics: TraderMetrics;
  equity_curve: EquityPoint[];
  trades: TradeRecord[];
  capacity: { total: number; used: number };
  aum: number;
  investors_count: number;
  trader_self_funded: number;
  deposits_open: boolean;
  days_active: number;
  trade_count: number;
  style_tags: string[];
  max_leverage: number;
  bio?: string;
}

export interface VaultInfo {
  nav_per_share: number;
  total_shares: number;
  aum: number;
  hwm: number;
  status: VaultStatus;
  capacity_usd: number;
  trader_shares: number;
  deposits_open: boolean;
  trader_claimable: number;
  base_mint: string;
  vault_token: string;
  perf_fee_bps: number;
  mgmt_fee_bps: number;
  score_tier: ScoreTier;
}

export interface InvestorAccount {
  wallet: string;
  account_pubkey: string;
  bump: number;
  created_at: number;
}

export interface InvestorPosition {
  profile: string;
  trader_handle: string;
  shares: number;
  pending_withdraw_shares: number;
  withdraw_ready_ts: number;
  cost_basis_usd: number;
  bump: number;
}

export interface InvestorAccountResponse {
  main: InvestorAccount;
  positions: InvestorPosition[];
}

export interface PortfolioItem {
  profile: string;
  trader_handle: string;
  shares: number;
  value_usd: number;
  cost_basis_usd: number;
  pnl_usd: number;
  roi_pct: number;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  wallet: string;
  profile: string;
  score: number;
  tier: ScoreTier;
  confidence: Confidence;
  return_30d: number;
  return_90d: number;
  max_dd: number;
  sortino: number;
  aum: number;
  trade_count: number;
  days_active: number;
}

export interface PriceData {
  market: string;
  price: number;
  change_24h: number;
  change_pct_24h: number;
  volume_24h: number;
  high_24h: number;
  low_24h: number;
  ts: number;
}

export interface OpenPosition {
  id: string;
  market: string;
  direction: "long" | "short";
  size_usd: number;
  leverage: number;
  entry_px: number;
  opened_at: number;
  upnl?: number;
}

export interface AuthChallenge {
  nonce: string;
  expires_at: number;
}

export interface AuthToken {
  token: string;
  wallet: string;
  expires_at: number;
}

export function tierFromScore(score: number): ScoreTier {
  if (score >= 900) return "Elite";
  if (score >= 800) return "Advanced";
  if (score >= 700) return "Established";
  return "Verified";
}

export function tierColor(tier: ScoreTier): string {
  const map: Record<ScoreTier, string> = {
    Verified: "#5fb89a",
    Established: "#5a9bd8",
    Advanced: "#9b7fd8",
    Elite: "#d8a93a",
  };
  return map[tier];
}

export function navFrom1e6(raw: number): number {
  return raw / 1_000_000;
}

export function formatUSD(n: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPct(n: number, decimals = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatNum(n: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
