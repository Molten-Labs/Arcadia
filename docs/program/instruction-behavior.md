# Arcadia Vault Instruction Behavior

Source of truth: `spec-solana-program.html`.

This file is a derived working plan. If anything here conflicts with `spec-solana-program.html`, the HTML spec wins and this file must be refreshed before implementation continues.

Status values: `planned`, `in_progress`, `tested`, `complete`.

Risk level: Critical. This program controls token custody through PDAs, NAV/share math, oracle-authorized trade inputs, and fee settlement.

## Integration Contract

- Framework: Anchor 1.0.2.
- Primary test gate: Rust LiteSVM.
- Base token: devnet USDC-style mint with 6 decimals.
- Token CPIs: `anchor_spl::token_interface::transfer_checked` only.
- Custom PDAs: `PlatformConfig`, `TraderProfile`, `InvestorAccount`, `InvestorPosition`.
- Shares are data in `InvestorPosition.shares`, not SPL tokens.
- The `TraderProfile` PDA is the vault authority. There is no admin escape hatch for depositor funds.

## Foundation Module

- Status: complete.
- Shared modules now exist for constants/PDA seeds, `ArcadiaError`, locked events, the four fixed-size account structs, checked math helpers, Token Interface CPI helpers, and profile PDA signer seeds.
- Smoke-only state and constants are quarantined in `smoke.rs` so the temporary scaffold health tests can remain until real instruction tests replace them.
- `initialize_platform` is complete; the next gate is `initialize_profile`.

## Module Order

| Order | Instruction | Module | Status |
| --- | --- | --- | --- |
| 1 | `initialize_platform` | `instructions/admin/initialize_platform.rs` | complete |
| 2 | `initialize_profile` | `instructions/initialize_profile.rs` | planned |
| 3 | `set_capacity` | `instructions/admin/set_capacity.rs` | planned |
| 4 | `initialize_investor` | `instructions/initialize_investor.rs` | planned |
| 5 | `deposit` | `instructions/deposit.rs` | planned |
| 6 | `request_withdraw` | `instructions/withdraw.rs` | planned |
| 7 | `process_withdraw` | `instructions/withdraw.rs` | planned |
| 8 | `record_trade` | `instructions/record_trade.rs` | planned |
| 9 | `settle` | `instructions/settle.rs` | planned |
| 10 | `trader_withdraw_profit` | `instructions/trader_withdraw_profit.rs` | planned |

## `initialize_platform`

- Status: complete.
- Purpose: create the singleton `PlatformConfig` once, record the admin, oracle authority, base mint, treasury token account, and fee parameters.
- Inputs: `perf_fee_bps: u16`, `mgmt_fee_bps: u16`, `oracle_authority: Pubkey`.
- Accounts: admin signer payer, `PlatformConfig` PDA `[b"platform"]`, base mint, treasury token account, system program.
- Access control: permissionless first initializer becomes `config.admin`; Anchor `init` prevents reinitialization.
- State writes: all `PlatformConfig` fields and saved canonical bump.
- Token movement: none.
- Event: none in MVP.
- Errors: `InvalidFeeConfig`; reinit blocked by Anchor.
- Done criteria: complete; LiteSVM covers happy path, unsafe fee configs, second init, wrong config PDA, treasury mint mismatch, saved bump, and exact config writes. IDL/client generation exposes `initializePlatform` and `platformConfig`.

## `initialize_profile`

- Status: planned.
- Purpose: let a trader create one vault/profile; the profile PDA becomes the vault token account authority.
- Inputs: `max_leverage: u8`.
- Accounts: trader signer payer, config, `TraderProfile` PDA `[b"profile", trader]`, base mint, vault token account, system program, token interface program, rent.
- Access control: trader signer; one profile per trader via PDA `init`.
- State writes: trader, base mint, vault token, zero share/accounting fields, `hwm_per_share = SHARE_SCALE`, active status, `score_tier = 255`, timestamps, max leverage, bump.
- Token movement: none, but initializes/validates vault token account authority as profile PDA.
- Event: `ProfileInitialized`.
- Errors: `InvalidLeverage`; reinit blocked by Anchor.
- Done criteria: HWM starts at par, profile is active and not fundable, vault token authority is profile PDA, invalid leverage fails, second profile init fails.

## `set_capacity`

- Status: planned.
- Purpose: let the oracle authority push offchain-computed capacity and score tier onto a profile.
- Inputs: `cap_usd: u64`, `score_tier: u8`.
- Accounts: oracle authority signer, config, mutable profile.
- Access control: signer must equal `config.oracle_authority`.
- State writes: `profile.capacity_cap_usd`, `profile.score_tier`.
- Token movement: none.
- Event: none in MVP.
- Errors: `Unauthorized`, `InvalidTier`, `VaultNotActive` if the profile is not active.
- Done criteria: accepts tiers `0..=3` and `255`, rejects other tiers, rejects non-oracle signers, writes cap exactly with no on-chain exponential math.

## `initialize_investor`

- Status: planned.
- Purpose: create a depositor account used by investors or by a trader self-funding their own vault.
- Inputs: none.
- Accounts: wallet signer payer, `InvestorAccount` PDA `[b"investor", wallet]`, system program.
- Access control: wallet signer; one investor account per wallet via PDA `init`.
- State writes: owner, zero position count, zero lifetime deposited, created timestamp, bump.
- Token movement: none.
- Event: `InvestorInitialized`.
- Errors: reinit blocked by Anchor.
- Done criteria: stored owner matches wallet, counters start at zero, bump is saved, second init fails.

## `deposit`

- Status: planned.
- Purpose: move USDC into a trader vault and mint data shares to the depositor position at current NAV.
- Inputs: `amount: u64`.
- Accounts: depositor signer, investor account, mutable profile, `InvestorPosition` PDA `[b"position", depositor, profile]`, base mint, vault token, depositor token, token interface program, system program.
- Access control: depositor signs and must own the source token account; investor account and position are bound to depositor/profile by seeds and `has_one`.
- State writes: profile total shares, optional trader shares, position owner/profile/shares/cost basis/deposit timestamp/bump, investor account lifetime deposits and position count on first position.
- Token movement: `transfer_checked` from depositor token account to vault token account.
- Event: `Deposited`.
- Errors: `VaultNotActive`, `ZeroAmount`, `InsufficientFunds`, `CapacityNotSet`, `CapacityExceeded`, `DustDeposit`, `MathOverflow`.
- Done criteria: first deposit mints `shares = amount`; later deposits use floor `amount * total_shares / total_assets`; investor deposits are capacity gated; trader own-capital deposits are cap-exempt; zero-share deposits fail; vault token delta equals amount.

## `request_withdraw`

- Status: planned.
- Purpose: record a pending share withdrawal and compute when it can be processed.
- Inputs: `shares: u64`.
- Accounts: owner signer, profile, vault token, mutable position.
- Access control: owner signer must own the position; position is bound to profile.
- State writes: increases `position.pending_withdraw_shares`, sets `position.withdraw_ready_ts`.
- Token movement: none.
- Event: `WithdrawRequested`.
- Errors: `ZeroAmount`, `InsufficientShares`, `MathOverflow`.
- Done criteria: rejects zero/over-share requests, computes withdrawal value from NAV excluding `trader_claimable`, uses instant window for value under 500 bps of AUM and next daily window otherwise.

## `process_withdraw`

- Status: planned.
- Purpose: burn pending shares and pay the owner their pro-rata USDC from the vault.
- Inputs: none.
- Accounts: owner signer, mutable profile, mutable position, base mint, vault token, owner token, token interface program.
- Access control: owner signer must own the position; profile signs token-out via PDA seeds.
- State writes: decreases profile total shares, decreases trader shares if the owner is the trader, decreases position shares, clears pending withdrawal shares, closes empty positions when supported by the implementation gate.
- Token movement: signed `transfer_checked` from vault token to owner token.
- Event: `Withdrawn`.
- Errors: `NothingPending`, `NoticeNotElapsed`, `InsufficientVaultLiquidity`, `MathOverflow`.
- Done criteria: rejects early processing, pays floor `pending_shares * (total_assets - trader_claimable) / total_shares`, never touches arbitrary recipients, keeps trader claimable excluded from investor NAV.

## `record_trade`

- Status: planned.
- Purpose: apply realized PnL from a simulated closed trade to the vault token balance on devnet.
- Inputs: `market: String`, `direction: u8`, `size_usd: u64`, `leverage_x100: u16`, `entry_px: u64`, `exit_px: u64`, `fees_usd: u64`, `was_liquidated: bool`, `opened_at: i64`, `closed_at: i64`.
- Accounts: trader signer, oracle authority signer, config, mutable profile, base mint, vault token, treasury token, treasury authority signer, token interface program.
- Access control: trader must equal `profile.trader`; oracle authority must equal `config.oracle_authority`; devnet treasury authority signs positive-PnL top-ups.
- State writes: no share count changes; NAV changes through token balance movement.
- Token movement: positive PnL transfers treasury to vault; negative PnL transfers vault to treasury with profile PDA signing and does not drain `trader_claimable`.
- Event: `TradeClosed`.
- Errors: `Unauthorized`, `VaultNotActive`, `NoShares`, `InvalidTradeParams`, `LeverageTooHigh`, `NotionalTooLarge`, `MathOverflow`.
- Done criteria: validates dual signature, trade direction, prices, time ordering, leverage, 20 percent AUM notional cap, exact i128 PnL formula, long/short gain/loss directions, and token deltas.

## `settle`

- Status: planned.
- Purpose: crystallize profit above high-water mark into platform and trader performance fee accounting.
- Inputs: none.
- Accounts: caller signer, config, mutable profile, base mint, vault token, treasury token, token interface program.
- Access control: caller must be profile trader or config oracle authority.
- State writes: updates `last_settle_ts`; on profit, increases `trader_claimable` and resets `hwm_per_share`.
- Token movement: signed `transfer_checked` from vault token to treasury token for platform performance cut and any implemented management accrual.
- Event: `Settled` only when `current_nav > hwm_per_share`.
- Errors: `Unauthorized`, `NoShares`, `MathOverflow`.
- Done criteria: no performance fee on flat/down NAV, exact tier split, platform cut leaves vault, trader cut remains earmarked and excluded from NAV, repeated flat settlement does not double charge.

## `trader_withdraw_profit`

- Status: planned.
- Purpose: let the trader withdraw earmarked performance fees from `trader_claimable`.
- Inputs: `amount: u64`.
- Accounts: trader signer, mutable profile, base mint, vault token, trader token, token interface program.
- Access control: trader signer must equal `profile.trader`; profile PDA signs token-out.
- State writes: decreases `profile.trader_claimable` by amount.
- Token movement: signed `transfer_checked` from vault token to trader token.
- Event: `ProfitWithdrawn`.
- Errors: `Unauthorized`, `ZeroAmount`, `InsufficientClaimable`, `InsufficientVaultLiquidity`, `MathOverflow`.
- Done criteria: rejects zero, non-trader, over-claim, and insolvent withdrawals; derived NAV is unchanged because total assets and claimable both decrease by amount.
