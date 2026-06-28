// Mock data for Arcadia MVP — vaults, traders, performance, alerts
export type VaultStatus = "paper" | "active" | "cooldown" | "frozen" | "closed";
export type TraderTier = "novice" | "proven" | "established" | "veteran" | "elite";

export interface Trader {
  wallet: string;
  name: string;
  handle: string;
  tier: TraderTier;
  reputation: number;
  nextTierAt: number;
  joinedAt: string;
  strategy: string;
  strategyTags: string[];
  activeVaults: number;
  graduatedVaults: number;
  totalAUM: number;
  pnl90d: number;
  pnl30d: number;
  pnlAllTime: number;
  maxDrawdown: number;
  freezeCount: number;
  cooldownCount: number;
  avgJuniorRatio: number;
  longestPaperRecord: number;
  avgRecoveryDays: number;
  bio: string;
}

export interface Vault {
  id: string;
  name: string;
  traderWallet: string;
  status: VaultStatus;
  tvl: number;
  juniorCapital: number;
  seniorCapital: number;
  reserveCapital: number;       // self-funded reserve pool (grows from fee allocation)
  reserveAllocationBps: number; // % of trader performance fees routed to reserve (e.g. 1500 = 15%)
  juniorHealth: number; // 0-100
  return30d: number;
  return7d: number;
  returnAll: number;
  maxDrawdown: number;
  maxPositionPct: number;
  createdAt: string;
  graduatedAt?: string;
  paperDaysElapsed?: number;
  paperDaysRequired?: number;
  cooldownEndsAt?: string;
  instantExit: boolean;
  strategyTags: string[];
  description: string;
  allowedAssets: string[];
  feeModel: string;
  hwm: number;
  unclaimedFees: number;
  navHistory: { t: string; nav: number; junior: number; senior: number }[];
  trades: Trade[];
  activity: ActivityEvent[];
}

export interface Trade {
  id: string;
  time: string;
  pair: string;
  direction: "buy" | "sell";
  amount: number;
  price: number;
  navAfter: number;
  juniorImpact: number;
}

export interface ActivityEvent {
  id: string;
  time: string;
  kind: "deposit" | "graduate" | "cooldown" | "freeze" | "fee" | "junior_drop" | "investor_deposit" | "withdraw";
  message: string;
}

export interface InvestorPosition {
  vaultId: string;
  deposited: number;
  currentValue: number;
  shares: number;
  depositedAt: string;
  alertThreshold: number;
}

export interface Alert {
  id: string;
  time: string;
  vaultId?: string;
  kind: "junior_low" | "cooldown" | "freeze" | "graduate" | "fee" | "instant_exit" | "paper_complete";
  title: string;
  description: string;
  read: boolean;
}

const genNavHistory = (start: number, days: number, vol: number, drift: number) => {
  const out: { t: string; nav: number; junior: number; senior: number }[] = [];
  let nav = start;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    nav = nav * (1 + (Math.sin(i * 0.7) * vol + drift) / 100);
    const junior = nav * 0.22;
    const senior = nav * 0.78;
    out.push({
      t: new Date(now - i * 86400000).toISOString().slice(0, 10),
      nav: Math.round(nav),
      junior: Math.round(junior),
      senior: Math.round(senior),
    });
  }
  return out;
};

export const traders: Trader[] = [
  {
    wallet: "7xKa...P9mZ",
    name: "Aria Volkov",
    handle: "ariavolt",
    tier: "elite",
    reputation: 920,
    nextTierAt: 1000,
    joinedAt: "2024-03-12",
    strategy: "Macro-driven SOL/ETH momentum with disciplined drawdown control.",
    strategyTags: ["Momentum", "Macro", "SOL", "ETH"],
    activeVaults: 3,
    graduatedVaults: 5,
    totalAUM: 4_280_000,
    pnl90d: 18.4,
    pnl30d: 6.2,
    pnlAllTime: 142.7,
    maxDrawdown: -8.4,
    freezeCount: 0,
    cooldownCount: 2,
    avgJuniorRatio: 28,
    longestPaperRecord: 45,
    avgRecoveryDays: 6,
    bio: "Former prop desk trader. Trades systematic momentum with conservative position sizing and aggressive stop discipline.",
  },
  {
    wallet: "3jHq...K2vT",
    name: "Marcus Chen",
    handle: "mchen",
    tier: "veteran",
    reputation: 740,
    nextTierAt: 800,
    joinedAt: "2024-05-22",
    strategy: "Mean-reversion on majors. Patient entries, sized for 2% portfolio risk.",
    strategyTags: ["Mean Reversion", "BTC", "Spot"],
    activeVaults: 2,
    graduatedVaults: 3,
    totalAUM: 1_840_000,
    pnl90d: 11.2,
    pnl30d: 3.1,
    pnlAllTime: 78.3,
    maxDrawdown: -5.2,
    freezeCount: 0,
    cooldownCount: 1,
    avgJuniorRatio: 32,
    longestPaperRecord: 38,
    avgRecoveryDays: 4,
    bio: "Quant background. Builds vaults with low correlation to spot beta.",
  },
  {
    wallet: "9wPd...L8nC",
    name: "Sofia Reyes",
    handle: "sreyes",
    tier: "established",
    reputation: 480,
    nextTierAt: 600,
    joinedAt: "2024-08-04",
    strategy: "Range-trading altcoins with strict per-trade caps.",
    strategyTags: ["Altcoins", "Range", "Spot"],
    activeVaults: 2,
    graduatedVaults: 2,
    totalAUM: 720_000,
    pnl90d: 22.1,
    pnl30d: 8.4,
    pnlAllTime: 54.6,
    maxDrawdown: -12.3,
    freezeCount: 0,
    cooldownCount: 3,
    avgJuniorRatio: 25,
    longestPaperRecord: 31,
    avgRecoveryDays: 9,
    bio: "Discretionary altcoin trader with focus on liquidity-aware sizing.",
  },
  {
    wallet: "5vBn...R4xY",
    name: "Theo Lambert",
    handle: "theol",
    tier: "proven",
    reputation: 280,
    nextTierAt: 400,
    joinedAt: "2024-11-19",
    strategy: "Trend-following with weekly rebalance.",
    strategyTags: ["Trend", "ETH", "SOL"],
    activeVaults: 1,
    graduatedVaults: 1,
    totalAUM: 240_000,
    pnl90d: 9.8,
    pnl30d: 2.4,
    pnlAllTime: 21.2,
    maxDrawdown: -6.1,
    freezeCount: 0,
    cooldownCount: 1,
    avgJuniorRatio: 30,
    longestPaperRecord: 30,
    avgRecoveryDays: 5,
    bio: "Engineer turned systematic trader. Believes in slow, steady compounding.",
  },
  {
    wallet: "2qLm...T7sA",
    name: "Nadia Okonkwo",
    handle: "nadiao",
    tier: "novice",
    reputation: 90,
    nextTierAt: 200,
    joinedAt: "2025-01-08",
    strategy: "Discretionary spot trading on majors.",
    strategyTags: ["Discretionary", "BTC", "ETH"],
    activeVaults: 1,
    graduatedVaults: 0,
    totalAUM: 45_000,
    pnl90d: 4.2,
    pnl30d: 4.2,
    pnlAllTime: 4.2,
    maxDrawdown: -3.8,
    freezeCount: 0,
    cooldownCount: 0,
    avgJuniorRatio: 35,
    longestPaperRecord: 18,
    avgRecoveryDays: 0,
    bio: "Currently building paper-mode track record on first vault.",
  },
];

export const vaults: Vault[] = [
  {
    id: "vlt-001",
    name: "Signal Macro I",
    traderWallet: traders[0].wallet,
    status: "active",
    tvl: 1_240_000,
    juniorCapital: 280_000,
    seniorCapital: 960_000,
    reserveCapital: 18_400,
    reserveAllocationBps: 1500,
    juniorHealth: 78,
    return30d: 6.2,
    return7d: 1.8,
    returnAll: 42.7,
    maxDrawdown: -7.4,
    maxPositionPct: 18,
    createdAt: "2024-04-02",
    graduatedAt: "2024-05-02",
    instantExit: false,
    strategyTags: ["Momentum", "SOL", "ETH"],
    description: "Macro-driven momentum on SOL and ETH with disciplined position sizing.",
    allowedAssets: ["USDC", "SOL", "ETH", "BTC"],
    feeModel: "20% performance above HWM",
    hwm: 1_180_000,
    unclaimedFees: 12_000,
    navHistory: genNavHistory(870_000, 90, 0.4, 0.45),
    trades: [
      { id: "t1", time: "2025-04-21T14:22:00Z", pair: "SOL/USDC", direction: "buy", amount: 1200, price: 184.2, navAfter: 1_240_000, juniorImpact: 0.2 },
      { id: "t2", time: "2025-04-20T09:11:00Z", pair: "ETH/USDC", direction: "sell", amount: 18, price: 3340, navAfter: 1_237_000, juniorImpact: -0.4 },
      { id: "t3", time: "2025-04-19T16:48:00Z", pair: "SOL/USDC", direction: "buy", amount: 800, price: 178.6, navAfter: 1_241_000, juniorImpact: 0.1 },
    ],
    activity: [
      { id: "a1", time: "2025-04-21T14:22:00Z", kind: "investor_deposit", message: "Investor deposited 25,000 USDC" },
      { id: "a2", time: "2025-04-15T11:00:00Z", kind: "fee", message: "Performance fee claimed: 8,400 USDC" },
      { id: "a3", time: "2024-05-02T00:00:00Z", kind: "graduate", message: "Vault graduated from paper mode" },
    ],
  },
  {
    id: "vlt-002",
    name: "Signal Momentum II",
    traderWallet: traders[0].wallet,
    status: "active",
    tvl: 2_100_000,
    juniorCapital: 540_000,
    seniorCapital: 1_560_000,
    reserveCapital: 24_800,
    reserveAllocationBps: 1000,
    juniorHealth: 86,
    return30d: 7.4,
    return7d: 2.1,
    returnAll: 38.4,
    maxDrawdown: -5.8,
    maxPositionPct: 20,
    createdAt: "2024-08-14",
    graduatedAt: "2024-09-14",
    instantExit: false,
    strategyTags: ["Momentum", "Macro"],
    description: "Higher-conviction momentum sleeve with tighter stops.",
    allowedAssets: ["USDC", "SOL", "ETH"],
    feeModel: "20% performance above HWM",
    hwm: 2_020_000,
    unclaimedFees: 16_000,
    navHistory: genNavHistory(1_500_000, 90, 0.35, 0.5),
    trades: [],
    activity: [
      { id: "a1", time: "2025-04-22T10:00:00Z", kind: "investor_deposit", message: "Investor deposited 80,000 USDC" },
    ],
  },
  {
    id: "vlt-003",
    name: "Reversion Alpha",
    traderWallet: traders[1].wallet,
    status: "cooldown",
    tvl: 940_000,
    juniorCapital: 220_000,
    seniorCapital: 720_000,
    reserveCapital: 6_200,
    reserveAllocationBps: 1000,
    juniorHealth: 42,
    return30d: -2.1,
    return7d: -1.4,
    returnAll: 14.6,
    maxDrawdown: -9.2,
    maxPositionPct: 8,
    createdAt: "2024-06-18",
    graduatedAt: "2024-07-18",
    cooldownEndsAt: "2025-04-24T18:00:00Z",
    instantExit: false,
    strategyTags: ["Mean Reversion", "BTC"],
    description: "Mean-reversion on BTC with tight risk controls.",
    allowedAssets: ["USDC", "BTC"],
    feeModel: "15% performance above HWM",
    hwm: 980_000,
    unclaimedFees: 0,
    navHistory: genNavHistory(820_000, 90, 0.5, 0.15),
    trades: [],
    activity: [
      { id: "a1", time: "2025-04-22T08:00:00Z", kind: "cooldown", message: "Cooldown triggered: junior health below 50%" },
      { id: "a2", time: "2025-04-21T18:00:00Z", kind: "junior_drop", message: "Junior health crossed 50% threshold" },
    ],
  },
  {
    id: "vlt-004",
    name: "Patient Range",
    traderWallet: traders[1].wallet,
    status: "active",
    tvl: 720_000,
    juniorCapital: 180_000,
    seniorCapital: 540_000,
    reserveCapital: 9_100,
    reserveAllocationBps: 1500,
    juniorHealth: 71,
    return30d: 4.8,
    return7d: 1.1,
    returnAll: 28.2,
    maxDrawdown: -5.2,
    maxPositionPct: 12,
    createdAt: "2024-09-02",
    graduatedAt: "2024-10-02",
    instantExit: false,
    strategyTags: ["Mean Reversion", "Spot"],
    description: "Patient range-trading with conservative sizing.",
    allowedAssets: ["USDC", "BTC", "ETH"],
    feeModel: "20% performance above HWM",
    hwm: 695_000,
    unclaimedFees: 5_000,
    navHistory: genNavHistory(560_000, 90, 0.3, 0.3),
    trades: [],
    activity: [],
  },
  {
    id: "vlt-005",
    name: "Alt Range Pro",
    traderWallet: traders[2].wallet,
    status: "active",
    tvl: 420_000,
    juniorCapital: 105_000,
    seniorCapital: 315_000,
    reserveCapital: 3_800,
    reserveAllocationBps: 2000,
    juniorHealth: 18,
    return30d: 8.4,
    return7d: -0.8,
    returnAll: 32.1,
    maxDrawdown: -12.1,
    maxPositionPct: 4,
    createdAt: "2024-09-22",
    graduatedAt: "2024-10-22",
    instantExit: true,
    strategyTags: ["Altcoins", "Range"],
    description: "Range-bound altcoin trading with strict caps.",
    allowedAssets: ["USDC", "JUP", "WIF", "BONK"],
    feeModel: "20% performance above HWM",
    hwm: 410_000,
    unclaimedFees: 0,
    navHistory: genNavHistory(320_000, 90, 0.7, 0.35),
    trades: [],
    activity: [
      { id: "a1", time: "2025-04-22T07:00:00Z", kind: "junior_drop", message: "Junior health critical — instant exit enabled" },
    ],
  },
  {
    id: "vlt-006",
    name: "Steady Trend",
    traderWallet: traders[3].wallet,
    status: "active",
    tvl: 240_000,
    juniorCapital: 72_000,
    seniorCapital: 168_000,
    reserveCapital: 2_800,
    reserveAllocationBps: 1000,
    juniorHealth: 88,
    return30d: 2.4,
    return7d: 0.6,
    returnAll: 18.4,
    maxDrawdown: -6.1,
    maxPositionPct: 10,
    createdAt: "2024-12-19",
    graduatedAt: "2025-01-19",
    instantExit: false,
    strategyTags: ["Trend", "ETH"],
    description: "Slow-and-steady trend following.",
    allowedAssets: ["USDC", "ETH", "SOL"],
    feeModel: "20% performance above HWM",
    hwm: 235_000,
    unclaimedFees: 1_200,
    navHistory: genNavHistory(200_000, 90, 0.25, 0.2),
    trades: [],
    activity: [],
  },
  {
    id: "vlt-007",
    name: "First Steps",
    traderWallet: traders[4].wallet,
    status: "paper",
    tvl: 45_000,
    juniorCapital: 45_000,
    seniorCapital: 0,
    reserveCapital: 0,
    reserveAllocationBps: 1500,
    juniorHealth: 92,
    return30d: 4.2,
    return7d: 1.4,
    returnAll: 4.2,
    maxDrawdown: -3.8,
    maxPositionPct: 25,
    createdAt: "2025-04-04",
    paperDaysElapsed: 19,
    paperDaysRequired: 30,
    instantExit: false,
    strategyTags: ["Discretionary", "BTC"],
    description: "Discretionary spot trading on BTC and ETH while building public track record.",
    allowedAssets: ["USDC", "BTC", "ETH"],
    feeModel: "20% performance above HWM",
    hwm: 45_000,
    unclaimedFees: 0,
    navHistory: genNavHistory(43_000, 19, 0.3, 0.22),
    trades: [],
    activity: [
      { id: "a1", time: "2025-04-04T00:00:00Z", kind: "deposit", message: "Trader funded junior capital: 45,000 USDC" },
    ],
  },
  {
    id: "vlt-008",
    name: "Frozen Legacy",
    traderWallet: traders[2].wallet,
    status: "frozen",
    tvl: 180_000,
    juniorCapital: 12_000,
    seniorCapital: 168_000,
    reserveCapital: 0,
    reserveAllocationBps: 500,
    juniorHealth: 6,
    return30d: -14.2,
    return7d: -8.1,
    returnAll: -14.2,
    maxDrawdown: -22.4,
    maxPositionPct: 2,
    createdAt: "2024-11-04",
    graduatedAt: "2024-12-04",
    instantExit: true,
    strategyTags: ["Altcoins"],
    description: "Trading disabled. Investors may withdraw available liquidity.",
    allowedAssets: ["USDC"],
    feeModel: "20% performance above HWM",
    hwm: 210_000,
    unclaimedFees: 0,
    navHistory: genNavHistory(220_000, 60, 0.6, -0.25),
    trades: [],
    activity: [
      { id: "a1", time: "2025-04-15T00:00:00Z", kind: "freeze", message: "Vault frozen — risk controls activated" },
    ],
  },
];

export const investorPositions: InvestorPosition[] = [
  { vaultId: "vlt-001", deposited: 25_000, currentValue: 27_840, shares: 23.1, depositedAt: "2025-01-12", alertThreshold: 30 },
  { vaultId: "vlt-002", deposited: 50_000, currentValue: 53_700, shares: 41.2, depositedAt: "2025-02-04", alertThreshold: 25 },
  { vaultId: "vlt-004", deposited: 15_000, currentValue: 15_640, shares: 12.0, depositedAt: "2025-03-01", alertThreshold: 30 },
];

export const alerts: Alert[] = [
  { id: "al1", time: "2025-04-22T08:00:00Z", vaultId: "vlt-003", kind: "cooldown", title: "Reversion Alpha entered cooldown", description: "Junior health crossed 50%. Trading paused for 48h.", read: false },
  { id: "al2", time: "2025-04-22T07:00:00Z", vaultId: "vlt-005", kind: "instant_exit", title: "Instant exit available — Alt Range Pro", description: "Junior buffer below 20%. Withdrawals are instant.", read: false },
  { id: "al3", time: "2025-04-15T00:00:00Z", vaultId: "vlt-008", kind: "freeze", title: "Frozen Legacy frozen", description: "Vault frozen. Withdraw available liquidity.", read: true },
  { id: "al4", time: "2025-04-15T11:00:00Z", vaultId: "vlt-001", kind: "fee", title: "Performance fee claimed", description: "Signal Macro I: 8,400 USDC fee claim affected NAV.", read: true },
];

export const protocolStats = {
  totalVaults: 8,
  totalTVL: vaults.reduce((s, v) => s + v.tvl, 0),
  graduatedVaults: vaults.filter(v => v.status !== "paper").length,
  protectedCapital: vaults.reduce((s, v) => s + v.seniorCapital, 0),
};

export const getTrader = (wallet: string) => traders.find(t => t.wallet === wallet);
export const getVault = (id: string) => vaults.find(v => v.id === id);
