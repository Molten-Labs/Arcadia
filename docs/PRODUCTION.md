# Arcadia — Production Readiness Spec

Single source of truth for what must be true before Arcadia holds real investor capital.
Grounds every claim in current code; distinguishes **what is real today**, **what is stubbed**,
and **what must change** to be production-ready. Companion docs: `scoring-engine.md`,
`capacity-model.md`, `REDESIGN.md` (frontend), `execution-wallet-architecture`.

Scope note: "production-ready" here means the *logic* is sound and the wiring actually runs —
not "feature-complete." Several subsystems are intentionally out of scope of this round.

---

## 0. Trust model (read first)

Arcadia's entire security story is: **the Score is the trust root; the oracle carries it on-chain;
the vault enforces it.** Every production decision below follows from that chain.

```
Scoring engine (off-chain, pure)  →  oracle (signs score_tier + facts)  →  contract (band lookup + risk guards)
```

Current reality (from code):

| link | status |
|------|--------|
| Score formula `Q × C × G` | real, pure, tested (`crates/scoring/`) |
| Score inputs (equity curve, trades) | **broken** — `equity_point` is never written; worker silently skips all profiles |
| Wash detector | **dead code** — not consumed by the Score |
| Oracle → contract push | **stub** — `arcadia-chain` returns `STUB_SET_CAP_*`, `confirmed:false`; `solana` feature disabled |
| Contract band lookup | not built (current `set_capacity` writes a free-form `cap_usd`) |
| Contract risk guards (notional, leverage) | real, tested |

**Consequence:** today, capacity lives entirely in the DB (stake × multiplier) and never reaches
the chain. A production deployment therefore has two independent workstreams that must land
together: (A) make the Score trustworthy, (B) wire the trustworthy Score to the contract.

---

## 1. Scoring engine — the trust root

### 1.1 What exists (`server-rs/crates/scoring/`)

`Score = clamp(Q × C × G, 0, 1000)`, floored at 100 for the snapshot.

- **Q (Quality)** — weighted normalized metrics: Sharpe 25%, Sortino 20%, MaxDD 15%, Calmar 15%,
  Volatility 10%, DownsideDev 10%, MeanReturn 5%. Each normalizer maps to 0–100.
- **C (Confidence)** — logistic in trade count: `1/(1+exp(−(n−200)/125))`. **No calendar-time term.**
- **G (Guard)** — `min(g_liq, g_dd)`: linear decay below 1.0 once liquidation rate > 5% or max
  drawdown > 30%. **No wash term.**
- **Tier** (`capacity.rs`): score → `{tier_u8, multiplier}`; USD = `trader_shares × multiplier`
  (the Stake × Multiplier model being replaced).

### 1.2 Production design

**a) Anti-wash must become an input to G (currently dead code).**
`crates/core/src/classify.rs` computes a `WashVerdict` but nothing in `crates/scoring/` reads it.
Wire it as a multiplicative guard, clean trader = 1.0. Keep it multiplicative, not a flat
point subtraction (a flat `-20` distorts the Q weighting). Severe/repeated wash crosses a hard
gate → `score_tier = NOT_FUNDABLE_TIER` (255) → unfundable until clean history accumulates.

**b) Strengthen the detector before trusting it.** Only W1 (volume>$1M, net PnL <0.1% of volume)
and W4 (net/gross exposure <2%, volume>$100k) exist; `total: 4` is aspirational. Add, based on
industry patterns (Chainalysis 2025, Victor & Weintraud 2021, academic Benford's-law work):
- **W2 (implement; stub exists):** matched buy+sell in a short window (e.g. ≤5 min) with <1%
  volume difference, repeated ≥3× — the canonical "self-dealing" signature.
- **W3 (new):** volume concentrated in low-liquidity windows + burst aligned to scoring epochs
  (points-farming reflexivity).
- **Entity clustering:** shared funding source / same-origin wallet / synchronized timing across
  addresses (sybil/wash collusion). Needs the data layer to expose funding sources.
- **Benford's-law deviation** on trade sizes (cheap, high-signal for machine-generated round
  orders — but exclude obvious market makers via the net/gross + flip-rate signals).

**c) Track-record duration → C.** Reaching a top tier must require *spread-out calendar time*,
not brute-forced trade count. Fold a months-active term into Confidence (this is the "ramp
lives in the Score" decision — see `capacity-model.md`). This is the anti-farm gate, so the
contract stays a plain band lookup.

**d) False-positive protection.** `NOT_FUNDABLE_TIER` is reputation-destroying; legit HFT /
market makers trip W1/W4-style signals. Requirements before the hard gate fires: ≥2 independent
signals AND an appeals/reevaluation path (a human re-runs on fresh data; off-chain, no on-chain
reputation write). Prefer "cap max achievable tier" for borderline cases over the hard gate.

**e) Liveness / staleness.** A Score that isn't refreshed is a stale trust signal. If no fresh
snapshot for N days (worker down, data gap), capacity should *decay* — e.g. oracle writes a
`not_fundable` when snapshot age exceeds max-age. On the upside, a *delayed* promotion (see §3)
already bounds damage from a corrupted score.

**f) Data path.** `equity_point` is now seeded by the score worker from `flow`+`trade` via
`derive_equity_curve` (curve.len() < 2 no longer starves scoring), and the ingest worker is real
(JSON-RPC poller in `workers/ingest.rs`, cursor-advanced, idempotent `(signature, event_index)`).
Remaining: automated ledger↔DB reconciliation and the chain→oracle push.

---

## 2. Capacity model

Design is settled in `docs/capacity-model.md`. The contract must be a deterministic lookup:

```
effective_cap = if score_tier == NOT_FUNDABLE_TIER { 0 } else { TIER_BAND_USD[score_tier] }
```

| tier | band |
|:----:|:----:|
| 0 | $25k |
| 1 | $100k |
| 2 | $250k |
| 3 | $500k |
| 4 | $1M |
| 255 | 0 |

Semantics to hold invariant:
- Ceiling = **investor** AUM: `deposit` checks `nav_bearing_assets(total, trader_claimable) + amount ≤ cap`.
  Already true in `deposit.rs`; keep it.
- Trader co-invest counts against the cap; the trader's *profit claim* does not.
- No admin-set USD. No on-chain ramp. The time gate lives in the Score (§1c).

**Production caveat (owner decision recorded in capacity-model.md):** prop-firm research
uniformly ties capital increases to *sustained performance* (FTMO-style scaling plans: "25%
increase after 4 profitable months"). We moved that gate into the Score instead of the chain to
avoid double-penalizing traders. That is defensible *only if* the Score's duration term and wash
guard actually land (§1). The one residual risk that neither covers is AUM-jump shock: a trader
who earned their Score on $50k of own capital is promoted to a $1M band in one oracle write. The
per-trade notional cap (20% of AUM, §4) is the backstop. Do not add a second ramp on-chain.

---

## 3. Oracle & on-chain trust

### 3.1 Current
`PlatformConfig.oracle_authority` (single key) gates `set_capacity`, `record_trade`, `settle`.
`arcadia-chain::push_set_capacity` is a stub; `solana`/`grpc` features disabled; the keypairs are
loaded from `/run/secrets/*.json`.

### 3.2 Production design (oracle trust — the single most important upgrade)

Apply the layered oracle-defense pattern from the DF3NDR/MakerDAO literature:

1. **Signed attestation payload, not raw tier.** Oracle signs a structured payload:
   `{ profile, score, score_tier, snapshot_ts, sequence }`. Include a **monotonic sequence** per
   profile and a **signature expiry** (`valid_until`). The contract:
   - verifies `oracle_authority` signature,
   - rejects out-of-order sequence (anti-replay),
   - rejects expired payloads (anti-stale).
   This turns "the oracle is honest" into "the oracle is honest *and current*."
2. **Delayed promotions, immediate demotions (MakerDAO OSM pattern).** An *upgrade* in
   `score_tier` only takes effect after a delay (e.g. 1 hour) — gives time to react to a
   corrupted score before it opens capital. A *downgrade* or `NOT_FUNDABLE_TIER` takes effect
   immediately — safety must never wait.
3. **Bounds + sanity layer.** Contract rejects implausible jumps: a tier can only move one step
   per update unless `NOT_FUNDABLE_TIER`; capacity change bounded by a max-Δ. Cheap, catches
   integration bugs, limits blast radius of a bad payload.
4. **Circuit breaker.** A `pause_deposits` authority (or admin-only) flag that halts new deposits
   while a score-corruption event is investigated. Document the un-pause procedure and who holds
   it (guardian multisig). Prefer halting inflows over a global shutdown.
5. **Key custody.** oracle/admin/processor keypairs in HSMs/KMS, rotated on a schedule, never in
   `.env`. This is infrastructure, but it's the actual trust root for §1 and §3.

**Not in scope (accepted for now, document it):** M-of-N threshold attestation. Single-key oracle
is acceptable for devnet/early mainnet with the delay+breaker above; a full committee is the
post-liquidity upgrade. Explicitly written into the risk register.

---

## 4. Vault economics & risk guards (contract)

Current, all real and tested:
- **Fees:** perf 5% platform + trader share `tier_bps` (20%→40%); `mgmt_fee_bps` stored but **no
  instruction charges it** (`management_fee()` is dead). Decide: implement management fee or
  delete the field. A stored-but-unenforced fee is a liability.
- **Notional:** per-trade notional ≤ 20% of AUM (`MAX_NOTIONAL_BPS`), enforced in `record_trade`.
- **Leverage:** profile `max_leverage` (1–50×), ceiling 50. **Tier also drives `tier_bps` (20–40×
  leverage on OPM).** This couples "how much capital" with "how risky per dollar." Production:
  decouple — OPM leverage should be a governance-set constant (e.g. hard 10× ceiling on investor
  funds) independent of trader profit-share tier. A trader's own-risk appetite is their business;
  the vault's leverage on *other people's money* is the protocol's.
- **Drawdown:** only affects the Score (G) and the (future) bond. There is **no on-chain max
  drawdown halt.** Production: add a `hwm_guard` — if NAV breaches a hard % below `hwm_per_share`,
  halt new deposits (breaker) until oracle re-scores. This is the prop-firm "drawdown limit"
  analogue and should be enforced at the equity level, not balance level.
- **Withdraw liquidity:** request → instant if <5% of AUM, else next-daily settlement window
  (`withdrawal_ready_ts`). Processor sweeps ≤50 ready requests / 30s. Sound; the ≤50/30s batch is
  a throughput ceiling to size for real demand. `InsufficientVaultLiquidity` guard exists.
- **Settle:** only high-water-mark performance fee; correct high-water-mark logic tested. Note:
  `record_trade` moves PnL vault↔treasury but does **not** update `trader_claimable`/HWM — that's
  deferred to `settle`. Confirm the cadence keeps `trader_claimable` from ever exceeding NAV
  (it is excluded from NAV, and withdrawal_ready uses it — a stale claimable inflates the instant
  window). Add an invariant test: claimable ≤ vault NAV at all times.

### Bond & slashing (revised from capacity-model.md)

The bond (`trader_shares`) must be at risk — but for **integrity violations, not performance**.
A −30% drawdown is risk; investors already absorb it via NAV, and a good trader can hit −30% in a
crash. Slashing on drawdown punishes bad luck. Production design:
- **Slash trigger = misconduct only:** wash hard gate (§1b), vanished/ghost vault (no activity +
  no communication beyond a timeout), rule violations (e.g. exceeding enforced risk params).
- **Mechanism (first cut):** convert a % of `trader_shares` to base and sweep to treasury. Must
  be specified end-to-end before shipping — how the conversion interacts with share pricing, and
  how it affects `trader_claimable` and the withdrawal queue. Do not ship half-specified.

---

## 5. Wash / sybil / manipulation detection

See §1b. Operational requirements on top of the signals:
- Distinguish wash from **market making / HFT** (inventory risk, spread management) or the hard
  gate will eat legitimate traders. Net/gross + flip-rate + hours-active must cross-check.
- Align reward incentives: points/leaderboard programs create wash *incentives*. If the product
  rewards volume or score velocity, expect wash to follow the incentive. Detect at reward epochs.
- Keep detection off-chain; only the *verdict* (guard factor / tier) goes on-chain. The verdict
  must be replayable from the same data (deterministic) so a rejected trader can verify.

---

## 6. Execution layer

- `fund_execution` (contract) is real and tested (vault → execution-wallet ATA).
- `executor` orchestrator is a **TODO** (`orchestrator.rs:60` "full trade lifecycle"): wallet
  decrypt, sidecar open, WS monitor, close, sweep, record — all commented out. `execution-worker`
  (Node/Express sidecar, port 3001) implements open/close/snapshot against FlashTrade and is the
  live path today.
- Production gaps: no auth on the sidecar (open on a network port); seeds encrypted with
  `aes-gcm`/`pbkdf2` but the derive path is dead; no nonce/slippage guard on close; no
  reconciliation between sidecar position snapshots and the `trade` table.
- Decision needed: is the FlashTrade sidecar the production execution path, or a devnet-only
  stub until a proper broker/liquid provider is integrated? The doc assumes the latter; flag if
  wrong.

---

## 7. Backend / DB hygiene (real bugs that block production)

- **`equity_point` seeding** — DONE: worker seeds from `flow`+`trade` (§1f); curve no longer starves.
- **`/v1/events` `"frontend"` signature collision** — DONE: `EXECUTION_ONLY` 403s the public write path; ingest writes real `(signature, event_index)`.
- **`sim:` deterministic collisions / live-table pollution** — DONE: simulate 403'd in production; only ingest writes `trade`.
- **`deposits_open` hardcoded `true`** for everyone (`oracle.rs` doc claims `score >= 600` gate;
  code always `true`). Reconcile.
- **Dead code:** `verification_tokens`, `update_trader_scores`, `get_flows_for_profile(_paginated)`,
  `toggle_deposits_open`, `twr::build_curve`/`ScoringInput::run`, `executor` wallet/vault/flash_ws
  modules. Either wire or delete; dead code misleads audits.
- **`classify` Dormant bug:** `days_since_last` uses `sample_span_days` as if it were a timestamp,
  so every multi-trade trader reads ~20,000 days dormant. The classifier's `profile` label is
  wrong today; fix before it feeds any score signal.
- **`init_trader` sets `profile = wallet`** (PDA doubles as wallet) — dev shortcut; confirm it's
  intended and documented before mainnet.
- **No auth middleware**, handlers self-authenticate; acceptable but keep `x-admin-key`
  constant-time compare and add rate limiting (currently none on public routes).

---

## 8. Contract hardening (Anchor)

Strong existing base: `overflow-checks=true`, `TokenConservationFailed` invariants after every
transfer, PDA-authority vault token, 65 LiteSVM tests incl. CU summaries. Gaps:
- **`initialize_platform` is unauthenticated** — first caller wins. For mainnet, deploy via a
  deterministic one-time setup (admin key signed into `PlatformConfig` at deploy) or require
  `admin` to match a deployer key.
- **No `ts`/version on `PlatformConfig`/profile**; no `last_set_capacity_ts` — impossible to
  enforce staleness/delay (§3) without a timestamp. Add them.
- **Capacity is stored, not derived** today (`capacity_cap_usd` field). The redesign makes it a
  lookup (§2) — decide whether the field stays as a cache written by `set_capacity` (keep for
  `deposit` reads) with the pure function as the source, or is removed and computed inline.
- **`set_capacity` emits no event** — auditors and indexers can't trace capacity changes. Add
  `CapacityUpdated { profile, prev, next, score_tier, seq }`.
- **No pause/circuit-breaker** on deposits (§3.4).
- `record_trade` requires trader + oracle + treasury-authority all to sign — a strong anti-fraud
  property; keep it (the oracle co-sign is exactly the "score corroborates every trade" guard).
- Migrations/upgrades: Anchor program is upgradeable (BPF loader) — plan an
  authority+timelock upgrade path, and keep `deploy-program.sh` + the hand-written frontend IDL
  in lockstep (AGENTS.md: IDL/SDK are hand-generated).

---

## 9. Frontend (pointer + the one risk)

`REDESIGN.md` is the source of truth; it's rebuilt on the acid system, lint/typecheck/build green,
29 routes. Production items live there (wallet-gated manual pass, env `NEXT_PUBLIC_SITE_URL`, real
wallet on devnet). One structural risk for this doc: `app/lib/arcadia-idl.ts` + `arcadia-sdk.ts`
are **hand-written** and will drift from the contract after §2/§3 changes. Rebuild them from the
IDL on every contract change, or the UI will build transactions the program rejects.

---

## 10. Risk register (the honest list)

| # | Risk | Mitigation | Status |
|---|------|-----------|--------|
| R1 | Score farmable (no wash guard, no duration term) | §1b/1c land before funding — wash→G + duration→C **DONE** | DONE |
| R2 | Oracle single-key + stale | §3 signed/seq/expiry + delay + breaker | OPEN |
| R3 | AUM-jump shock on tier-up | per-trade notional cap; Score-side time gate | OPEN |
| R4 | OPM leverage 20–40× coupled to tier | decouple; governance ceiling | OPEN |
| R5 | `equity_point` never written → no scoring | real ingest + seed curve — **DONE** | DONE |
| R6 | Frontend IDL/SDK drift | regenerate on each contract change | OPEN |
| R7 | No max-drawdown halt on-chain | HWM guard + deposits breaker | OPEN |
| R8 | Sidecar unauthenticated / exec path undefined | bearer auth **DONE**; decision + reconciliation pending | DONE |
| R9 | Bond slash unspecified | slash-on-misconduct, spec'd mechanism | OPEN |
| R10 | Management fee stored but uncharged | implement or remove | OPEN |

---

## 11. Roadmap (order matters — trust before capital)

**Phase A — make the Score trustworthy (off-chain, no contract change):**
A1. **DONE** equity curve seeding. A2. **DONE** wash verdict → G. A3. **DONE** duration → C.
A4. Fix classify Dormant bug + add W2/W3 + entity clustering. A5. Score staleness decay.

**Phase B — wire trust to the chain (contract + chain crate):**
B1. `set_capacity` → deterministic band lookup (+ event, + `last_set_capacity_ts`).
B2. Enable `solana` feature; real signing in `arcadia-chain`; signed/sequenced/expiring payloads.
B3. Delayed promotions, immediate demotions, max-Δ bounds. B4. Deposits breaker.
B5. Decouple OPM leverage. B6. HWM drawdown guard. B7. Initialize-platform lockdown.

**Phase C — economics & operations:**
C1. Bond slash on misconduct, fully specified. C2. Management fee decision.
C3. **DONE** (public write paths disabled; real ingest). C4. Sidecar auth **DONE**; execution-path decision + ledger reconciliation pending. C5. KMS key
custody + monitoring/alerting + upgrade authority with timelock. C6. Regenerate frontend IDL/SDK.

**Gate:** no external investor deposits until A1–A4, B1–B4, C3 are done and the full 65+new test
suite passes on a fresh devnet redeploy. That is the "production-ready logic" bar for this doc.

## 12. Sources

- MakerDAO OSM (delay + stop/void on oracle attack)
- DF3NDR oracle-defense layers (staleness, bounds, breaker, guardian recovery)
- AFXO signed-feed standard (sequence, expiry, provenance)
- Chainalysis 2025 wash-trading heuristics; Victor & Weintraud 2021; Cong et al. wash-trading
  statistical benchmarks (Benford, rounding, power law)
- Prop-firm risk practice (drawdown-at-equity, scaling tied to consistency, layered exposure caps)
