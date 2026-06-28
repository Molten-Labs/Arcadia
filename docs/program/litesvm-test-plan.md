# Arcadia Vault LiteSVM Test Plan

Source of truth: `spec-solana-program.html`.

This file is derived from the HTML spec. If it conflicts with `spec-solana-program.html`, update this file before continuing implementation.

LiteSVM is the per-instruction completion gate. Devnet is useful after the local end-to-end flow is green, but it is not required before moving from one instruction module to the next.

## Shared Fixtures

- Program loading: use the compiled `arcadia_vault.so` with `LiteSVM::add_program`.
- Keypairs: admin, trader, investor, second investor, oracle authority, attacker, treasury authority.
- Mint fixture: create a 6-decimal USDC-style mint for Token Interface tests.
- Token accounts: trader source token, investor source token, second investor source token, profile vault token, platform treasury token, owner payout token, trader profit token.
- PDA helpers: `platform`, `profile(trader)`, `investor(wallet)`, `position(wallet, profile)`.
- Transaction helpers: success sender returning CU, failure sender preserving logs, blockhash expiry after each transaction.
- Clock helpers: read clock, set timestamp, warp to next daily settlement window.
- Assertion helpers: decode all four custom accounts, read token balances, assert token conservation, assert event log content when LiteSVM exposes logs clearly.
- CU tracking: record CUs per successful instruction and print a final `zz_cu_summary`.

## Global Test Rules

- Every instruction gets at least one success test and one authority/account-binding failure test.
- Every instruction that accepts numeric input gets zero, over-limit, or overflow-path tests.
- Every instruction that moves tokens must assert pre/post balances and conservation.
- All token transfers must use `transfer_checked` with the base mint decimals.
- Every PDA test must derive the exact same seeds as the on-chain constraints.
- Do not fabricate program-owned state accounts directly; create state through prior instructions.
- Devnet-only treasury top-up behavior for `record_trade` is tested locally with funded fixture token accounts.

## Foundation Module

- Status: complete.
- Passing checks: share mint flooring, NAV excluding `trader_claimable`, strict 500 bps withdrawal threshold, long/short realized PnL sign and magnitude, fee/notional/profit/management-fee math, and the temporary LiteSVM smoke round trip/negative tests.
- Pending until instruction gates: Token Interface fixture mints/accounts, event-log assertions for real Arcadia events, and token-conservation assertions on fund-moving handlers.
- Completion rule: keep the smoke tests only as scaffold health checks; retire or replace them once real instruction coverage reaches equivalent build/test confidence.

## `initialize_platform`

- Status: complete.
- Happy path: initializes config with admin, oracle authority, base mint, treasury token, fee bps, and bump.
- Authorization/reinit: second init of the singleton config fails.
- Invalid input: perf fee greater than denominator fails; management fee greater than denominator fails; perf fee plus max trader tier over denominator fails.
- Account assertions: config PDA seed, base mint, treasury mint, treasury token mint binding, and saved bump.
- Event assertions: none expected; no event is emitted in MVP.
- CU: recorded `initialize_platform` at about 9.9k CUs in the current LiteSVM run.

## `initialize_profile`

- Status: complete.
- Happy path: trader creates profile and vault token authority is profile PDA.
- Authorization/reinit: second profile for same trader fails; profile PDA derived for a different trader cannot be used.
- Invalid input: max leverage zero fails; max leverage above ceiling fails.
- Account assertions: `hwm_per_share = SHARE_SCALE`, shares are zero, `score_tier = 255`, status active, timestamps set, bump saved.
- Event assertions: `ProfileInitialized` Anchor event log is emitted.
- Token assertions: initialized vault token account has mint = base mint, amount = 0, and owner/authority = profile PDA.
- CU: recorded `initialize_profile` at about 22.7k CUs in the current LiteSVM run.

## `set_capacity`

- Happy path: oracle authority sets cap and score tier on an active profile.
- Authorization: non-oracle signer fails; missing oracle signer fails.
- Invalid input: tier greater than 3 and not 255 fails.
- Sequence failure: closed/inactive profile fails once status handling exists.
- Account assertions: exact cap write and tier write; no other profile accounting changes.
- Event assertions: none expected.
- CU: record `set_capacity`.

## `initialize_investor`

- Happy path: wallet creates investor account.
- Authorization/reinit: second init for same wallet fails; PDA for another wallet fails.
- Account assertions: owner, zero position count, zero total deposited, created timestamp, bump.
- Event assertions: `InvestorInitialized`.
- CU: record `initialize_investor`.

## `deposit`

- Happy path, first branch: trader self-funds an empty vault; shares minted equals amount; trader shares increases; vault token receives amount.
- Happy path, later branch: investor deposits at non-par NAV; shares equal floor `amount * total_shares / total_assets`.
- Authorization/account binding: wrong investor account, wrong position PDA, wrong profile, wrong token owner, wrong mint, or wrong vault token fails.
- Invalid input: zero amount, amount greater than token balance, investor deposit before capacity, capacity exceeded, dust deposit, arithmetic overflow path.
- Conservation: depositor token decreases by amount, vault token increases by amount, total shares and position shares match.
- Event assertions: `Deposited` with `is_trader`, amount, shares, depositor, profile.
- CU: record `deposit:first` and `deposit:investor`.

## `request_withdraw`

- Happy path, instant: request value under 500 bps of AUM sets ready timestamp to current timestamp.
- Happy path, delayed: request value above threshold sets next daily settlement window.
- Authorization/account binding: non-owner signer fails; position from another profile fails.
- Invalid input: zero shares, shares greater than position shares, arithmetic overflow path.
- Account assertions: pending shares increment; ready timestamp exact; existing shares not burned yet.
- Event assertions: `WithdrawRequested`.
- CU: record `request_withdraw:instant` and `request_withdraw:delayed`.

## `process_withdraw`

- Happy path: after ready timestamp, burns pending shares and transfers floor asset value to owner token.
- Authorization/account binding: non-owner signer fails; wrong owner token authority fails; wrong profile/vault/mint fails.
- Sequence failure: no pending shares fails; processing before ready timestamp fails.
- Conservation: vault token decreases by payout, owner token increases by payout, profile total shares decreases, pending shares clears.
- Account lifecycle: if implementation closes zero-share positions, assert lamports zero, data empty, owner system program; otherwise assert zero-share retained state exactly as documented.
- Event assertions: `Withdrawn`.
- CU: record `process_withdraw`.

## `record_trade`

- Happy path, long gain: long with exit above entry transfers gain from treasury to vault and raises NAV.
- Happy path, short gain: short with exit below entry transfers gain from treasury to vault.
- Happy path, loss: long loss or short loss transfers from vault to treasury, floors at NAV-bearing assets, and never drains `trader_claimable`.
- Authorization: missing trader signer, missing oracle signer, non-oracle signer, or non-trader signer fails.
- Invalid input: invalid direction, zero entry price, zero exit price, zero size, closed timestamp before opened timestamp, leverage above max, notional above 20 percent AUM.
- Conservation: token deltas equal applied PnL; total shares unchanged.
- Event assertions: `TradeClosed` fields and realized PnL sign/magnitude.
- CU: record `record_trade:gain` and `record_trade:loss`.

## `settle`

- Happy path, no profit: current NAV at or below HWM updates `last_settle_ts`, emits no `Settled`, and moves no tokens.
- Happy path, profit: computes profit assets, trader cut, platform cut, updates claimable, transfers platform cut to treasury, resets HWM.
- Authorization: caller neither trader nor oracle authority fails.
- Invalid state: total shares zero fails.
- Conservation: platform cut vault-to-treasury transfer matches event; trader cut remains in vault but is excluded from NAV.
- Event assertions: `Settled` only on profit.
- CU: record `settle:no_profit` and `settle:profit`.

## `trader_withdraw_profit`

- Happy path: trader withdraws amount up to claimable to their own token account.
- Authorization/account binding: non-trader signer fails; destination token not owned by trader fails; wrong mint/vault fails.
- Invalid input: zero amount, amount greater than claimable, amount greater than vault token balance.
- Conservation: vault token and trader token deltas equal amount; `trader_claimable` decreases by amount; derived NAV remains unchanged.
- Event assertions: `ProfitWithdrawn`.
- CU: record `trader_withdraw_profit`.

## End-to-End Local Flow

- Initialize platform.
- Initialize trader profile.
- Initialize trader investor account.
- Trader self-funds.
- Set capacity.
- Initialize outside investor.
- Investor deposits.
- Record gain and loss trades.
- Settle profit.
- Trader withdraws profit.
- Investor requests and processes withdraw.
- Trader requests and processes own-capital withdraw.
- Assert no arbitrary recipient path, sole profile PDA vault authority, token conservation, and all final account values.

## Devnet Gate

Devnet begins only after the LiteSVM end-to-end flow is green. Devnet checks cover deployment, real wallet signing, indexer event decoding, frontend instruction construction from IDL, and treasury-funded simulated PnL.
