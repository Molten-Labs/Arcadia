---
name: Arcadia gap fixes
description: Summary of the 10 architecture gaps identified in the audit and how each was resolved for MVP devnet.
---

## Blockers fixed

**1. InvestorInitialized event missing**
Added `#[event] InvestorInitialized { investor, profile }` struct and `emit!()` call in `initialize_investor` handler (arcadia_vault/src/lib.rs).

**2. Deposit blocked by CapacityNotSet**
Removed the `require!(capacity_usd > 0, CapacityNotSet)` gate. The capacity ceiling is now enforced conditionally: `if profile.capacity_usd > 0 { require!(... <= capacity_usd) }`. When capacity == 0 the vault is uncapped; the API-level `deposits_open` flag is the gate.

**3. `set_capacity` oracle-push stub removed**
`oracle.rs` no longer imports arcadia_chain. Instead `update_capacity_in_db()` does a direct `UPDATE trader_profile SET capacity_cap_usd = $1, score_tier = $2, deposits_open = $3`. Score worker calls this after each run with `deposits_open = score >= 600`.

**4. SIWS auth not wired on frontend**
Created `app/lib/use-auth.ts` with the full challenge/sign/verify/localStorage flow. `AuthContext` + `AuthProvider` added in `providers.tsx`. `apiFetch` in `utils.ts` reads `localStorage.getItem("arcadia_jwt")` and attaches as `Authorization: Bearer`.

## Data gaps fixed

**5. TS schema missing fields**
`lib/db/src/schema/index.ts` updated:
- `investorPositions`: added `withdraw_ready_ts: timestamp` (nullable)  
- `tradeRecords`: renamed `leverage` → `leverage_x` to match Rust model and DB column
- Added `scoreSnapshots` table (mirrors Rust `DbScoreSnapshot`)

**6. Missing instruction builders**
`use-arcadia-vault.ts` now exports: `initializeProfile`, `initializeInvestor`, `processWithdraw`, `recordTrade` (in addition to the existing `deposit`, `requestWithdraw`, `withdrawProfit`).

## Minor fixes

**7. terminal/page.tsx TS error**
`const [interval, setInterval] = useState("1H")` shadowed the global `setInterval`. Renamed to `setChartInterval`.

**8. simulate route created**
`app/app/api/v1/trades/simulate/route.ts` — proxies to Rust backend when `BACKEND_URL` env is set; otherwise returns a mock response with `simulated: true` so the frontend skips the chain-tx branch.

## Decisions / known gaps for later

- **Yellowstone gRPC**: still a stub. Events ingested manually or via sim for MVP.
- **IDL not generated**: Anchor IDL not built yet; real instruction senders fall back to "program deployed — use Anchor IDL" message.
- **Next.js auth routes are dev mocks**: do not cryptographically verify Ed25519. When the Rust backend is wired, set `BACKEND_URL` and proxy auth calls to it.
- **API path naming**: kept `/v1/vaults/:profile/trades` and `/v1/investors/:wallet/portfolio` (what frontend already calls); did not rename to spec's `/v1/traders/:profile/trades`.
