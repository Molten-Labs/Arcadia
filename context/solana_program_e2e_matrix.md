# Arcadia E2E Action Matrix

Date: 2026-05-05

Legend:
- On-chain: builds and submits an Arcadia program instruction.
- Backend guarded: calls server-rs or a route designed to guard/proxy external infrastructure.
- Read-only: reads indexed/API/RPC/mock state only.
- Client-only: local UI simulation, no signature or transaction.
- Gap: needs implementation or stronger test proof.

## Web App

| Surface | User action | Code path | Status | Current proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Wallet shell | Connect wallet | `app/src/lib/wallet` plus wallet adapter usage | On-chain prerequisite | Transaction hooks throw if `publicKey` is missing | Route access is role/UI gated in places, but settlement is gated by wallet checks in hooks. |
| `/manager/create` | Create & fund vault | `CreateVault.handleCreate` -> `initManager` -> `createVault` -> `depositJunior` | On-chain | `app/src/pages/CreateVault.test.tsx` | Uses USDC units and derives config from manager profile vault count. |
| `/manager/vault/:id` | Deposit junior | `ManagerVault.handleDepositJunior` -> `depositJunior` | On-chain | Existing app tests plus transaction builder audit | Uses USDC token custody builder. |
| `/manager/vault/:id` | Withdraw junior | `ManagerVault.handleWithdrawJunior` -> `withdrawJunior` | On-chain | Existing app tests plus transaction builder audit | Web builder uses USDC path. SOL program path now completes in LiteSVM after senior exits. |
| `/manager/vault/:id` | Update NAV | `ManagerVault.handleUpdateNav` -> `updateNav` | On-chain, parity gap | Button is wired, but builder audit found wrong asset path | Frontend sends the 6-account lamport path, not the 9-account USDC/WSOL/Pyth path. |
| `/manager/vault/:id` | Graduate vault | `ManagerVault.handleGraduateVault` -> `graduateVault` | On-chain | LiteSVM full lifecycle and profile-mismatch tests | Non-manager caller graduation succeeds when preconditions are valid. |
| `/manager/vault/:id` | Guard swap | `ManagerVault.handleGuardedSwap` -> `executeSwap` | On-chain guard-only | LiteSVM full lifecycle test | Devnet guard-only instruction does not count fake paper trades. |
| `/manager/vault/:id` | Real/mainnet Jupiter swap | `realJupiterEnabled` branch | Gap | Static audit | The UI only toasts "Use the Jupiter quote flow" and does not route into an implemented quote/execution flow. |
| `/manager/vault/:id` | Claim fees | `ManagerVault.handleClaimFees` -> `claimFees` | On-chain | LiteSVM full lifecycle test | Safer than cash drain, but fee economics still drift from `arc_v2.md` junior-share wording. |
| `/vault/:id` | Investor deposit | `VaultDetail.handleDeposit` -> `depositSenior` | On-chain | `app/src/pages/VaultDetail.test.tsx` plus LiteSVM senior deposit | UI blocks before graduation. USDC builder exists; LiteSVM test currently proves SOL senior deposit. |
| `/vault/:id` | Investor withdraw | `VaultDetail.handleWithdraw` -> `withdrawSenior` | On-chain, partial | Builder audited; LiteSVM proves cooldown and SOL failure after cooldown | USDC withdrawal builder exists, but it only covers liquid USDC and cannot supply the optional WSOL unwind/Jupiter accounts. |
| `/trade` | Simulate guarded quote | Local `Trade.execute` timeout | Client-only | `app/src/pages/Trade.test.tsx` | Labeled as simulation; does not call server-rs Jupiter routes or `executeJupiterSwap`. |
| `/vaults` | Browse vaults | API/read hooks | Read-only | App tests pass | Reads indexed/API data with local resilience fallback. |
| `/traders` and `/trader/:wallet` | Browse managers/traders | API/read hooks | Read-only | App tests pass | No transaction claims. |
| `/portfolio` | View positions | API/read hooks | Read-only | App tests pass | Position settlement depends on underlying deposit/withdraw builders. |
| `/alerts` | View/manage alerts | UI/API state | Read-only/client state | App tests pass | No program transaction claim found. |
| `/settings` | User preferences | UI/local state | Client-only | App tests pass | No program transaction claim found. |
| `/docs`, `/faq`, `404` | Informational pages | Static routes | Read-only | App build pass | No transaction claim. |

## Backend And Jupiter

| Surface | User action | Code path | Status | Current proof | Notes |
| --- | --- | --- | --- | --- | --- |
| server-rs `/health` | Health check | Rust backend | Backend guarded | `cargo test --manifest-path server-rs/Cargo.toml` | Canonical backend is server-rs. |
| server-rs read routes | Vaults, managers, positions, histories | Rust backend/indexer | Read-only/backend | server-rs tests pass | Local live Helius webhook replay was not run. |
| server-rs `/webhook` materialization | Helius event ingestion | Rust backend/indexer | Backend guarded, partial | Tests pass with normalized `events.kiln` fixture | Raw Helius enhanced transaction payload decoding into Arcadia events remains unproven. |
| server-rs `/jupiter/quote` | Quote request | Rust Jupiter proxy | Backend guarded | server-rs tests pass | Real Jupiter remains mainnet-only by guard. |
| server-rs `/jupiter/swap-instructions` | Swap-instruction request | Rust Jupiter proxy | Backend guarded | Devnet guard route test | Web `/trade` is not yet wired to consume this route. |
| Generated clients | Program SDK instructions | `clients/src/generated` | Stale/incomplete | Static audit | Exports only init/create/depositJunior/graduate/updateNav and legacy 6-account NAV. |

## Program Lifecycle

| Step | Instruction | Status | Current proof | Notes |
| --- | --- | --- | --- | --- |
| Trader onboarding | `init_manager` | Working | LiteSVM full lifecycle | Signer/PDA relationship covered. |
| Vault creation | `create_vault` | Working | LiteSVM full lifecycle | Fixed-size args and PDA relationship covered. |
| Junior seed capital | `deposit_junior` | Working in tested path | LiteSVM SOL plus web USDC builder test | `arc_v2.md` says SOL-only MVP; app currently exposes USDC builders. |
| Paper trading | guard-only `execute_swap` | Working as guard-only | LiteSVM full lifecycle | No fake paper trade count. Real Jupiter CPI remains unproven. |
| Real Jupiter trading | extended `execute_swap` | Gap | Static audit | Source-delta and synthetic oracle owner checks are now present; mock CPI tests are still needed. |
| Graduation locks | `graduate_vault` | Working | LiteSVM full lifecycle | Fails before preconditions and with wrong profile relationship; succeeds from non-manager caller. |
| Investor deposit | `deposit_senior` | Working in tested path | LiteSVM SOL plus web USDC builder test | USDC custody fixture still needed if product keeps SPL path. |
| Investor withdraw | `withdraw_senior` | Working in SOL path, partial in USDC path | LiteSVM proves cooldown and full SOL senior exit | USDC path still needs token custody fixture proof. |
| Manager withdraw | `withdraw_junior` | Working in SOL path, partial in USDC path | LiteSVM proves final manager NAV exit after senior exit | USDC path still needs token custody fixture proof. |
| NAV update | `update_nav` | Partial | Program tests pass; builder audit found UI parity gap | Program has USDC/WSOL path, but web uses legacy lamports. |
| Fee claim | `claim_fees` | Working mechanically, economics open | LiteSVM full lifecycle | Assets stay in vault, but fee ownership model needs product decision. |
| One-vault MVP rule | `create_vault` | Working | LiteSVM vault-flow test | Program rejects a second vault for the same manager. |

## Mobile

| Surface | User action | Code path | Status | Current proof | Notes |
| --- | --- | --- | --- | --- | --- |
| Mobile wallet | Connect | `mobile/src/lib/wallet.tsx` | Client-only | Static audit | Generates mock pubkey. |
| Mobile vault | Deposit | `mobile/app/vault/[id].tsx` | Client-only | Static audit | Timeout plus demo alert, no transaction. |
| Mobile vault | Withdraw | `mobile/app/vault/[id].tsx` | Client-only | Static audit | Timeout plus demo alert, no transaction. |
| Mobile manager detail | Manager vault list | `mobile/src/hooks/useManagers.ts` | Read-only, mock-data gap | Static audit | API manager data is mixed with `MOCK_VAULTS`, so live backend vault lists can be stale. |
| Mobile settings/role copy | Wallet and trader role text | `mobile/app/(tabs)/settings.tsx` | Client-only, copy gap | Static audit | Copy implies signing/trading/graduation despite mock wallet. |
| Mobile package | Typecheck/build/test | `mobile/package.json` | Gap | Static audit | Package defines only `start`, `android`, `ios`, and `web`. |

## End-To-End Status

Current deterministic status: SOL path complete; SPL/Jupiter path partial.

The local lifecycle proves trader onboarding through post-graduation senior deposit, withdrawal cooldown enforcement, full investor senior exit, and final manager junior/NAV exit on the SOL path. The next complete E2E target should pick one canonical UI branch: either make the frontend SOL-only for MVP, or fully prove the USDC/SPL path with Pyth NAV and mock Jupiter CPI.
