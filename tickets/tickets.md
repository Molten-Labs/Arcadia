# Kiln — Implementation Tickets (Post-Review)
> Updated 2026-04-26 after full codebase audit | Completion % reflects actual code state

---

## Status Legend
| Symbol | Meaning |
|---|---|
| `100%` | Done and tested |
| `70-90%` | Mostly done, minor gaps |
| `30-60%` | Partially implemented |
| `10-20%` | Scaffolded / stubbed |
| `0%` | Not started |

---

## PHASE 1 — Complete the Solana Program (5 missing instructions + bug fixes)

### EPIC-P1.1: Account Structures & Foundation
> Core scaffolding and account definitions

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-001 | Pinocchio project scaffold + entrypoint | `lib.rs`, `entrypoint.rs` | **100%** | Done. Program ID: `WMzhPe...6RB` |
| P1-002 | Error enum with all error codes | `errors.rs` | **100%** | 21 error types defined |
| P1-003 | PDA seed constants | `states/utils.rs` | **100%** | MANAGER_PROFILE, VAULT_CONFIG, VAULT_STATE, TREASURY |
| P1-004 | `ManagerProfile` account (bytemuck zero-copy) | `states/manager_profile.rs` | **100%** | Fields: owner, created_at, total_junior_deposited, total_vaults, active_vaults |
| P1-005 | `VaultConfig` account (bytemuck zero-copy) | `states/vault_config.rs` | **100%** | Fields: manager, PDAs, fees, slippage, name, treasury_rent |
| P1-006 | `VaultState` account (bytemuck zero-copy) | `states/vault_state.rs` | **80%** | All fields defined but `rolling_24h_loss_bps`, `rolling_7d_loss_bps`, `cooldown_until`, `paper_trade_count` never updated by any instruction |
| P1-007 | Instruction dispatcher (entrypoint routing) | `entrypoint.rs` | **100%** | Routes discriminators 0-4 to handlers |
| P1-008 | IDL definitions (Shank metadata) | `instructions/mod.rs` | **90%** | 5 instructions defined. `graduate_vault` not in `pub use` exports |

---

### EPIC-P1.2: Implemented Instructions (audit + fix)
> These exist but need bug fixes

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-009 | `init_manager` instruction | `instructions/init_manager.rs` | **100%** | Creates ManagerProfile PDA. Tested. No issues. |
| P1-010 | `create_vault` instruction | `instructions/create_vault.rs` | **95%** | Creates VaultConfig + VaultState + Treasury PDAs. Minor: allows `manager_fee_bps = 0` |
| P1-011 | `deposit_junior` instruction | `instructions/deposit_junior.rs` | **100%** | Transfers lamports, calculates shares, updates NAV. Tested. |
| P1-012 | `update_nav` instruction | `instructions/update_nav.rs` | **60%** | Recomputes NAV from lamport balance. Waterfall loss logic works. **Missing**: Pyth oracle integration (uses raw lamports only), no event emission, no cooldown updates |
| P1-013 | `graduate_vault` instruction | `instructions/update_nav.rs` | **50%** | Checks paper window + positive PnL. **Bugs**: (1) `active_vaults.checked_sub(1).unwrap_or(0)` silently swallows underflow, (2) doesn't check `paper_trade_count >= min_qualifying_trades`, (3) doesn't check distinct active days, (4) not exported in `mod.rs` |
| P1-014 | Fix `graduate_vault` counter underflow | `instructions/update_nav.rs:184` | **0%** | Change `unwrap_or(0)` to return proper error |
| P1-015 | Fix graduation to check trade count + active days | `instructions/update_nav.rs` | **0%** | Must verify `paper_trade_count >= min_qualifying_trades` and distinct day count |
| P1-016 | Export `graduate_vault` in `mod.rs` | `instructions/mod.rs` | **0%** | Add to `pub use` |
| P1-017 | Wire unused VaultState fields | `states/vault_state.rs` | **0%** | `rolling_24h_loss_bps`, `rolling_7d_loss_bps`, `cooldown_until`, `paper_trade_count` need to be updated by instructions |

---

### EPIC-P1.3: Missing Instructions — Investor Flow
> Investors cannot participate yet

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-018 | `deposit_senior` instruction | NEW: `instructions/deposit_senior.rs` | **0%** | Gate: vault graduated. Check sliding junior ratio post-deposit. Transfer lamports manager→treasury. Calculate senior shares. Update senior_capital, senior_shares_outstanding, current_nav. |
| P1-019 | Sliding scale junior ratio function | NEW: `instructions/utils.rs` or inline | **0%** | `min_junior_ratio_bps(total_capital)`: <$50k→2000, $50k-$200k→1500, $200k-$500k→1200, $500k-$1M→1000, >$1M→800 |
| P1-020 | `withdraw_senior` instruction | NEW: `instructions/withdraw_senior.rs` | **0%** | Burn senior shares. Transfer USDC from treasury. 24h cooldown check. Instant exit if junior_ratio < 20%. Emit alert if low buffer. |
| P1-021 | `withdraw_junior` instruction | NEW: `instructions/withdraw_junior.rs` | **0%** | Burn junior shares. Check ratio stays valid post-withdrawal. Block if sole paper-mode depositor. |
| P1-022 | `InvestorPosition` account struct | NEW: `states/investor_position.rs` | **0%** | Fields: investor, vault, deposited_at, alert_threshold_bps. Bytemuck zero-copy. |
| P1-023 | Add discriminator 5-7 routing in entrypoint | `entrypoint.rs` | **0%** | Route deposit_senior (5), withdraw_senior (6), withdraw_junior (7) |
| P1-024 | Tests: deposit_senior happy path | NEW: `tests/senior_flow.rs` | **0%** | Graduated vault, valid ratio, shares issued correctly |
| P1-025 | Tests: deposit_senior rejected (not graduated) | NEW: `tests/senior_flow.rs` | **0%** | Paper vault rejects senior deposit |
| P1-026 | Tests: withdraw_senior with 24h cooldown | NEW: `tests/senior_flow.rs` | **0%** | Must wait 24h after deposit |
| P1-027 | Tests: withdraw_senior instant exit (junior < 20%) | NEW: `tests/senior_flow.rs` | **0%** | Cooldown bypassed when buffer thin |
| P1-028 | Tests: withdraw_junior ratio guard | NEW: `tests/senior_flow.rs` | **0%** | Reject if withdrawal breaks minimum ratio |

---

### EPIC-P1.4: Missing Instructions — Trading
> No actual trading exists yet

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-029 | Pyth oracle adapter (price feed reading) | NEW: `instructions/oracle.rs` or inline | **0%** | Read PriceUpdateV2, check staleness (60s), extract price for SOL/USDC and JUP/USDC |
| P1-030 | Update `update_nav` to use Pyth oracle | `instructions/update_nav.rs` | **0%** | Replace lamport-only NAV with: usdc_balance + mark_to_usdc(wsol, pyth_sol) + mark_to_usdc(jup, pyth_jup) |
| P1-031 | Vault Guard module (pre-swap checks) | NEW: `instructions/vault_guard.rs` | **0%** | 8 checks: (1) mints whitelisted, (2) target = Jupiter, (3) trading_enabled, (4) junior > 0, (5) cooldown expired, (6) position ≤ dynamic limit, (7) slippage ≤ max vs Pyth, (8) paper mode gate |
| P1-032 | Dynamic position limit function | inline in vault_guard | **0%** | `max_position_bps(effective_health)`: ≥100%→1000, 80-99%→600, 50-79%→300, 30-49%→100, <30%→0 |
| P1-033 | `execute_swap` instruction | NEW: `instructions/execute_swap.rs` | **0%** | Run vault guard → Jupiter CPI (SharedAccountsRoute, invoke_signed with treasury PDA) → post-swap NAV update → cooldown check |
| P1-034 | Jupiter CPI integration | inside execute_swap | **0%** | `jupiter-cpi` crate, pass remaining_accounts for routing, observe actual received vs minimum |
| P1-035 | Post-swap cooldown logic | inside execute_swap | **0%** | -3% single trade → 2h, -7% rolling 24h → 24h, -15% rolling 7d → 72h. Update rolling_loss_bps fields. |
| P1-036 | Increment `paper_trade_count` on paper swaps | inside execute_swap | **0%** | Only counted if trade amount > 5% of original_junior_deposit |
| P1-037 | Add discriminator 8 routing for execute_swap | `entrypoint.rs` | **0%** | Route execute_swap (8) |
| P1-038 | Tests: execute_swap happy path (devnet) | NEW: `tests/swap_flow.rs` | **0%** | Valid swap through Jupiter, NAV updated |
| P1-039 | Tests: execute_swap rejected by vault guard | NEW: `tests/swap_flow.rs` | **0%** | Each guard check tested in isolation |
| P1-040 | Tests: cooldown triggered post-swap | NEW: `tests/swap_flow.rs` | **0%** | -3% loss triggers 2h cooldown, subsequent swap rejected |
| P1-041 | Tests: vault freezes when junior = 0 | NEW: `tests/swap_flow.rs` | **0%** | Losing trades drain junior, vault frozen |

---

### EPIC-P1.5: Missing Instructions — Fees
> Manager cannot collect earnings

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-042 | `claim_fees` instruction | NEW: `instructions/claim_fees.rs` | **0%** | Gate: graduated. Calculate profit above HWM. fee = profit * 20 / 100. Convert to junior shares at current price. Mint to manager. Update HWM. |
| P1-043 | Add discriminator 9 routing for claim_fees | `entrypoint.rs` | **0%** | Route claim_fees (9) |
| P1-044 | Tests: claim_fees above HWM | NEW: `tests/fee_flow.rs` | **0%** | Profit exists, correct fee minted |
| P1-045 | Tests: claim_fees rejected (no profit above HWM) | NEW: `tests/fee_flow.rs` | **0%** | NAV below or at HWM, zero fee |
| P1-046 | Tests: claim_fees after recovery (no double fee) | NEW: `tests/fee_flow.rs` | **0%** | NAV drops then recovers to HWM, no fee until new high |

---

### EPIC-P1.6: Full Lifecycle Tests
> End-to-end validation

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P1-047 | Integration: paper → graduate → deposit senior → trade → fees | NEW: `tests/lifecycle.rs` | **0%** | Full happy path |
| P1-048 | Integration: losing vault → freeze → investor exit | NEW: `tests/lifecycle.rs` | **0%** | Full loss path |
| P1-049 | Regenerate Shank IDL after all instructions added | CLI | **0%** | `pnpm -w codegen:shank` |
| P1-050 | Regenerate TypeScript SDK from new IDL | CLI | **0%** | `pnpm --dir clients run generate` |

---

### Phase 1 Summary
```
EPIC-P1.1 (Foundation):     8 tickets  → 5 done, 1 partial, 2 minor fixes     ~90%
EPIC-P1.2 (Existing):       9 tickets  → 3 done, 2 partial, 4 bug fixes       ~55%
EPIC-P1.3 (Investor):      11 tickets  → 0 done                                 0%
EPIC-P1.4 (Trading):       13 tickets  → 0 done                                 0%
EPIC-P1.5 (Fees):           5 tickets  → 0 done                                 0%
EPIC-P1.6 (Lifecycle):      4 tickets  → 0 done                                 0%
─────────────────────────────────────────────────────────────────────────────────
PHASE 1 TOTAL:              50 tickets  → ~30% complete
```

---

## PHASE 2 — Connect Frontend to Chain

### EPIC-P2.1: Wallet & SDK Integration
> Replace mock wallet with real Solana integration

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P2-001 | Install `@solana/web3.js` + `@solana/wallet-adapter-*` | `app/package.json` | **0%** | Add solana/web3.js, wallet-adapter-react, wallet-adapter-wallets, wallet-adapter-react-ui |
| P2-002 | Replace custom `wallet.tsx` with Solana Wallet Adapter | `app/src/lib/wallet.tsx` | **0%** | Use `WalletProvider`, `ConnectionProvider` from official adapter. Remove mock connect/disconnect. |
| P2-003 | Update `ConnectModal` for real wallet selection | `app/src/components/ConnectModal.tsx` | **10%** | Modal UI exists, needs real adapter hooks instead of mock |
| P2-004 | Integrate generated TypeScript SDK (`clients/ts`) | `app/src/lib/kiln.ts` (NEW) | **0%** | Import account decoders, instruction builders from `@port-protocol/client` |
| P2-005 | Create RPC connection config (Helius devnet) | `app/src/lib/connection.ts` (NEW) | **0%** | Use env var `VITE_RPC_URL` |
| P2-006 | Create PDA derivation helpers | `app/src/lib/pdas.ts` (NEW) | **0%** | `getManagerProfilePDA()`, `getVaultConfigPDA()`, `getVaultStatePDA()`, `getTreasuryPDA()` |

---

### EPIC-P2.2: Replace Mock Data with On-Chain Queries
> Every page currently reads from `mockData.ts`

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P2-007 | Fetch all vaults from chain (getProgramAccounts) | `app/src/hooks/useVaults.ts` (NEW) | **0%** | TanStack Query hook. Deserialize VaultConfig + VaultState pairs. |
| P2-008 | Replace `mockData.vaults` on Vaults page | `app/src/pages/Vaults.tsx` | **0%** | Currently uses `mockData.vaults`. Wire to `useVaults()` hook. |
| P2-009 | Replace `mockData.getVault` on VaultDetail page | `app/src/pages/VaultDetail.tsx` | **0%** | Fetch single vault by config PDA. |
| P2-010 | Fetch all traders from chain (ManagerProfile accounts) | `app/src/hooks/useTraders.ts` (NEW) | **0%** | Deserialize ManagerProfile accounts. |
| P2-011 | Replace `mockData.traders` on Traders page | `app/src/pages/Traders.tsx` | **0%** | Wire to `useTraders()` hook. |
| P2-012 | Replace `mockData.getTrader` on TraderProfile page | `app/src/pages/TraderProfile.tsx` | **0%** | Fetch single ManagerProfile by wallet. |
| P2-013 | Fetch investor positions (by connected wallet) | `app/src/hooks/usePositions.ts` (NEW) | **0%** | Query InvestorPosition accounts for connected wallet. |
| P2-014 | Replace mock positions on Portfolio page | `app/src/pages/Portfolio.tsx` | **0%** | Wire to `usePositions()` hook. |
| P2-015 | Replace mock data on Manager Dashboard | `app/src/pages/ManagerDashboard.tsx` | **0%** | Fetch connected wallet's ManagerProfile + owned vaults. |
| P2-016 | Fetch real SOL/USDC balance for connected wallet | `app/src/hooks/useBalances.ts` (NEW) | **0%** | Replace hardcoded `12_400` and `28_450.32` |
| P2-017 | Replace `protocolStats` with aggregated on-chain data | `app/src/pages/Index.tsx` | **0%** | Sum TVL, count vaults, graduated count from chain data |

---

### EPIC-P2.3: Wire Transactions to Real Signing
> TxModal currently fakes confirmations with timers

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P2-018 | Build + sign `create_vault` transaction | `app/src/pages/CreateVault.tsx` | **0%** | Use SDK instruction builder. `sendTransaction()` via wallet adapter. |
| P2-019 | Build + sign `deposit_junior` transaction | `app/src/pages/ManagerVault.tsx` | **0%** | Junior deposit from manager dashboard |
| P2-020 | Build + sign `deposit_senior` transaction | `app/src/pages/VaultDetail.tsx` | **0%** | Senior deposit from vault detail page |
| P2-021 | Build + sign `withdraw_senior` transaction | `app/src/pages/VaultDetail.tsx` | **0%** | With cooldown check display |
| P2-022 | Build + sign `withdraw_junior` transaction | `app/src/pages/ManagerVault.tsx` | **0%** | With ratio validation display |
| P2-023 | Build + sign `execute_swap` transaction | `app/src/pages/ManagerVault.tsx` | **0%** | Fetch Jupiter quote → build swap tx → sign. Most complex. |
| P2-024 | Build + sign `claim_fees` transaction | `app/src/pages/ManagerDashboard.tsx` | **0%** | Fee claim button |
| P2-025 | Build + sign `graduate_vault` transaction | `app/src/pages/ManagerVault.tsx` | **0%** | Graduation button (permissionless) |
| P2-026 | Update `TxModal` for real tx lifecycle | `app/src/components/TxModal.tsx` | **0%** | Replace timers with `confirmTransaction()`. Show real tx signature + explorer link. |
| P2-027 | Error handling for failed transactions | `app/src/components/TxModal.tsx` | **0%** | Parse program errors, show user-friendly messages |

---

### EPIC-P2.4: Real-Time Data & Polish
> Live updates and UX refinements

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P2-028 | Account change subscription (websocket) | `app/src/hooks/useAccountSubscription.ts` (NEW) | **0%** | `connection.onAccountChange()` for watched vaults |
| P2-029 | Auto-refresh vault data after own transactions | All transaction pages | **0%** | Invalidate TanStack Query cache after tx confirms |
| P2-030 | Fix Trade page hardcoded SOL price | `app/src/pages/Trade.tsx` | **0%** | Replace `amount / 184` with live Pyth/Jupiter price |
| P2-031 | Fix theme toggle (Settings page) | `app/src/pages/Settings.tsx` | **0%** | Wire to actual Tailwind dark mode class toggle |
| P2-032 | Remove `mockData.ts` entirely | `app/src/lib/mockData.ts` | **0%** | Delete once all pages use real data |
| P2-033 | NAV chart from indexer API (historical data) | `app/src/pages/VaultDetail.tsx` | **0%** | Depends on Phase 3 indexer. Fallback: derive from on-chain events. |

---

### Phase 2 Summary
```
EPIC-P2.1 (Wallet/SDK):     6 tickets  → 0 done                                 0%
EPIC-P2.2 (Data Queries):  11 tickets  → 0 done                                 0%
EPIC-P2.3 (Transactions):  10 tickets  → 0 done                                 0%
EPIC-P2.4 (Polish):         6 tickets  → 0 done                                 0%
─────────────────────────────────────────────────────────────────────────────────
PHASE 2 TOTAL:              33 tickets  → 0% complete
```

---

## PHASE 3 — Indexer & Backend

### EPIC-P3.1: Fix Existing Indexer (server-rs)
> Axum+Postgres backend needs completion

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P3-001 | Axum server scaffold + health check | `server-rs/src/main.rs` | **100%** | Running, `/health` works |
| P3-002 | PostgreSQL connection + events table | `server-rs/src/main.rs` | **100%** | Auto-creates table, stores JSON |
| P3-003 | Webhook ingestion endpoint (`POST /webhook`) | `server-rs/src/main.rs` | **70%** | Accepts payload, stores raw JSON. Missing: Helius signature validation. |
| P3-004 | Helius webhook signature validation | `server-rs/src/main.rs` | **0%** | Verify `x-helius-signature` header against webhook secret |
| P3-005 | Parse Helius events into structured tables | `server-rs/src/main.rs` | **0%** | Extract: event type, vault address, NAV value, trade details, timestamps. Create `nav_history`, `trades`, `alerts` tables. |
| P3-006 | Add read API: `GET /vaults` | `server-rs/src/main.rs` | **0%** | Return all vaults with latest NAV, status |
| P3-007 | Add read API: `GET /vaults/:address/nav-history` | `server-rs/src/main.rs` | **0%** | Return NAV data points for charting |
| P3-008 | Add read API: `GET /vaults/:address/trades` | `server-rs/src/main.rs` | **0%** | Return trade history for a vault |
| P3-009 | Add read API: `GET /vaults/:address/alerts` | `server-rs/src/main.rs` | **0%** | Return alerts (cooldown, freeze, low buffer) |
| P3-010 | Add read API: `GET /managers/:address` | `server-rs/src/main.rs` | **0%** | Return manager profile + vault list |
| P3-011 | Database migrations system | `server-rs/migrations/` (NEW) | **0%** | SQLx migrations instead of inline CREATE TABLE |

---

### EPIC-P3.2: Fix Node Server (server/) — OR Remove
> Currently broken (missing indexer.ts)

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P3-012 | Decision: keep Node server or remove | — | **0%** | Duplicates server-rs functionality. Recommend: remove and use server-rs only. |
| P3-013 | If keeping: implement `indexer.ts` | `server/src/indexer.ts` (MISSING) | **0%** | 5 functions needed: `startIndexer`, `getHealthSnapshot`, `getManagerByAddress`, `getVaultByAddress`, `listVaults` |
| P3-014 | If removing: delete `server/` directory | `server/` | **0%** | Clean up dead code |

---

### EPIC-P3.3: Helius Webhook Setup
> Configure real-time event streaming

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P3-015 | Create Helius webhook for Kiln program (devnet) | Helius dashboard | **0%** | Subscribe to program ID `WMzhPe...6RB` on devnet |
| P3-016 | Configure webhook URL to server-rs endpoint | Helius dashboard | **0%** | Point to deployed server-rs `/webhook` |
| P3-017 | Test webhook with a real transaction | — | **0%** | Send a `create_vault` tx, verify event arrives and is stored |

---

### EPIC-P3.4: TypeScript SDK Completion
> Generated SDK needs tests and polish

| ID | Ticket | File(s) | % | Notes |
|---|---|---|---|---|
| P3-018 | Codama generation pipeline working | `clients/codama.ts` | **100%** | Generates from Shank IDL |
| P3-019 | All 5 instruction builders generated | `clients/src/generated/instructions/` | **100%** | initManager, createVault, depositJunior, updateNav, graduateVault |
| P3-020 | All 3 account decoders generated | `clients/src/generated/accounts/` | **100%** | VaultConfig, VaultState, ManagerProfile |
| P3-021 | Write real SDK tests (not placeholder) | `clients/test/example.test.ts` | **0%** | Currently `expect(true).toBe(true)`. Need integration tests. |
| P3-022 | Regenerate SDK after Phase 1 adds 5 instructions | `clients/` | **0%** | Depends on P1-049, P1-050 |
| P3-023 | Add convenience wrappers / helper functions | `clients/src/helpers.ts` (NEW) | **0%** | User-friendly `createVault()`, `depositSenior()`, etc. that handle PDA derivation |

---

### Phase 3 Summary
```
EPIC-P3.1 (Indexer):         11 tickets → 3 done, 1 partial                   ~25%
EPIC-P3.2 (Node server):     3 tickets  → 0 done (decision needed)              0%
EPIC-P3.3 (Helius):          3 tickets  → 0 done                                0%
EPIC-P3.4 (SDK):             6 tickets  → 3 done                              ~50%
─────────────────────────────────────────────────────────────────────────────────
PHASE 3 TOTAL:               23 tickets → ~20% complete
```

---

## OVERALL PROGRESS

```
PHASE 1 (Program):    50 tickets  →  ~30% complete   ████████░░░░░░░░░░░░░░░░░░
PHASE 2 (Frontend):   33 tickets  →    0% complete   ░░░░░░░░░░░░░░░░░░░░░░░░░░
PHASE 3 (Backend):    23 tickets  →  ~20% complete   █████░░░░░░░░░░░░░░░░░░░░░
══════════════════════════════════════════════════════════════════════════════════
TOTAL:               106 tickets  →  ~17% complete   ████░░░░░░░░░░░░░░░░░░░░░░
```

---

## CRITICAL PATH (Blocking Dependencies)

```
P1-014..P1-017 (bug fixes)
    ↓
P1-018..P1-028 (investor flow)
    ↓
P1-029..P1-041 (trading + oracle)  ←  most complex, highest risk
    ↓
P1-042..P1-046 (fees)
    ↓
P1-049..P1-050 (regenerate SDK)
    ↓
P2-001..P2-006 (wallet + SDK integration)
    ↓
P2-007..P2-017 (replace mock data)
    ↓
P2-018..P2-027 (wire transactions)
    ↓
P3-015..P3-017 (Helius webhooks)  ←  can start in parallel with Phase 2
    ↓
P3-004..P3-010 (indexer APIs)
    ↓
P2-033 (NAV chart from indexer)
```

---

## NEXT ACTION
> Pick a ticket or epic to start implementing. Recommended: **P1-014 through P1-017** (bug fixes) then **P1-018** (deposit_senior) to unlock the investor flow.
