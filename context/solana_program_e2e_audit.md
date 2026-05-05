# Arcadia Solana E2E Audit

Date: 2026-05-05

Scope: pulled `origin/main` first, built a fresh SBF artifact, ran deterministic LiteSVM lifecycle tests, audited web/mobile transaction wiring, and compared behavior against `context/arc_v2.md`, the Pinocchio/safe-Solana references, and the repo security checklist.

## Findings

### P1: Web NAV update uses the SOL-only lamport path while capital buttons use USDC

Refs:
- `app/src/hooks/useTransactions.ts:188`
- `app/src/hooks/useTransactions.ts:218`
- `app/src/hooks/useTransactions.ts:249`
- `app/src/hooks/useTransactions.ts:311`
- `Arcadia_program/program/src/instructions/update_nav.rs:48`
- `Arcadia_program/program/src/instructions/update_nav.rs:136`

The architecture file currently describes a SOL-only MVP with Pyth and SPL USDC deferred. The web transaction builders, however, use USDC token accounts for junior deposits, senior deposits, senior withdrawals, and junior withdrawals. The same hook still builds `updateNav` with the 6-account lamport path and passes `SystemProgram.programId` as a price placeholder. The program has a 9-account USDC/WSOL/Pyth NAV path, but the UI does not call it.

Impact: a manager can use the web app to move USDC/token custody, then press "Update NAV" and update the lamport model instead of valuing the actual vault token balances. That breaks frontend/program parity for NAV, waterfall, graduation status, and fee accounting in the intended USDC product.

Fix guidance: choose one canonical branch. If the MVP remains SOL-only, remove or hide USDC capital actions from the web app and generated clients. If the product has moved to SPL custody, change the frontend `updateNav` builder to pass vault USDC, vault WSOL, configured SOL and USDC price accounts, and clock, then add a LiteSVM token fixture that proves NAV follows token balances instead of treasury lamports.

### P2: `/trade` remains client-only simulation by design

Refs:
- `app/src/pages/Trade.tsx:228`
- `app/src/pages/Trade.tsx:236`
- `app/src/pages/Trade.tsx:343`
- `app/src/hooks/useTransactions.ts:399`
- `app/src/pages/Trade.test.tsx:48`

The trade screen now labels the path as a guarded quote simulation. It still only runs local state changes and a timeout. It does not call the Rust backend Jupiter proxy and does not call `executeJupiterSwap`, even though an extended transaction builder exists in `useTransactions`.

Impact: this is acceptable for a simulator, but it does not prove real Jupiter execution or indexing.

Fix guidance: wire it through the server-rs quote/swap-instructions routes and `executeJupiterSwap` with the validated route accounts, token accounts, oracle accounts, minimum-out, quote expiry, and slippage before calling it execution.

### P1: Extended Jupiter CPI and full USDC custody lifecycle are not yet proven locally

Refs:
- `Arcadia_program/program/src/instructions/execute_swap.rs:200`
- `Arcadia_program/program/src/instructions/execute_swap.rs:288`
- `Arcadia_program/program/src/instructions/execute_swap.rs:319`
- `Arcadia_program/program/src/instructions/execute_swap.rs:230`
- `Arcadia_program/program/src/instructions/custody.rs:97`
- `app/src/hooks/useTransactions.ts:399`

The program has extended Jupiter validation for manager, Jupiter program ID, token program, writable source/destination accounts, oracle accounts, slippage, quote expiry, source balance delta, destination balance delta, and synthetic oracle account ownership. The local E2E suite does not yet include a mock Jupiter program plus SPL token custody fixtures to prove CPI success, minimum-out behavior, route constraints, source-delta failures, oracle failures, and post-swap accounting.

Impact: guard-only devnet swaps are tested and no longer count fake paper trades, but the real swap path remains unproven in deterministic tests. The new source-delta and oracle-owner checks reduce the immediate risk, but the Jupiter path still needs a local CPI fixture before being treated as demo-safe.

Fix guidance: add a mock Jupiter program to `kiln-tests`, mint vault USDC/WSOL token accounts, simulate CPI token movement, assert minimum-out, source-delta, destination-delta, route, slippage, and oracle-owner/feed-key failures, and then let only successful CPI trades increment paper-mode qualifying trade count.

### P1: server-rs indexer tests use normalized Kiln-shaped payloads, not raw Helius program activity

Refs:
- `server-rs/src/main.rs:912`
- `server-rs/src/main.rs:953`
- `server-rs/src/main.rs:1726`

server-rs stores raw events and materializes useful read models, but its parser looks for already-normalized `manager`, `vault`, `position`, `trade`, `navPoint`, and `statusEvent` nodes. The Helius wrapper test injects a custom `events.kiln` shape. It does not prove that raw Helius enhanced transaction payloads for the Arcadia program are decoded into those materialized nodes.

Impact: the backend can pass local tests while live devnet webhooks fail to populate frontend read APIs unless an external normalizer produces the expected shape.

Fix guidance: add fixtures captured from real Helius devnet payloads for each instruction, parse program logs/instruction data into the canonical materialized event schema, and keep the current normalized schema as an internal representation rather than the assumed webhook input.

### P1: Generated clients are stale/incomplete versus current product flows

Refs:
- `clients/src/generated/instructions/index.ts:9`
- `clients/src/generated/instructions/updateNav.ts:107`
- `package.json:17`

The generated SDK exports only `createVault`, `depositJunior`, `graduateVault`, `initManager`, and legacy `updateNav`. It has no senior deposit/withdraw, junior withdraw, swap/Jupiter, claim-fees, or USDC/WSOL/Pyth NAV builder. Root codegen paths are now pointed at the active Arcadia/client locations, but the IDL/client contents remain incomplete.

Impact: consumers of `clients` will be behind the app and program, and regeneration can target the wrong source tree.

Fix guidance: regenerate IDL/clients from the active program once Shank metadata covers every public instruction, and add generated-client tests for every public instruction used by the web app.

### P2: Web senior withdrawal lacks the optional WSOL unwind path

Refs:
- `app/src/hooks/useTransactions.ts:249`
- `app/src/hooks/useTransactions.ts:263`

The web `withdrawSenior` builder sends only the fixed liquid-USDC accounts and 8-byte amount. The program supports an optional unwind branch that requires additional minimum-out, expiry, Jupiter data, and remaining Jupiter accounts when the vault has enough NAV but not enough liquid USDC.

Impact: an investor can have a valid claim while the web withdrawal path fails because the UI cannot unwind WSOL into USDC.

Fix guidance: either disable non-USDC inventory before withdrawals in the MVP, or add a backend-quoted unwind builder that supplies the optional accounts and explicit slippage/minimum-out constraints.

### P2: Fee crystallization still needs a final product model

Refs:
- `Arcadia_program/program/src/instructions/claim_fees.rs:88`
- `Arcadia_program/program/src/instructions/claim_fees.rs:91`
- `Arcadia_program/program/src/instructions/execute_swap.rs:379`

The current fee path no longer transfers vault assets out to the manager, which protects investor capital better than the old cash-withdrawal design. `claim_fees` can crystallize fees and the SOL lifecycle can now close out remaining NAV after senior exits, but `arc_v2.md` describes manager performance fees as junior-share economics. There is still no explicit per-manager share ledger, protocol reserve ledger, or fee-recipient account.

Impact: this is safer than draining cash and no longer strands SOL in the tested full lifecycle, but the business-model payout path remains under-specified.

Fix guidance: decide the final fee model. If fees are manager-owned junior shares, implement explicit share mint/accounting. If fees are protocol reserve, document it and expose/report reserve balances separately.

### P2: Mobile deposit/withdraw remains mock-only

Refs:
- `mobile/src/lib/wallet.tsx:16`
- `mobile/src/lib/wallet.tsx:28`
- `mobile/app/vault/[id].tsx:59`
- `mobile/app/vault/[id].tsx:67`
- `mobile/src/lib/api.ts:30`
- `mobile/src/hooks/useManagers.ts:29`
- `mobile/src/hooks/useManagers.ts:33`
- `mobile/app/(tabs)/settings.tsx:43`
- `mobile/app/(tabs)/settings.tsx:72`

The mobile wallet provider generates a mock pubkey locally, and the vault deposit/withdraw handler only waits on a timeout before showing demo copy. Manager detail fetches can use the API manager record but then always attach vaults from `MOCK_VAULTS`, so live manager pages can show stale/mock vault lists. Settings copy still says "Connect to sign transactions" and trader-role copy says traders can run trades and graduate. There is no Solana wallet adapter, no transaction builder, and no backend submission path.

Impact: mobile screens are useful for product preview, but they do not prove on-chain settlement and should not be represented as production deposit/withdraw flows. Mobile read state can also diverge from server-rs even when the API is reachable.

Fix guidance: add Solana Mobile Wallet Adapter or an explicit mobile wallet strategy, reuse the web transaction builders or a shared client package, wire manager vaults from backend/API data, and keep demo-only copy until real signatures are wired.

### P2: Duplicate/stale program and codegen paths can drift

Refs:
- `Arcadia_program/Cargo.toml:1`
- `package.json:17`
- `package.json:18`

The active workspace is `Arcadia_program/program` plus `Arcadia_program/kiln-tests`, but root codegen scripts still point at `Kiln_program/program/src/lib.rs` and `clients/ts/kiln`. The repo also contains legacy/duplicate program source under `Arcadia_program/src`, outside the active Cargo workspace.

Impact: future audits, generated IDLs, or client regeneration can accidentally target stale Kiln paths instead of the active Arcadia program.

Fix guidance: update root codegen scripts to the active Arcadia paths, remove or clearly quarantine duplicate source, and fail CI if generated clients come from a non-workspace program path.

## What Works End To End Today

- Fresh SBF builds from `Arcadia_program/program`, and the LiteSVM freshness guard now scans `Arcadia_program/program/src/**` through the shared test helper.
- LiteSVM proves manager profile initialization, one-vault MVP enforcement, vault creation, junior funding, guarded no-op swap submission, graduation precondition failures, non-manager graduation once conditions are met, fee crystallization, senior deposit after graduation, cooldown enforcement, full senior exit, and final manager junior/NAV exit on the SOL path.
- Guard-only `execute_swap` rejects nonzero `minimum_amount_out` and does not count no-op paper trades.
- Extended Jupiter swap now rejects source-token spending above the guarded input amount and requires synthetic price accounts to be program-owned.
- Graduation rejects a wrong manager profile/config relationship.
- Web `/manager/create` is tested from button click to `initManager -> createVault -> depositJunior` with USDC unit conversion.
- Web `/manager/vault/:id` buttons call the expected transaction hooks for junior deposit/withdraw, NAV update, graduation, guard swap, and fee claim.
- Web `/vault/:id` investor deposit/withdraw buttons call the expected senior deposit/withdraw hooks.
- server-rs tests pass for the canonical backend's current normalized-payload behavior.
- server-rs has devnet guard tests for both `/jupiter/quote` and `/jupiter/swap-instructions`.
- `clients` build and tests pass.

## Coverage Gaps

- No live devnet replay against Helius webhooks was run in this local audit.
- No mock Jupiter CPI/SPL-token LiteSVM fixture yet proves the real swap path.
- The USDC/token custody lifecycle is partially builder-audited but not yet fully proven in LiteSVM from initial mint through final investor withdrawal.
- Raw Helius enhanced payload decoding into materialized Arcadia events remains unproven.
- `/jupiter/swap-instructions` still needs mocked mainnet upstream success/error tests.
- Mobile has no test/typecheck/build script in `mobile/package.json`; only static wiring was audited.
- SBF build succeeds but still emits cargo-build-sbf syscall warnings and the crate naming warning for `Kiln_program`.

## Commands Run

Passed:

```bash
git pull --ff-only origin main
cargo build-sbf --manifest-path Arcadia_program/program/Cargo.toml --sbf-out-dir /tmp/arcadia-sbf-e2e -- --target-dir /tmp/arcadia-sbf-target
KILN_SBF_PATH=/tmp/arcadia-sbf-e2e/Kiln_program.so cargo test --manifest-path Arcadia_program/kiln-tests/Cargo.toml
cargo test --manifest-path Arcadia_program/program/Cargo.toml --features test-default
cargo test --manifest-path server-rs/Cargo.toml
pnpm --dir app test
pnpm --dir app build
pnpm --dir clients build
pnpm --dir clients test -- --run
```

Targeted web tests also passed:

```bash
pnpm --dir app exec vitest run src/pages/CreateVault.test.tsx src/pages/VaultDetail.test.tsx src/pages/Trade.test.tsx
```

## Senior Engineer Verdict

The SOL-only MVP path now reaches full deterministic withdrawal in LiteSVM. The remaining serious gap is product parity: the current `arc_v2.md` says SOL-only MVP, while the web app and parts of the program already expose USDC/SPL and Jupiter-shaped flows. Pick one branch as canonical for the demo UI. If the demo is SOL-only, hide the USDC/Jupiter controls. If the demo is SPL/Jupiter, prove that branch with deterministic LiteSVM token/Jupiter fixtures before claiming real trading or token settlement.
