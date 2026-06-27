import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/* ── trader_profiles ─────────────────────────────────────────────────
   One row per on-chain TraderProfile PDA.
   Populated by ProfileInitialized events; updated by the indexer
   whenever TradeClosed events arrive and metrics are recomputed.
──────────────────────────────────────────────────────────────────── */
export const traderProfiles = pgTable("trader_profiles", {
  profile:            text("profile").primaryKey(),   // on-chain PDA pubkey (base58)
  handle:             text("handle").notNull().unique(),
  wallet:             text("wallet").notNull(),
  score:              integer("score").notNull().default(0),
  tier:               text("tier").notNull().default("Verified"),
  aum:                real("aum").notNull().default(0),
  nav_per_share:      bigint("nav_per_share", { mode: "number" }).notNull().default(1_000_000),
  hwm:                bigint("hwm", { mode: "number" }).notNull().default(1_000_000),
  total_shares:       bigint("total_shares", { mode: "number" }).notNull().default(0),
  trader_claimable:   bigint("trader_claimable", { mode: "number" }).notNull().default(0),
  capacity_usd:       real("capacity_usd").notNull().default(1_000_000),
  deposits_open:      boolean("deposits_open").notNull().default(true),
  return_30d:         real("return_30d").notNull().default(0),
  max_dd:             real("max_dd").notNull().default(0),
  sortino:            real("sortino").notNull().default(0),
  sharpe:             real("sharpe").notNull().default(0),
  win_rate:           real("win_rate").notNull().default(0),
  trade_count:        integer("trade_count").notNull().default(0),
  investors_count:    integer("investors_count").notNull().default(0),
  trader_self_funded: real("trader_self_funded").notNull().default(0),
  style_tags:         text("style_tags").array().notNull().default([]),
  equity_curve:       jsonb("equity_curve")
                        .notNull()
                        .$type<{ ts: number; value: number }[]>()
                        .default([]),
  days_active:        integer("days_active").notNull().default(0),
  created_at:         timestamp("created_at").notNull().defaultNow(),
  updated_at:         timestamp("updated_at").notNull().defaultNow(),
});

/* ── trade_records ──────────────────────────────────────────────────
   One row per TradeClosed event emitted by the arcadia_vault program.
──────────────────────────────────────────────────────────────────── */
export const tradeRecords = pgTable("trade_records", {
  id:             text("id").primaryKey(),            // tx signature or uuid
  profile:        text("profile").notNull().references(
                    () => traderProfiles.profile, { onDelete: "cascade" }),
  market:         text("market").notNull(),
  direction:      text("direction").notNull(),        // "long" | "short"
  size_usd:       real("size_usd").notNull().default(0),
  leverage:       real("leverage").notNull().default(1),
  entry_px:       real("entry_px").notNull().default(0),
  exit_px:        real("exit_px").notNull().default(0),
  realized_pnl:   real("realized_pnl").notNull().default(0),
  fees_usd:       real("fees_usd").notNull().default(0),
  was_liquidated: boolean("was_liquidated").notNull().default(false),
  opened_at:      bigint("opened_at", { mode: "number" }).notNull().default(0),
  closed_at:      bigint("closed_at", { mode: "number" }).notNull().default(0),
  sig:            text("sig"),
  created_at:     timestamp("created_at").notNull().defaultNow(),
});

/* ── deposit_records ────────────────────────────────────────────────
   One row per Deposited event.
──────────────────────────────────────────────────────────────────── */
export const depositRecords = pgTable("deposit_records", {
  id:            text("id").primaryKey(),
  profile:       text("profile").notNull().references(
                   () => traderProfiles.profile, { onDelete: "cascade" }),
  investor:      text("investor").notNull(),
  amount_usd:    real("amount_usd").notNull().default(0),
  shares_minted: bigint("shares_minted", { mode: "number" }).notNull().default(0),
  sig:           text("sig"),
  ts:            bigint("ts", { mode: "number" }).notNull().default(0),
  created_at:    timestamp("created_at").notNull().defaultNow(),
});

/* ── investor_positions ─────────────────────────────────────────────
   Current share balances per investor×vault.
   Updated on Deposited / Withdrawn events.
   PK = `${investor}:${profile}`.
──────────────────────────────────────────────────────────────────── */
export const investorPositions = pgTable("investor_positions", {
  id:                      text("id").primaryKey(),
  investor:                text("investor").notNull(),
  profile:                 text("profile").notNull().references(
                             () => traderProfiles.profile, { onDelete: "cascade" }),
  shares:                  bigint("shares", { mode: "number" }).notNull().default(0),
  cost_basis_usd:          real("cost_basis_usd").notNull().default(0),
  pending_withdraw_shares: bigint("pending_withdraw_shares", { mode: "number" }).notNull().default(0),
  updated_at:              timestamp("updated_at").notNull().defaultNow(),
});

/* ── insert schemas (used in the indexer for validation) ──────────── */
export const insertTraderProfileSchema    = createInsertSchema(traderProfiles);
export const insertTradeRecordSchema      = createInsertSchema(tradeRecords);
export const insertDepositRecordSchema    = createInsertSchema(depositRecords);
export const insertInvestorPositionSchema = createInsertSchema(investorPositions);

/* ── inferred types ─────────────────────────────────────────────── */
export type TraderProfileRow    = typeof traderProfiles.$inferSelect;
export type TradeRecordRow      = typeof tradeRecords.$inferSelect;
export type DepositRecordRow    = typeof depositRecords.$inferSelect;
export type InvestorPositionRow = typeof investorPositions.$inferSelect;
