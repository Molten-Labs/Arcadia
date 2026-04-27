import { INDEX_INTERVAL_MS, PROGRAM_ID, RPC_URL } from "./config.js";
import { db } from "./db.js";
import type { IndexStatus, ManagerProfileRow, VaultRow } from "./types.js";

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
}

interface ManagerDbRow {
  address: string;
  owner: string;
  created_at: number;
  total_junior_deposited: number;
  total_vaults: number;
  active_vaults: number;
  updated_at: string;
}

interface VaultDbRow {
  config_address: string;
  state_address: string;
  treasury_address: string;
  manager: string;
  manager_profile: string;
  name: string;
  created_at: number;
  paper_window_secs: number;
  manager_fee_bps: number;
  max_slippage_bps: number;
  min_qualifying_trades: number;
  vault_index: number;
  junior_capital: number;
  senior_capital: number;
  junior_shares_outstanding: number;
  senior_shares_outstanding: number;
  current_nav: number;
  high_water_mark: number;
  original_junior_deposit: number;
  paper_trade_count: number;
  paper_mode: number;
  graduated: number;
  paused: number;
  trading_enabled: number;
  treasury_lamports: number;
  indexed_slot: number;
  updated_at: string;
}

interface StatusDbRow {
  last_indexed_slot: number;
  last_indexed_at: string;
}

function mapManager(row: ManagerDbRow): ManagerProfileRow {
  return {
    address: row.address,
    owner: row.owner,
    createdAt: row.created_at,
    totalJuniorDeposited: row.total_junior_deposited,
    totalVaults: row.total_vaults,
    activeVaults: row.active_vaults,
    updatedAt: row.updated_at,
  };
}

function mapVault(row: VaultDbRow): VaultRow {
  return {
    configAddress: row.config_address,
    stateAddress: row.state_address,
    treasuryAddress: row.treasury_address,
    manager: row.manager,
    managerProfile: row.manager_profile,
    name: row.name,
    createdAt: row.created_at,
    paperWindowSecs: row.paper_window_secs,
    managerFeeBps: row.manager_fee_bps,
    maxSlippageBps: row.max_slippage_bps,
    minQualifyingTrades: row.min_qualifying_trades,
    vaultIndex: row.vault_index,
    juniorCapital: row.junior_capital,
    seniorCapital: row.senior_capital,
    juniorSharesOutstanding: row.junior_shares_outstanding,
    seniorSharesOutstanding: row.senior_shares_outstanding,
    currentNav: row.current_nav,
    highWaterMark: row.high_water_mark,
    originalJuniorDeposit: row.original_junior_deposit,
    paperTradeCount: row.paper_trade_count,
    paperMode: row.paper_mode !== 0,
    graduated: row.graduated !== 0,
    paused: row.paused !== 0,
    tradingEnabled: row.trading_enabled !== 0,
    treasuryLamports: row.treasury_lamports,
    indexedSlot: row.indexed_slot,
    updatedAt: row.updated_at,
  };
}

export function listVaults(): VaultRow[] {
  const rows = db
    .prepare("SELECT * FROM vaults ORDER BY updated_at DESC, config_address ASC")
    .all() as VaultDbRow[];
  return rows.map(mapVault);
}

export function getVaultByAddress(configAddress: string): VaultRow | null {
  const row = db
    .prepare("SELECT * FROM vaults WHERE config_address = ?")
    .get(configAddress) as VaultDbRow | undefined;
  return row ? mapVault(row) : null;
}

export function getManagerByAddress(address: string): ManagerProfileRow | null {
  const row = db
    .prepare("SELECT * FROM managers WHERE address = ? OR owner = ?")
    .get(address, address) as ManagerDbRow | undefined;
  return row ? mapManager(row) : null;
}

export function getHealthSnapshot(): IndexStatus {
  const status = db
    .prepare("SELECT last_indexed_slot, last_indexed_at FROM index_status WHERE id = 1")
    .get() as StatusDbRow | undefined;
  const counts = db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM vaults) AS vault_count, (SELECT COUNT(*) FROM managers) AS manager_count",
    )
    .get() as { vault_count: number; manager_count: number };

  return {
    lastIndexedSlot: status?.last_indexed_slot ?? 0,
    lastIndexedAt: status?.last_indexed_at ?? "never",
    vaultCount: counts.vault_count,
    managerCount: counts.manager_count,
  };
}

export async function startIndexer(log: Logger): Promise<void> {
  db.prepare(
    "INSERT OR IGNORE INTO index_status (id, last_indexed_slot, last_indexed_at) VALUES (1, 0, ?)",
  ).run(new Date().toISOString());

  log.info(
    `Kiln indexer API started for program ${PROGRAM_ID} using ${RPC_URL}; live RPC ingestion is not implemented in this MVP server`,
  );

  setInterval(() => {
    log.warn("live RPC ingestion is still deferred; serving persisted vault rows only");
  }, INDEX_INTERVAL_MS).unref();
}
