import type {
  TraderListItem,
  TraderProfile,
  VaultInfo,
  LeaderboardEntry,
  PriceData,
  EquityPoint,
  TradeRecord,
  ScorePoint,
  DailyPnL,
} from "./types";

export type { ScorePoint, DailyPnL };

const now = Math.floor(Date.now() / 1000);

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeSig(seed: number): string {
  let s = "";
  let n = seed * 0x9e3779b97f4a7c15 + 0x6c62272e07bb0142;
  for (let i = 0; i < 88; i++) {
    n = ((n ^ (n >> 30)) * 0xbf58476d1ce4e5b9) >>> 0;
    s += B58[Math.abs(n) % 58];
  }
  return s;
}

function genEquityCurve(days: number, start: number, end: number): EquityPoint[] {
  const pts: EquityPoint[] = [];
  let val = start;
  for (let i = 0; i <= days; i++) {
    const t = i / days;
    const trend = start + (end - start) * t;
    const noise = (Math.sin(i * 0.7) * 0.012 + (Math.random() - 0.48) * 0.018);
    val = trend + noise * (end - start);
    pts.push({ ts: now - (days - i) * 86400, value: Math.max(0.3, val) });
  }
  return pts;
}

function genScoreHistory(days: number, endScore: number): ScorePoint[] {
  const pts: ScorePoint[] = [];
  let score = endScore - 60 - Math.random() * 40;
  for (let i = 0; i <= days; i++) {
    const t = i / days;
    const trend = (endScore - 60 - Math.random() * 40) + 100 * t;
    const noise = (Math.random() - 0.4) * 8;
    score = Math.min(1000, Math.max(500, trend + noise));
    pts.push({ ts: now - (days - i) * 86400, score: Math.round(score) });
  }
  pts[pts.length - 1].score = endScore;
  return pts;
}

function genDailyPnL(days: number, winRate: number): DailyPnL[] {
  const result: DailyPnL[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date((now - (days - 1 - i) * 86400) * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    if (Math.random() < 0.25) {
      result.push({ date: dateStr, pnl: 0 });
      continue;
    }
    const win = Math.random() < winRate / 100;
    const magnitude = 500 + Math.random() * 4500;
    result.push({ date: dateStr, pnl: win ? magnitude : -magnitude * 0.65 });
  }
  return result;
}

function genTrades(n: number, profile: string): TradeRecord[] {
  const markets = ["SOL-PERP", "BTC-PERP", "ETH-PERP", "ARB-PERP"];
  const trades: TradeRecord[] = [];
  for (let i = 0; i < n; i++) {
    const market = markets[i % markets.length];
    const direction = Math.random() > 0.45 ? "long" : "short";
    const entry_px = market === "SOL-PERP" ? 145 + (Math.random() - 0.5) * 40
      : market === "BTC-PERP" ? 98000 + (Math.random() - 0.5) * 8000
      : market === "ETH-PERP" ? 3200 + (Math.random() - 0.5) * 400
      : 1.5 + (Math.random() - 0.5) * 0.6;
    const move = (Math.random() - 0.4) * 0.06;
    const exit_px = entry_px * (direction === "long" ? 1 + move : 1 - move);
    const size_usd = 2000 + Math.random() * 8000;
    const leverage = Math.floor(2 + Math.random() * 8);
    const pnl = direction === "long"
      ? size_usd * leverage * (exit_px - entry_px) / entry_px
      : size_usd * leverage * (entry_px - exit_px) / entry_px;
    const fees = size_usd * 0.0006;
    const opened_at = now - (n - i) * 3600 * 8;
    trades.push({
      id: `${profile.slice(6, 10)}-t${i}`,
      market,
      direction,
      size_usd,
      leverage,
      entry_px,
      exit_px,
      realized_pnl: pnl - fees,
      fees_usd: fees,
      was_liquidated: false,
      opened_at,
      closed_at: opened_at + 3600 * (1 + Math.random() * 6),
      sig: fakeSig(i * 997 + profile.charCodeAt(6) * 31),
    });
  }
  return trades;
}

export const MOCK_SCORE_HISTORY: Record<string, ScorePoint[]> = {
  nova:  genScoreHistory(180, 912),
  vega:  genScoreHistory(180, 841),
  atlas: genScoreHistory(90,  773),
  lyra:  genScoreHistory(90,  634),
  orion: genScoreHistory(180, 887),
};

export const MOCK_DAILY_PNL: Record<string, DailyPnL[]> = {
  nova:  genDailyPnL(365, 68.3),
  vega:  genDailyPnL(365, 61.7),
  atlas: genDailyPnL(180, 57.2),
  lyra:  genDailyPnL(180, 52.8),
  orion: genDailyPnL(365, 64.9),
};

export const MOCK_TRADERS: TraderProfile[] = [
  {
    handle: "nova",
    wallet: "7xQ3mBkZvYrFp9nCqWsLtUi8hDaE2oX5yJ6gNvR4kMb",
    profile: "ArcVlt1NovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    score: 912,
    tier: "Elite",
    confidence: "high",
    ci: { lo: 895, point: 912, hi: 928 },
    metrics: {
      sharpe: 2.41,
      sortino: 3.18,
      win_rate: 68.3,
      avg_trade_duration_hours: 4.2,
      total_trades: 847,
      max_dd: -8.4,
      return_7d: 3.1,
      return_30d: 18.7,
      return_90d: 41.2,
      return_all: 112.4,
      vol_30d: 9.2,
    },
    equity_curve: genEquityCurve(90, 1.0, 2.12),
    trades: genTrades(20, "ArcVlt1NovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    capacity: { total: 912000, used: 387000 },
    aum: 387000,
    investors_count: 34,
    trader_self_funded: 25000,
    deposits_open: true,
    days_active: 127,
    trade_count: 847,
    style_tags: ["#momentum", "#SOL", "#scalp"],
    max_leverage: 10,
    bio: "Momentum trading on Solana perpetuals. High win-rate scalp strategy.",
  },
  {
    handle: "vega",
    wallet: "4mBp9aXqRvTs3nLwZoCuJe5kHiDf8yG1bN7sAqF2xKp",
    profile: "ArcVlt2VegaYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    score: 841,
    tier: "Advanced",
    confidence: "high",
    ci: { lo: 822, point: 841, hi: 859 },
    metrics: {
      sharpe: 1.93,
      sortino: 2.54,
      win_rate: 61.7,
      avg_trade_duration_hours: 11.8,
      total_trades: 412,
      max_dd: -12.1,
      return_7d: 1.8,
      return_30d: 9.4,
      return_90d: 24.8,
      return_all: 64.3,
      vol_30d: 7.8,
    },
    equity_curve: genEquityCurve(90, 1.0, 1.64),
    trades: genTrades(15, "ArcVlt2VegaYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    capacity: { total: 841000, used: 742000 },
    aum: 742000,
    investors_count: 67,
    trader_self_funded: 50000,
    deposits_open: true,
    days_active: 203,
    trade_count: 412,
    style_tags: ["#swing", "#BTC", "#ETH"],
    max_leverage: 5,
    bio: "Swing trader focused on Bitcoin and Ethereum macro cycles.",
  },
  {
    handle: "atlas",
    wallet: "9kLr7mZqDvYf3sBwNpTuHe6aJiCg4oX8yR2nFcW5tPm",
    profile: "ArcVlt3AtlasZxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    score: 773,
    tier: "Established",
    confidence: "med",
    ci: { lo: 748, point: 773, hi: 797 },
    metrics: {
      sharpe: 1.54,
      sortino: 1.98,
      win_rate: 57.2,
      avg_trade_duration_hours: 6.9,
      total_trades: 256,
      max_dd: -15.3,
      return_7d: -0.4,
      return_30d: 6.2,
      return_90d: 17.1,
      return_all: 38.7,
      vol_30d: 11.4,
    },
    equity_curve: genEquityCurve(90, 1.0, 1.38),
    trades: genTrades(12, "ArcVlt3AtlasZxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    capacity: { total: 773000, used: 198000 },
    aum: 198000,
    investors_count: 21,
    trader_self_funded: 15000,
    deposits_open: true,
    days_active: 89,
    trade_count: 256,
    style_tags: ["#breakout", "#SOL", "#altcoins"],
    max_leverage: 8,
    bio: "Breakout strategies on Solana-native assets. Medium-term holds.",
  },
  {
    handle: "lyra",
    wallet: "2pKs6dXnBvYr4aLwMqZuCe7hJiEg9tN3oP5yF8cQ1mT",
    profile: "ArcVlt4LyraWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    score: 634,
    tier: "Verified",
    confidence: "low",
    ci: { lo: 598, point: 634, hi: 668 },
    metrics: {
      sharpe: 1.12,
      sortino: 1.41,
      win_rate: 52.8,
      avg_trade_duration_hours: 14.2,
      total_trades: 88,
      max_dd: -19.7,
      return_7d: 0.6,
      return_30d: 3.8,
      return_90d: 9.4,
      return_all: 18.2,
      vol_30d: 13.8,
    },
    equity_curve: genEquityCurve(90, 1.0, 1.18),
    trades: genTrades(8, "ArcVlt4LyraWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    capacity: { total: 634000, used: 34000 },
    aum: 34000,
    investors_count: 8,
    trader_self_funded: 5000,
    deposits_open: true,
    days_active: 42,
    trade_count: 88,
    style_tags: ["#mean-reversion", "#ARB"],
    max_leverage: 3,
    bio: "New to Arcadia. Mean-reversion on Arbitrum perpetuals.",
  },
  {
    handle: "orion",
    wallet: "5fNq8bXmCvYs2hLwPrZoJe4kHiDg3oT6yA9nBcW7uQp",
    profile: "ArcVlt5OrionVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    score: 887,
    tier: "Advanced",
    confidence: "high",
    ci: { lo: 870, point: 887, hi: 903 },
    metrics: {
      sharpe: 2.18,
      sortino: 2.87,
      win_rate: 64.9,
      avg_trade_duration_hours: 3.7,
      total_trades: 1241,
      max_dd: -10.6,
      return_7d: 2.3,
      return_30d: 14.2,
      return_90d: 33.8,
      return_all: 89.7,
      vol_30d: 8.7,
    },
    equity_curve: genEquityCurve(90, 1.0, 1.89),
    trades: genTrades(25, "ArcVlt5OrionVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    capacity: { total: 887000, used: 621000 },
    aum: 621000,
    investors_count: 54,
    trader_self_funded: 40000,
    deposits_open: true,
    days_active: 178,
    trade_count: 1241,
    style_tags: ["#HFT", "#SOL", "#perps"],
    max_leverage: 10,
    bio: "High-frequency scalping on SOL perps. Tight risk management.",
  },
];

export const MOCK_TRADERS_LIST: TraderListItem[] = MOCK_TRADERS.map((t) => ({
  handle: t.handle,
  wallet: t.wallet,
  profile: t.profile,
  score: t.score,
  tier: t.tier,
  confidence: t.confidence,
  capacity_usd: t.score * 1000,
  aum: t.aum,
  return_30d: t.metrics.return_30d,
  max_dd: t.metrics.max_dd,
  sortino: t.metrics.sortino,
  deposits_open: t.deposits_open,
  style_tags: t.style_tags,
  trader_self_funded: t.trader_self_funded,
}));

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [...MOCK_TRADERS]
  .sort((a, b) => b.score - a.score)
  .map((t, i) => ({
    rank: i + 1,
    handle: t.handle,
    wallet: t.wallet,
    profile: t.profile,
    score: t.score,
    tier: t.tier,
    confidence: t.confidence,
    return_30d: t.metrics.return_30d,
    return_90d: t.metrics.return_90d,
    max_dd: t.metrics.max_dd,
    sortino: t.metrics.sortino,
    aum: t.aum,
    trade_count: t.trade_count,
    days_active: t.days_active,
  }));

export const MOCK_PRICES: PriceData[] = [
  {
    market: "SOL-PERP",
    price: 162.45,
    change_24h: 4.21,
    change_pct_24h: 2.66,
    volume_24h: 1_420_000_000,
    high_24h: 165.1,
    low_24h: 157.8,
    ts: now,
  },
  {
    market: "BTC-PERP",
    price: 98_420.0,
    change_24h: -820.0,
    change_pct_24h: -0.83,
    volume_24h: 28_400_000_000,
    high_24h: 99_600,
    low_24h: 97_200,
    ts: now,
  },
  {
    market: "ETH-PERP",
    price: 3_418.5,
    change_24h: -42.1,
    change_pct_24h: -1.22,
    volume_24h: 6_200_000_000,
    high_24h: 3_490,
    low_24h: 3_380,
    ts: now,
  },
  {
    market: "ARB-PERP",
    price: 1.642,
    change_24h: 0.038,
    change_pct_24h: 2.37,
    volume_24h: 182_000_000,
    high_24h: 1.68,
    low_24h: 1.59,
    ts: now,
  },
];

export function getTraderByHandle(handle: string): TraderProfile | undefined {
  return MOCK_TRADERS.find((t) => t.handle.toLowerCase() === handle.toLowerCase());
}

export function getVaultByProfile(profile: string): VaultInfo | undefined {
  const trader = MOCK_TRADERS.find((t) => t.profile === profile);
  if (!trader) return undefined;
  const nav = 1_000_000 + Math.floor(trader.metrics.return_all * 10_000);
  return {
    nav_per_share: nav,
    total_shares: Math.floor(trader.aum / navFrom1e6(nav)),
    aum: trader.aum,
    hwm: nav + 50_000,
    status: "active",
    capacity_usd: trader.score * 1000,
    trader_shares: Math.floor((trader.trader_self_funded / trader.aum) * (trader.aum / navFrom1e6(nav))),
    deposits_open: trader.deposits_open,
    trader_claimable: Math.floor(trader.aum * 0.02),
    base_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    vault_token: `VaultTok${trader.handle.toUpperCase()}xxxxxxxxxxxxxxxxxxxxx`,
    perf_fee_bps: 500,
    mgmt_fee_bps: 100,
    score_tier: trader.tier,
  };
}

function navFrom1e6(raw: number): number {
  return raw / 1_000_000;
}
