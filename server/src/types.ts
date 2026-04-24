export interface ManagerProfileRow {
  address: string;
  owner: string;
  createdAt: number;
  totalJuniorDeposited: number;
  totalVaults: number;
  activeVaults: number;
  updatedAt: string;
}

export interface VaultRow {
  configAddress: string;
  stateAddress: string;
  treasuryAddress: string;
  manager: string;
  managerProfile: string;
  name: string;
  createdAt: number;
  paperWindowSecs: number;
  managerFeeBps: number;
  maxSlippageBps: number;
  minQualifyingTrades: number;
  vaultIndex: number;
  juniorCapital: number;
  seniorCapital: number;
  juniorSharesOutstanding: number;
  seniorSharesOutstanding: number;
  currentNav: number;
  highWaterMark: number;
  originalJuniorDeposit: number;
  paperTradeCount: number;
  paperMode: boolean;
  graduated: boolean;
  paused: boolean;
  tradingEnabled: boolean;
  treasuryLamports: number;
  indexedSlot: number;
  updatedAt: string;
}

export interface IndexStatus {
  lastIndexedSlot: number;
  lastIndexedAt: string;
  vaultCount: number;
  managerCount: number;
}
