const now = Math.floor(Date.now() / 1000);
const day = 86400;

export interface VaultView {
  id: string;
  name: string;
  configPubkey: string;
  statePubkey: string;
  treasuryPubkey: string;
  managerPubkey: string;
  managerProfilePubkey: string;
  status: 'paper' | 'active' | 'cooldown' | 'frozen' | 'closed';
  tvl: number;
  juniorCapital: number;
  seniorCapital: number;
  juniorSharesOutstanding: number;
  seniorSharesOutstanding: number;
  juniorHealth: number;
  currentNav: number;
  highWaterMark: number;
  feeBps: number;
  maxSlippageBps: number;
  createdAt: number;
  graduatedAt: number;
  paperTradeCount: number;
  minQualifyingTrades: number;
  rolling24hLossBps: number;
  rolling7dLossBps: number;
  tradingEnabled: boolean;
  instantExit: boolean;
  vaultIndex: number;
}

export interface ManagerView {
  pubkey: string;
  owner: string;
  totalVaults: number;
  activeVaults: number;
  totalJuniorDeposited: number;
  createdAt: number;
}

export interface PositionView {
  pubkey: string;
  vaultConfigPubkey: string;
  vault?: VaultView;
  investorPubkey: string;
  depositedAt: number;
  seniorShares: number;
  totalDeposited: number;
  alertThresholdBps: number;
  currentValue: number;
}

export interface NavPoint {
  vaultConfigPubkey: string;
  recordedAt: number;
  nav: number;
  juniorCapital: number;
  seniorCapital: number;
}

export const MOCK_VAULTS: VaultView[] = [
  {
    id: '1',
    name: 'Alpha Momentum',
    configPubkey: 'ALPHAMomentumCfg11111111111111111111111111',
    statePubkey:  'ALPHAMomentumSt111111111111111111111111111',
    treasuryPubkey:'ALPHAMomentumTr111111111111111111111111111',
    managerPubkey: 'MGR1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    managerProfilePubkey: 'MGRP1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'active',
    tvl: 145000,
    juniorCapital: 45000,
    seniorCapital: 100000,
    juniorSharesOutstanding: 45000,
    seniorSharesOutstanding: 100000,
    juniorHealth: 0.82,
    currentNav: 1.0874,
    highWaterMark: 1.0874,
    feeBps: 200,
    maxSlippageBps: 100,
    createdAt: now - 75 * day,
    graduatedAt: now - 45 * day,
    paperTradeCount: 15,
    minQualifyingTrades: 10,
    rolling24hLossBps: 12,
    rolling7dLossBps: 45,
    tradingEnabled: true,
    instantExit: true,
    vaultIndex: 0,
  },
  {
    id: '2',
    name: 'Delta Neutral',
    configPubkey: 'DELTANeutralCfg111111111111111111111111111',
    statePubkey:  'DELTANeutralSt1111111111111111111111111111',
    treasuryPubkey:'DELTANeutralTr1111111111111111111111111111',
    managerPubkey: 'MGR2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    managerProfilePubkey: 'MGRP2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'active',
    tvl: 220000,
    juniorCapital: 70000,
    seniorCapital: 150000,
    juniorSharesOutstanding: 70000,
    seniorSharesOutstanding: 150000,
    juniorHealth: 0.94,
    currentNav: 1.1432,
    highWaterMark: 1.1432,
    feeBps: 150,
    maxSlippageBps: 75,
    createdAt: now - 120 * day,
    graduatedAt: now - 90 * day,
    paperTradeCount: 22,
    minQualifyingTrades: 10,
    rolling24hLossBps: 5,
    rolling7dLossBps: 18,
    tradingEnabled: true,
    instantExit: false,
    vaultIndex: 0,
  },
  {
    id: '3',
    name: 'Sigma Trend',
    configPubkey: 'SIGMATrendCfg11111111111111111111111111111',
    statePubkey:  'SIGMATrendSt111111111111111111111111111111',
    treasuryPubkey:'SIGMATrendTr111111111111111111111111111111',
    managerPubkey: 'MGR3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    managerProfilePubkey: 'MGRP3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'cooldown',
    tvl: 58000,
    juniorCapital: 18000,
    seniorCapital: 40000,
    juniorSharesOutstanding: 18000,
    seniorSharesOutstanding: 40000,
    juniorHealth: 0.61,
    currentNav: 0.9721,
    highWaterMark: 1.0200,
    feeBps: 250,
    maxSlippageBps: 150,
    createdAt: now - 60 * day,
    graduatedAt: now - 30 * day,
    paperTradeCount: 12,
    minQualifyingTrades: 10,
    rolling24hLossBps: 210,
    rolling7dLossBps: 380,
    tradingEnabled: false,
    instantExit: false,
    vaultIndex: 1,
  },
  {
    id: '4',
    name: 'Epsilon Market Maker',
    configPubkey: 'EPSILONMarketCfg1111111111111111111111111',
    statePubkey:  'EPSILONMarketSt11111111111111111111111111',
    treasuryPubkey:'EPSILONMarketTr11111111111111111111111111',
    managerPubkey: 'MGR1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    managerProfilePubkey: 'MGRP1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'paper',
    tvl: 8000,
    juniorCapital: 8000,
    seniorCapital: 0,
    juniorSharesOutstanding: 8000,
    seniorSharesOutstanding: 0,
    juniorHealth: 1.0,
    currentNav: 1.0000,
    highWaterMark: 1.0000,
    feeBps: 200,
    maxSlippageBps: 100,
    createdAt: now - 12 * day,
    graduatedAt: 0,
    paperTradeCount: 7,
    minQualifyingTrades: 10,
    rolling24hLossBps: 0,
    rolling7dLossBps: 0,
    tradingEnabled: true,
    instantExit: true,
    vaultIndex: 1,
  },
  {
    id: '5',
    name: 'Zeta Carry',
    configPubkey: 'ZETACarryCfg111111111111111111111111111111',
    statePubkey:  'ZETACarrySt1111111111111111111111111111111',
    treasuryPubkey:'ZETACarryTr1111111111111111111111111111111',
    managerPubkey: 'MGR3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    managerProfilePubkey: 'MGRP3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'active',
    tvl: 88000,
    juniorCapital: 28000,
    seniorCapital: 60000,
    juniorSharesOutstanding: 28000,
    seniorSharesOutstanding: 60000,
    juniorHealth: 0.89,
    currentNav: 1.0612,
    highWaterMark: 1.0612,
    feeBps: 175,
    maxSlippageBps: 100,
    createdAt: now - 55 * day,
    graduatedAt: now - 35 * day,
    paperTradeCount: 11,
    minQualifyingTrades: 10,
    rolling24hLossBps: 8,
    rolling7dLossBps: 30,
    tradingEnabled: true,
    instantExit: true,
    vaultIndex: 0,
  },
];

export const MOCK_MANAGERS: ManagerView[] = [
  {
    pubkey: 'MGR1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    owner: 'OWN1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    totalVaults: 2,
    activeVaults: 1,
    totalJuniorDeposited: 53000,
    createdAt: now - 120 * day,
  },
  {
    pubkey: 'MGR2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    owner: 'OWN2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    totalVaults: 1,
    activeVaults: 1,
    totalJuniorDeposited: 70000,
    createdAt: now - 150 * day,
  },
  {
    pubkey: 'MGR3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    owner: 'OWN3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    totalVaults: 2,
    activeVaults: 1,
    totalJuniorDeposited: 46000,
    createdAt: now - 90 * day,
  },
];

export function mockPositions(walletPubkey: string): PositionView[] {
  const v1 = MOCK_VAULTS[0];
  const v2 = MOCK_VAULTS[4];
  return [
    {
      pubkey: 'POS1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      vaultConfigPubkey: v1.configPubkey,
      vault: v1,
      investorPubkey: walletPubkey,
      depositedAt: now - 20 * day,
      seniorShares: 25000,
      totalDeposited: 25000,
      alertThresholdBps: 500,
      currentValue: 27175,
    },
    {
      pubkey: 'POS2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      vaultConfigPubkey: v2.configPubkey,
      vault: v2,
      investorPubkey: walletPubkey,
      depositedAt: now - 10 * day,
      seniorShares: 10000,
      totalDeposited: 10000,
      alertThresholdBps: 500,
      currentValue: 10612,
    },
  ];
}

export function mockNavHistory(vaultConfigPubkey: string): NavPoint[] {
  const points: NavPoint[] = [];
  const base = 1.0;
  let nav = base;
  for (let i = 29; i >= 0; i--) {
    nav += (Math.random() - 0.45) * 0.008;
    nav = Math.max(0.85, nav);
    points.push({
      vaultConfigPubkey,
      recordedAt: now - i * day,
      nav: parseFloat(nav.toFixed(4)),
      juniorCapital: 45000,
      seniorCapital: 100000,
    });
  }
  return points;
}
