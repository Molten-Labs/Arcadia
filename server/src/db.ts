import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { DB_PATH } from "./config.js";

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS managers (
    address TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    total_junior_deposited INTEGER NOT NULL,
    total_vaults INTEGER NOT NULL,
    active_vaults INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vaults (
    config_address TEXT PRIMARY KEY,
    state_address TEXT NOT NULL,
    treasury_address TEXT NOT NULL,
    manager TEXT NOT NULL,
    manager_profile TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    paper_window_secs INTEGER NOT NULL,
    manager_fee_bps INTEGER NOT NULL,
    max_slippage_bps INTEGER NOT NULL,
    min_qualifying_trades INTEGER NOT NULL,
    vault_index INTEGER NOT NULL,
    junior_capital INTEGER NOT NULL,
    senior_capital INTEGER NOT NULL,
    junior_shares_outstanding INTEGER NOT NULL,
    senior_shares_outstanding INTEGER NOT NULL,
    current_nav INTEGER NOT NULL,
    high_water_mark INTEGER NOT NULL,
    original_junior_deposit INTEGER NOT NULL,
    paper_trade_count INTEGER NOT NULL,
    paper_mode INTEGER NOT NULL,
    graduated INTEGER NOT NULL,
    paused INTEGER NOT NULL,
    trading_enabled INTEGER NOT NULL,
    treasury_lamports INTEGER NOT NULL,
    indexed_slot INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS index_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_indexed_slot INTEGER NOT NULL,
    last_indexed_at TEXT NOT NULL
  );
`);
