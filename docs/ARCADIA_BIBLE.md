# THE ARCADIA BIBLE

*The definitive, unforgiving specification of Arcadia — what it is, what is actually built,
and what must be true before it touches real capital.*

Standard of review: assume this protocol will secure billions of dollars. Nothing here is
"good enough." Every claim is cross-referenced against code, not docs. Where a doc disagrees with
code, the code wins and the discrepancy is called out by name.

**Reviewer posture:** Paradigm / Jump / a16z crypto / Solana Foundation / Cantina / Halborn /
a hedge fund's tech DD / a founder raising a $20M Series A. Independent renderings of each major
problem are given, and the recommendation is always the **simplest** viable fix — not the most
impressive one.

---

## 0. Verdict (read this first)

### 0.1 What Arcadia is, honestly

Arcadia's contract (`arcadia_vault`) is a competent, small, well-tested **non-custodial vault
accounting engine**: deposit → shares → NAV, HWM-based performance fee, notice-gated withdrawals,
per-trade notional and leverage caps. That part could plausibly handle real money **if** it were
wired correctly.

The trust layer is not built. The Score — which is the protocol's *entire* reason to exist — is in
its shipped wiring **unverifiable and self-reported.** Anyone can fabricate a perfect trading
record through the public API and mint themselves a top tier. The Score is not a source of truth;
it is a form the user fills in and posts back.

### 0.2 The one sentence that matters

> **Arcadia is (currently) a centralized risk desk wearing a non-custodial contract.**
> The contract holds funds. The incentive design and scoring are sound in outline. But the
> on-chain feed, the score inputs, and cross-system wiring do not exist as running code.

That is not a criticism of ambition — it is a map of the remaining terrain. The good news: the
fixes are **simple**, not architectural revolutions. The bad news: they are mandatory, and until
they land, no one should deposit.

### 0.3 Five facts the code proves (supporting the verdict)

| # | Fact | Evidence |
|---|------|----------|
| F-1 | The scoring engine is fed by **real, chain-proven** data via a live ingest worker. `workers/ingest.rs` polls `SOLANA_RPC_URL` (`getSignaturesForAddress` + `getTransaction`, batched, cursor-advanced), decodes `Program data:` logs through `arcadia_decode`, and projects to the `flow`/`trade` tables keyed on real `(signature, event_index)`. The HTTP write path `/v1/trades/simulate` is **disabled** in production by the `EXECUTION_ONLY` flag (403); the old `/v1/events` endpoint was **deleted** (ingest is the only writer), so self-reported trades/deposits can no longer feed scoring. | `workers/src/ingest.rs`; `decode/src/lib.rs`; `api/src/simulate.rs`; `state.rs::execution_only` |
| F-2 | The Score is **now built from the equity curve**, and the worker no longer silently skips profiles. When on-chain history has fewer than 2 points, the score worker seeds `equity_point` (NAV starts 1.0, compounds realized-PnL/deployed per day) via `metrics::derive_equity_curve`, so `curve.len() < 2` no longer starves scoring. | `workers/src/score.rs`; `scoring/src/metrics.rs` |
| F-3 | The oracle does **not** touch the chain. `arcadia-chain::push_set_capacity`/`submit_record_trade` return `STUB_*` with `confirmed:false`; the `solana` feature is disabled. Capacity lives only in Postgres as `trader_shares × multiplier` (Stake×Multiplier). | `crates/chain/src/lib.rs`; `workers/src/score.rs:76` |
| F-4 | **Documentation disagrees with code in at least six places**, uncaught. | see §Inconsistencies |
| F-5 | Trust is effectively a **single key**: one `oracle_authority` gates `set_capacity`, `record_trade`, `settle`; one `admin`; one `processor`. A corrupt oracle can mark anyone "fundable," and is the co-signer of every trade. | `state.rs::PlatformConfig`; `instructions/*` |

### 0.4 Bottom line for you, the operator

You are building a **centralized, reputation-gated hedge fund on Solana**. That is a legitimate,
even attractive business. But it is not currently true that the protocol is "decentralized" or
that the Score is "verifiable." The Bible's plan: **stop pretending, and make the honest version
production-grade with the fewest parts.**

---

## 1. Vision

Arcadia routes investor capital to skilled traders, scored by on-chain trading history, through
non-custodial vaults. Capital follows demonstrated edge; reputation, not wealth, sets the ceiling;
investors, not the protocol, decide allocation.

**Required behavior, stated as invariants the whole system must preserve:**
1. A trader can never move investor funds out of the vault except (a) per-trade notional/leverage
   caps, and (b) their own claimable profit + bond.
2. Capacity is a deterministic function of a *trusted* score/tier, never of wealth or self-attestation.
3. Investors can always withdraw within a bounded, known time under all but malicious-neutral failure.
4. Every unit of NAV is traceable to shares; there is no fungibility drift between share math and
   token balances.
5. The system degrades safely on infrastructure failure (score-worker down, oracle down, gas spikes).

---

## 2. Core Philosophy

1. **Trust is the product.** The Score is not a vanity metric; it is the gate through which capital
   flows. A worthless Score is a worthless protocol. Therefore the Score's *inputs* are the single
   highest-value surface in the entire codebase.
2. **Non-custodial ≠ trustless.** The contract is non-custodial. The oracle/operator is not. These
   are different things and both must be honest in the docs.
3. **Simple beats clever.** Every extra moving part is a new place to lose money. Prefer the fewest
   instructions, the fewest signers, the fewest state fields that still meet the invariants.
4. **Risk is priced and bounded, not eliminated.** Arcadia cannot stop a trader from losing money.
   It can cap how much and how fast, and make the cap deterministically enforced on-chain.

---

## 3. First Principles

- **You cannot predict profitable traders.** You can only observe *past* behavior and infer *habits*
  (risk control, consistency, survival). The Score measures habits, and must be labeled as such —
  never as "this trader will profit."
- **Incentives create behavior.** If the reward is "score velocity" or "volume," traders will
  optimize for that, including by faking it. Design the Score out of what is hard to fake.
- **The worst failure is silent.** A Score that quietly goes stale, or a deposit that silently
  doesn't record, is worse than a loud outage. Every feed needs a staleness/age signal that is loud.
- **The fewest keys that can move money should be the fewest possible.** Every key is a compromise
  surface. Wanted: no single key both *prices* and *moves*.
- **Loss-of-capital and loss-of-reputation are different.** Drawdown is a loss of capital; wash is
  a loss of trust. The contract must treat them differently (see Bond & Slashing).

---

## 4. Mental Models

- **Vault-as-NAV-engine:** the contract is a share-pricing ledger. Everything else (score, oracle,
  execution) is plumbing feeding that ledger.
- **Score-as-credit-score:** the Score is a *credit line*, set by a trusted bureau (the oracle),
  not a measure of the trader's current bankroll. Capacity = credit limit; the trader's skill +
  investor appetite = utilization.
- **Oracle-as-risk-desk:** the operator signs every trade (co-signature) and sets every tier. That
  is not decentralization — it is a **centralized risk desk with on-chain enforcement.** Adopt that
  mental model; it is more honest and requires fewer heroics.
- **Two-clock system:** the Score refreshes slowly (hourly), the chain is real-time. Reconciliation
  between the two is where bugs live.

---

## 5. Protocol Architecture

### 5.1 Components (as shipped)

| Layer | Component | Status |
|-------|-----------|--------|
| Chain | `arcadia_vault` Anchor program | Real, tested (65 tests) |
| Chain wiring | `arcadia-chain` (signing) | **Stub** (`solana` feature off) |
| Ingest | `workers::ingest` (JSON-RPC Poller) | **Real** — polls `SOLANA_RPC_URL`, decodes `Program data:` via `arcadia_decode`, projects real-signature events |
| Score | `arcadia-scoring` (Q×C×G) | Real, pure, tested in-crate |
| Classification | `arcadia-core::classify` | Real but **not consumed by Score**; has a bug |
| Oracle/DB writer | `workers::oracle` | Real, writes DB only, `deposits_open` hardcoded true |
| Withdraw keeper | `workers::withdraw_processor` | Real, hand-rolled signing, polls 30s |
| Execution | `execution-worker` sidecar + FlashTrade | Real; bearer-token auth; orchestrator runs full lifecycle |
| API | `arcadia-api` | Real; simulate + events are the trust hole |
| Frontend | `app/` Next.js | Real, redesigned; hand-written IDL |

### 5.2 The intended data flow vs the actual data flow

**Intended:** chain events → `ingest` → DB → score → oracle → chain. Loop closed by real
transactions.

**Actual:** chain events → real ingest worker (`getSignaturesForAddress` poller) → decode →
DB → score → DB → display. The HTTP write path `/v1/trades/simulate` is
**disabled by `EXECUTION_ONLY` (403)** in production (the `/v1/events` endpoint was deleted; ingest is the
only writer); the remaining gap is that the score →
oracle → chain push (`arcadia-chain`) is still a stub (capacity stays in Postgres).

This is the single most important architectural correction (see §Redesign).

---

## 6. Complete System Diagram

```
               ┌──────────────────────────────┐
               │        ARCADIA PROTOCOL      │
               └──────────────────────────────┘
   Traders ──▶ initialize_profile ──▶ vault (non-custodial)
   Investors ─▶ deposit ──▶ shares ──▶ NAV ──▶ withdraw (notice)
                   │                           │
                   ▼                           ▼
        record_trade (oracle co-sign)      settle (HWM perf fee)
                   │                           │
                   ▼                           ▼
        scoring engine (Q×C×G)          trader_claimable → withdraw
        classify (wash/bot)                    │
                   │                           ▼
                   ▼                     bond (trader_shares)
        oracle writes tier/capacity ◀── slash on misconduct
                   │
                   ▼
        contract band lookup ──▶ capacity_cap_usd
```

**Today the left column's bottom arrows are still stubbed (`arcadia-chain` push); ingest is real.**

---

## 7. Economic Model

- Trader earns a profit share (20–40% via `tier_bps`) of gains above HWM, accrued to
  `trader_claimable`. Platform earns a 5% performance fee (`PLATFORM_PERF_FEE_BPS`) on the same
  gains. Investors earn the remainder.
- A management fee exists as a constant and a function but is **never charged**. It is dead weight.
- Losses reduce NAV; `trader_claimable` is never reduced on a drawdown (realized profit is banked).
- Capacity: intended = `band(score_tier)` (investor ceiling). Shipped = `trader_shares × multiplier`
  (Stake×Multiplier) in DB only.

**Economic challenge (the honest one):** traders sell their *upside* (profit share) while investors
bear most *downside*. This is standard hedge-fund structure and is fine **provided** the score is
real and risk is capped. If the score is fake (F-1/F-2), the entire allocation layer is a
selection process over fabricated data, and investors are betting on a rigged black box.

---

## 8. Incentive Design

Supported by the code as-shipped? **No.** The strongest incentive today is:

> Posting self-reported winning trades to `/v1/trades/simulate` raises your score, tier, and hence
> the capital you can attract — with zero on-chain or exchange corroboration.

That is an open faucet for wash-and-fake. The Score's whole purpose (reward real skill) is inverted
until F-1/F-2 are fixed. **This is the highest-priority issue in the entire system.**

Correct incentive stack (each must be real before the next is trusted):
1. **Real, verified trades** feed the Score (relates incentive to actual PnL).
2. **Track-record duration** gates tiers (rewards persistence, punishes freshness-farming).
3. **Wash/bot guard** penalizes fabrication (rewards authenticity).
4. **Bond at risk** on misconduct (rewards honesty at scale).

---

## 9. Trust Model

**As shipped, trust is concentrated in Arcadia's backend + a single oracle key.** The contract is
non-custodial, but nothing prevents the operator from:
- setting any trader fundable regardless of merit (`set_capacity`, oracle key),
- fabricating or gatekeeping the Score (it is the operator's DB),
- silently dropping events (lossy `"frontend"`-signature bridge).

**Recommended — minimum honest trust posture (simple, not heroic):**

| Trusted party | Holds | Must be hardened by |
|---------------|-------|----------------------|
| blockchain | execution of share math | invariants + tests (already strong) |
| Arcadia operator (oracle) | score/tier, records trades | operationally hardened key + signed payloads + append-only logs; **acknowledged as central** |
| Arcadia admin | pauses, fee params, platform config | timelock + multisig (safe minimal) |
| traders | their strategies | can only lose their claimable + bond |

This says plainly: **trust the operator to set scores, but protect investors with hard ceils and a
loud audit trail.** It does not pretend to be trustless.

---

## 10. Security Model

### 10.1 What is genuinely strong (verified in code)

- `overflow-checks = true`; every token transfer followed by a `TokenConservationFailed`
  `require_eq` invariant on *both* accounts (`deposit`, `process_withdraw`, `record_trade`,
  `settle`, `trader_withdraw_profit`, `fund_execution`).
- `trader_claimable` excluded from NAV (`nav_bearing_assets`), so the trader cannot inflate NAV
  with their own accrual.
- HWM only ratchets up forward; no double-charge on flat settle (tested).
- Notice-gated withdrawals (instant <5% of AUM, else next daily settlement window).
- `record_trade` requires trader + oracle + treasury-authority **all** to sign — a strong
  anti-single-party move, *if* the oracle is actually independent.
- 65 LiteSVM integration tests with CU summaries + 5 math unit tests.
- PDAs with signed-profile authority on the vault token.

### 10.2 What is fragile

1. **Score inputs are real (ingest) but chain→oracle push is unwired** (F-1/F-2). The ingest worker
   now feeds scoring from on-chain events, and the worker seeds the equity curve so it no longer
   starves. The remaining hole: capacity/score push to chain (`arcadia-chain`) is still a stub, so
   on-chain capacity and DB capacity can still diverge.
2. **Single oracle key** with broad power (sets tier, co-signs every trade). If it leaks or is
   corrupted, capacity is arbitrary and every trade is approved.
3. **`/v1/trades/simulate` is disabled in production by `EXECUTION_ONLY` (403); the old `/v1/events` endpoint was deleted.** The constant `"frontend"` signature and `sim:`-pollution of the live `trade` table can no longer occur through
   the public API — the only writers are the real ingest worker (real `(signature, event_index)` PK).
5. **No on-chain drawdown halt** — a vault can bleed down to the per-trade floor with no circuit
   breaker.
6. **Unauthenticated `initialize_platform`** — first caller becomes admin. A deployer key must
   pin it.
7. **`deposits_open` hardcoded `true`** for everyone.
8. **Execution sidecar** (HTTP port 3001) is bearer-token authenticated via `SIDECAR_TOKEN` (A5).

---

## 11. Capacity Model

**Design decision (settled):** `effective_cap = band(score_tier)` — an on-chain pure lookup.
`TIER_BAND_USD = [25k, 100k, 250k, 500k, 1M]`, tier 255 → 0. Investor-AUM ceiling, `trader_claimable`
excluded, trader co-invest counts.

**Why:** reputation sets the ceiling, investors set the allocation; deterministic, auditable,
no admin override. Simpler than Stake×Multiplier. Rejected alternatives:
- *Stake × Multiplier* (shipped): gates capital on personal wealth — wrong incentive, punishes
  skilled-but-illiquid traders; also rewards the rich, not the skilled.
- *On-chain ramp*: double-penalizes (score gates tiers then chain gates again). Discarded; the time
  gate belongs in the Score (Confidence), not the chain.

**Failure modes to respect:**
- **AUM-jump shock:** a trader promoted to $1M band from small own-NAV can absorb $1M in one block.
  The per-trade notional cap (20% of AUM) is the backstop; **do not** add a second on-chain ramp.
- **Score farming** via fabricatable inputs (F-1/F-2) — must be closed *before* the band lookup
  means anything.

**Security/econ/UX implications:** lookup is trivial and cheap (no compute concern). UX: traders
see one deterministic number. Long-term: aliases cleanly to a governance-managed table.

---

## 12. Score Model

**`Score = clamp(Q × C × G, 0, 1000)`.**

- **Q (Quality):** weighted normalized Sharpe 25%, Sortino 20%, MaxDD 15%, Calmar 15%, Vol 10%,
  DownsideDev 10%, MeanReturn 5%. Only meaningful if inputs are real.
- **C (Confidence):** `1/(1+exp(−(n−200)/125))`, logistic in trade count only. **Missing calendar
  time.** Doc says μ=400/σ=125; code uses 200/125 — *inconsistency, minor*.
- **G (Guard):** `min(g_liq(5%), g_dd(30%))`. **Missing wash** (dead code) and **missing duration.**

**Required behavior of a production Score:**
1. Inputs = verified on-chain trades + real equity curve. (Today: self-reported → breach.)
2. Monotone in cautious, persistent, authentic behavior.
3. Staleness-decaying: a stale score (no fresh snapshot) must reduce effective trust, not freeze it.
4. Hard gate to `NOT_FUNDABLE_TIER` for repeated/severe wash; intermediate severity caps max tier.

**Alternatives considered & rejected:**
- *Flat point penalties (`score -= 20`)* — distorts the multiplicative structure; rejected.
- *Pure-rule score, no statistical blend* — less adaptable, rejected for v1 but watch.

---

## 13. Guard Model

**`G = min(g_liq, g_dd)` today.** Required: `G` must include **wash** and **duration** as
multiplicative factors:

```
G = g_liq(liq_rate)  ×  g_dd(max_dd)  ×  g_wash(verdict)  ×  G_duration(months_active)
```

- Clean trader → all factors = 1.0.
- **Why multiplicative:** preserves relative importance of each independent risk dimension; a
  single bad factor in any dimension can zero the trust score, which is exactly what a protective
  gate should do.
- **Why wash sits in G, not a subtraction:** wash is an *integrity* signal; it should scale the
  whole score down proportionally, matching the risk.

---

## 14. Reputation Model

Reputation = the Score + its auditability. Two properties matter:
1. **Determinism:** rerunning the engine on the same inputs yields the same score (already true —
   pure function). This lets a rejected trader verify.
2. **Non-gamable inputs** (the actual goal of F-1/F-2). A usable reputation system must prove,
   not assert, the trading history.

**Weakness to name:** reputation never predicts *future* profit. The docs must not overclaim; the
Score is a *credit* measure, not an alpha predictor. This is a doc/UX honesty fix, not a code one.

---

## 15. Capital Allocation Model

- Two-stage: **Score sets the ceiling (capacity), investors set the actual flow.** 
- Allocation must be gated on the *oracle-co-signed* record, not self-report.
- **Simple recommendation: to protect investors with minimal machinery**, add two on-chain caps:
  1. per-trade notional ≤ 20% AUM (exists),
  2. a **hard OPM leverage ceiling** (governance constant, e.g. 10×) *independent of* `tier_bps`.
  3. a **deposits halt on deep drawdown** (HWM guard) — a circuit breaker, not a liquidation engine.

Do **not** build a full liquidation supervisor for v1; losses are realized through `settle` and the
oracle co-signs every trade (the operator is the risk desk). This is the simplest correct posture.

---

## 16. Vault Model

State: `TraderProfile { trader, base_mint, vault_token, total_shares, trader_shares, hwm_per_share,
capacity_cap_usd, trader_claimable, last_settle_ts, created_at, status, score_tier, max_leverage, bump }`.
Investors hold `InvestorPosition`, aggregated in `InvestorAccount`.

**Accounting invariants (must never change):**
1. NAV excludes `trader_claimable`.
2. Shares are fungible; `total_shares` always equals the sum of positions (trader + investors).
3. No mint without deposit; no burn without withdrawal; both conserve tokens to the lamport.
4. HWM ratchets only upward on settle.
5. Withdraw needs either notice elapsed or the processor's authorized run.

**Failure modes:** `trader_claimable` growing unbounded while vault NAV falls (a stale claimable
inflates the "instant <5%" window). Add an invariant test: `trader_claimable ≤ vault NAV` whenever
settle executes. **Simple, high-value.**

---

## 17. Trader Lifecycle

1. **Onboard** → `initialize_profile` (max_leverage set; `score_tier = NOT_FUNDABLE_TIER` until fundable).
2. **Prove** → verified trades accumulate; score/tier climb (gated by duration + wash guard).
3. **Fund** → oracle sets a band; investors deposit up to `band`.
4. **Trade** → `record_trade` (oracle co-sign), per-trade caps enforced.
5. **Settle** → HWM perf fee → `trader_claimable`; trader withdraws profit.
6. **Downgrade/exit** → tier cut (immediate, on-chain), or close profile.

**Challenge:** the gate from 2→3 is entirely on the Score's truth (F-1/F-2). Nothing else protects
the system here. **This is the make-or-break lifecycle transition.**

---

## 18. Investor Lifecycle

1. **Deposit** → shares minted at current NAV; capacity ceiling enforced (`deposit.rs`).
2. **Hold** → NAV moves with trades; HWM/perf-fee accrual reduces their share only on realized gain
   (they keep the majority).
3. **Withdraw** → stake a notice; instant if <5% AUM else next daily window; processor pays out.

**Challenge:** investor fairness in the "instant <5%" window — a large whale exiting against a
thinning reserve. Mitigate by (a) the notice window for >5%, (b) keeping a real reserve of
liquidity (the vault *is* the reserve; per-trade notional cap keeps positions small enough to
unwind), and (c) a deposits pause on stress. **Simple, doable, no new architecture.**

---

## 19. Execution Flow

- `fund_execution` (broadcaster + admin) moves vault collateral to an **execution wallet** that
  trades on FlashTrade (sidecar). Documented as a multi-signer consumption of a `ticker`.
- **Issue:** `docs/execution-wallet-architecture` describes a *different* program/discriminator set
  and Convex — none of which is the shipped Anchor program or repo. The fork-of-record diverged.
- **Issue:** `docs/execution-wallet-architecture` describes a *different* program/discriminator set
  and Convex — none of which is the shipped Anchor program or repo. The fork-of-record diverged.
- **Status now:** the `executor` orchestrator runs a real lifecycle (ready wallet → sidecar open →
  WS position monitor → close → ledger record), and the sidecar requires a `SIDECAR_TOKEN` bearer on
  every `/trade` route (A5). Ledger-to-`trade`-table reconciliation is the remaining gap (real fills
  feed the Score via `fills::record`, but a mismatch audit is not yet automated).
- **Simple recommendation:** decide the execution path explicitly (FlashTrade sidecar for v1 is
  acceptable) — auth is done; add periodic ledger-to-DB reconciliation (ties to F-1).

---

## 20. Oracle Flow

**Intended:** score worker → `push_set_capacity` → chain, `confirmed:true`. **Actual:** stub,
`confirmed:false`; only DB updated.

**Required flow (simple, production-minimum):**
1. Score worker writes a snapshot.
2. `set_capacity` pushes a **signed, sequenced, expiring** payload to `record_trade`/`set_capacity`.
3. Contract verifies oracle signature, rejects stale (`valid_until`) and out-of-order (`sequence`).
4. **Delayed promotions, immediate demotions** (MakerDAO-style): a tier *up* becomes effective after
   a delay; a *down*/`NOT_FUNDABLE_TIER` is instant.
5. Capacity change bounded (max-Δ per update) — a sanity bound, cheap.

**Alternatives rejected:** M-of-N oracle committee now (that is the "complex, hard" option the spec
avoids); a full trustless ZK-verifiable score (research-grade, not v1). **Start with one hardened
operator key + the above; evolve to a committee later** (see Decentralization Roadmap).

---

## 21. State Machine (contract)

**Platform:** `uninitialized → initialized (admin pinned) → operating → paused → operating`.
**Profile:** `active` / `closed`. **Position:** `open → pending_withdraw → withdrawn/closed`.
**Ticker (execution)** in the doc's original design: `idle → in_position → closed`.

Add: a **paused** state that halts new deposits while preserving withdrawals (circuit breaker).

---

## 22. Accounting Model

- **NAV** = `nav_bearing_assets(vault, trader_claimable) / total_shares × SHARE_SCALE`.
- **Deposit:** `shares = amount` if first, else `amount × total_shares / assets` (floor).
- **Withdraw:** `assets = shares × nav / total_shares`; conserves tokens.
- **Settle:** gain above HWM → trader cut + platform cut; HWM ratchets; `trader_claimable` accrues.
- **Loss:** no fee, NAV falls, HWM unchanged.

**Auditability gap:** the DB (`flow`/`trade`) can diverge from chain because it is fed by
self-reported HTTP. **Status:** the public write paths are now disabled by `EXECUTION_ONLY` (403)
and the real ingest worker projects on-chain events with real signatures — the divergence path is
closed at the ingest feed. This is the F-1 fix.

---

## 23. High Water Mark

- HWM = highest NAV/share; perf fee only on gains above it. Correct and standard.
- **Guard:** HWM is per-profile and only advances on settle; `record_trade` does not update it
  (deferred). Acceptable, but add the invariant test in §16 so a stale HWM cannot be exploited by
  rapid gain-then-loss sequencing in a single period.

---

## 24. Profit Distribution

- Trader: `tier_bps` (20–40%) of gain → claimable. Platform: 5% → treasury. Investors: remainder.
- **Challenge:** the trader's share is *based on the trader's own reported tier*, which is the
  Score. If the Score is fabricated (F-1/F-2), the entire profit split is computed off a lie.
  Fix the inputs; the split formula itself is fine.

---

## 25. Loss Distribution

- Losses hit NA across all share-holders proportionally. `trader_claimable` is **not** clawed back.
- The **trader's bond/loss-of-trust** is distinct from NAV loss (see Bond & Slashing); a loss is
  risk, not misconduct.

---

## 26. Fee Model

**Decide one of (do not leave both):**
- **Keep** a 5% platform perf fee; make `mgmt_fee_bps` either zero everywhere or actually charge it
  and test it. Right now it is stored, referenced, and **unused** — a liability and an audit smell.
- Recommend: **drop the mgmt fee for v1** (simplest), revisit when AUM is material.

**Why:** a promised-but-unenforced fee on the book's chief record is exactly the kind of silent
mismatch that fails DD.

---

## 27. Bond Model

- The bond = `trader_shares` — the trader's own committed capital in the vault. It is real skin in
  the game and already exists on-chain.
- **Requirement:** it must be *at risk*, otherwise it is a meaningless entry ticket.

---

## 28. Slashing Model

**Design ruling (changed from the earlier draft): slash for misconduct, NOT for drawdown.**
- A −30% drawdown is **risk**, already borne by investors via NAV; a good trader can hit it in a
  crash. Slashing on drawdown punishes bad luck — reject.
- **Slash conditions (enforcement requires the oracle's verdict):**
  1. wash/bot hard-gate trigger,
  2. disappeared/ghost vault (no activity + no communication beyond timeout),
  3. rule violations.
- **Mechanism:** convert a % of `trader_shares` to base, sweep to treasury. **Must be specified
  end-to-end** (share pricing interaction, `trader_claimable` interplay, withdrawal-queue effect)
  before shipping. Do not ship half-specified.

**Simplest correct v1:** a boolean `slashable_flag` set by oracle + a `slash` instruction that burns
a fixed % (e.g. 50%) of `trader_shares` into treasury, with the exact share/NAV math done carefully
and tested. Fewer parts than a rich slashing engine.

---

## 29. Governance Roadmap

- v1 governance is the **operator/admin.** Accept it.
- v2: admin actions (fee params, tier bands, leverage ceiling, pause) under a **timelock + 2-of-3
  multisig**. No complex DAO for v1.
- Fee/parameter changes must be **transparent**: emit events, publish a change log.

---

## 30. Decentralization Roadmap

Honest staged plan (none of this is required for v1 to be safe, because v1 is operator-ruled):
1. **Single hardened oracle key** + signed/sequenced/expiring payloads + delayed promotions.
2. **2-of-3 oracle attestation** for tier writes (cheap once the signed-payload infra exists).
3. **Investor-selected traders** = the real product moat; decentralization of *allocation* is done
   by investors, not by us needing a committee.
4. **Progressively decentralize the Score** (bio: open engine, public snapshots) without
   decentralizing the operator's job of setting risk.

**Do not** pretend to be decentralized in v1 docs.

---

## 31. Threat Model

### 31.1 Adversaries
- **Fake trader:** fabricates a winning record to attract capital (F-1/F-2). **Today: wins.**
- **Wash/sybil operator:** multiple wallets, self-reported, farming tiers.
- **Oracle key compromise:** arbitrary capacity + trade approval.
- **Admin/processor compromise:** pause, fees, withdrawals.
- **Liquidity raider:** whale depositing to drive AUM then withdrawing; or exiting the <5% window
  fast against a thin pool.
- **Front-runner / MEV:** order routing of the vault's execution wallets.
- **Griefer:** spamming fills/events, exploiting PK collisions to make the DB inconsistent.
- **Sidecar attacker:** could previously open/close on the execution wallet; now gated by `SIDECAR_TOKEN` bearer auth.

### 31.2 Priority ranking
| Rank | Threat | Severity |
|------|--------|----------|
| 1 | Score inputs are real, but chain→oracle push is unwired (F-1/F-2) | Critical — on-chain capacity can diverge |
| 2 | Single oracle key, broad power | Critical |
| 3 | No on-chain drawdown halt | High |
| 4 | Execute-only gateway (`simulate` 403) removes API ingestion attacks (was `frontend`+`sim:` collisions; `/v1/events` deleted) | Resolved |
| 5 | Unauthenticated sidecar | High (bearer auth added — re-verify) |
| 6 | Unpinned `initialize_platform` | Medium |
| 7 | OPM leverage coupling to tier | Medium |
| 8 | Feature staleness (score decay) | Medium |

---

## 32. Economic Attack Analysis

- **Score fabrication → misallocation:** the dominant economic attack. Until F-1/F-2, a trader can
  attract far more investor capital than its real (or even nonexistent) edge deserves. Investors
  suffer the downside; the attacker harvested the attract-and-extract cycle.
- **Bond-vs-capacity asymmetry:** bond is small (self-funded `trader_shares`), capacity up to $1M.
  The *expected* downside to the trader (bond, reputation) is far below the upside of a large
  losing position + the leverage. Mitigate with: hard OPM leverage ceiling, per-trade notional cap,
  drawdown deposit halt, and a traffic-light of these on the vault page.
- **Sybil:** dies with verified on-chain inputs + the duration term (Confidence ramps with months
  active) now wired to `C`.
- **Griefing:** the old chunked fake-event / `frontend`-signature PK poisoning is closed by the
  `EXECUTION_ONLY` gateway (403 on the public write paths); ingest uses real `(signature, event_index)`.

---

## 33. Security Review (deliverable-grade summary)

**Pass:** arithmetic safety, conservation invariants, PDA-seeded vault, notice-gated withdrawal,
HWM logic, per-trade notional cap, oracle multi-signer on `record_trade`, and 65 tests.

**Fail (cultural/fit, not code):** the trust layer is unverifiable and self-reported; oracle is
single-key and unwired; event ingestion is stubbed; a data-loss signature collision exists; the
contract leaves no trace for `set_capacity` (no event, no timestamp); `initialize_platform` is
unpinned; execution sidecar is open.

**Recommended minimum review cohort before any real funds:** an Anchor smart-contract auditor
(Cantina/Halborn) on the *final* program once wiring lands + a protocol-economics reviewer on the
score/capacity/oracle path. Not on the current stub-wired build.

---

## 34. Production Readiness Review

**Not production-ready.** Blocking, in order:
1. Bind the Score to *verified* on-chain inputs (F-1) and actually seed `equity_point` (F-2).
2. Enable the real oracle→chain wiring (`solana` feature) with signed/sequenced/expiring payloads.
3. Implement the band-lookup contract, no admin `cap_usd`.
4. Add wash→G and duration→C; fix `classify`'s Dormant bug and the `"frontend"` signature collision.
5. Harden ops: sidecar auth, KMS keys, deposit pause, pin `initialize_platform`, management-fee
   decision, timelock/multisig for params.
6. Regenerate frontend IDL/SDK from the final IDL (they're hand-written today).
7. Full 65+new test suite on a fresh devnet redeploy; then a **3-tier cap** on first deposits.

**Gate:** no external investor deposits until 1–3, 5 done and redeployed.

---

## 35. Open Questions

1. **Execution path:** is the FlashTrade sidecar the v1 production venue, or a devnet stub until a
   real broker/liquid provider? This decides how much of the executor TODO is urgent.
2. **Management fee:** charge it (5%/1%) or drop to 0? (Recommend: drop for v1.)
3. **OPM leverage ceiling:** what governance value? (Recommend 10× to start; revisit.)
4. **Bond slashing % and mechanism:** 50%? exact share math? (Recommend: design + test before ship.)
5. **Score staleness window:** what "no fresh snapshot" duration triggers decay + decay curve?
6. **Drawdown halt threshold:** what % below HWM pauses deposits? (Recommend −20% as a first cut.)
7. **First-deposit cap / staged scaling:** what initial ceiling per vault to limit blast radius?
8. **Tier band table final numbers** (the $25k…$1M values are a proposal, not ratified).

---

## 36. Things That Must Never Change

1. **Token conservation invariants** and `overflow-checks=true`.
2. **NAV excludes `trader_claimable`**; share math is exact; no fungibility drift.
3. **HWM only ratchets upward** on settle; perf fee only on gains.
4. **Notice-gated withdrawals** (instant <5%, else daily window).
5. **Capacity is investor-AUM, deterministic, and never set by wealth or self-attestation.**
6. **Bond is slashable only for misconduct** (never for drawdown).
7. **`record_trade` requires an independent co-signer** (oracle) — a real anti-fraud property.
8. **The Score is a credit measure, not a profit predictor** (documented honestly).
9. **Per-trade notional cap** (20% of AUM).
10. **Withdraw + deposit always conserve NAV exactly.**

---

## 37. Things Safe to Iterate

- Tier band table values; OPM leverage ceiling; management fee; drawdown-halt threshold.
- Wash/guard thresholds (tune off data, never silently).
- Score weights (tune off data, with a clear audit trail).
- First-deposit caps and staged scaling.
- Oracle committee size (single → 2-of-3 → …) after payload infra exists.
- Execution venue (sidecar → licensed broker) behind the same vault interface.

---

## 38. Future Extensions

- Investor-side **trader selection** and per-vault risk preferences (the moat).
- **Performance attribution** marking realized-vs-unrealized, position-level.
- **Pause + insurance/reserve fund** funded by a small platform fee (ties to payout-reserve
  thinking in prop-firm practice).
- **Delegate/liquid provider** to replace the FlashTrade sidecar.
- **2-of-3 oracle attestation; public score snapshots; open engine.**
- **On-chain verifiable score** (research; not v1).

---

## 39. Migration Strategy

The **`arcadia-chain` signing feature is disabled by default and the program will change
(`set_capacity` band lookup, `initialize_platform` pin, `paused`, events). Plan:**
1. Freeze the live program at a version; do all contract work on a **new program ID**.
2. Run the new program on devnet with the full LitesVM + test suite green.
3. Deploy new program; point the frontend IDL/SDK (regenerated from the real IDL) to it.
4. **Asset migration is rebuild-from-scratch for v1** (fresh vaults, no USDC in the old one) —
   simplest and safest. Do **not** attempt a live state migration of a fund-style vault until the
   economics are proven with a staged cap.
5. Keep `deploy-program.sh` + the hand-written IDL in lockstep (returned to frontend §).

---

## 40. Things That Will Be Asked at a $20M Raise — Pre-seed

Be ready with, in order:
1. "Prove the score is not fake." → F-1/F-2 fix + live verified trades.
2. "Who can set anyone's tier?" → operator, fully disclosed; signed/sequenced payloads; timelock.
3. "What happens if the oracle key leaks?" → immediate demotion path, pause, key rotation, and the
   circuit-breaker — not a committee (yet).
4. "What is the status wire vs reality?" → REBUILD the docs: this Bible + updated README; the six
   doc-vs-code divergences (§Inconsistencies) are deadly for trust.
5. "Where is the on-chain feed?" → ingest + oracle wiring, real, not stub.
6. "Management fee or not?" → one answer, not both.

---

## 41. Inconsistencies Between Docs and Code (identified)

| Doc | Claims | Code says |
|-----|--------|-----------|
| `README.md` | `ARCADIA_STORE=memory ARCADIA_DEMO_MODE=true` works | memory mode does not exist |
| `execution-wallet-architecture/README.md` | A Convex app + program `2Xefp1aB...` with `consume_ticker`/`register_ticker` | Neither exists in this repo; the real program is `FPoAMR...` and has no such instructions |
| `scoring-engine.md` | Confidence μ=400, σ=125 | code uses `PRIOR_MU=200`, `CI_BASE=125` |
| `workers/oracle.rs` comment | `deposits_open` gated by `score>=600` | always `true` |
| `capacity.rs` headers | "no 600+ gate, every score ≥100 gets a tier," `capacity=trader_shares×multiplier` | tier 0 at <250; `trader_shares×multiplier` is the *old* model being replaced |
| `chain/lib.rs` doc | tier 0–3 (omits 4=Apex) | tier 4 exists |

**Rule going forward:** a change to any of the above requires a doc update in the same PR.

---

## 42. Appendix — Simple-fix cheat sheet (everything this Bible adds, in one table)

| Gap | Simplest production fix | Where |
|-----|--------------------------|-------|
| Score fed by self-report | **DONE:** `/v1/trades/simulate` is 403-gated by `EXECUTION_ONLY`; `/v1/events` deleted; real ingest worker reads chain (`getSignaturesForAddress`) → `decode` → `flow`/`trade` | `api/simulate.rs`, `workers/ingest.rs` |
| `equity_point` never written | **DONE:** worker seeds `equity_point` from verified `flow`+`trade` via `derive_equity_curve` | `workers/score.rs`, `scoring/metrics.rs` |
| `"frontend"` signature collision | **DONE:** real tx signature + `event_index` PK from ingest; public write paths disabled | `workers/ingest.rs` |
| `sim:` deterministic collisions + polling live table | **DONE:** simulate 403'd in production; only ingest writes to `trade` | `api/simulate.rs` |
| Capacity offline + Stake×Multiplier | `set_capacity` → `band(score_tier)` lookup; wire real chain signing | contract, `chain/` |
| Oracle single key / stale | Signed, sequenced, expiring payload; delayed up / instant down; max-Δ bound | contract, `chain/` |
| No drawdown halt | Deposits pause when NAV < HWM×0.8 | contract |
| OPM leverage 20–40× | Governance constant = 10×; decouple from `tier_bps` | contract, `constants.rs` |
| Bond / slashing undefined | `slashable_flag` + `slash` burning 50% of `trader_shares` on misconduct | contract (design+test) |
| Wash dead code / no duration | **DONE:** verdict→G (multiplicative), months-active→C (logistic); Dormant bug still open | `scoring`, `core/classify` |
| Mgmt fee stored-unused | Set to 0 for v1 | contract |
| Unpinned `initialize_platform` | Require deployer key | contract |
| Sidecar unauthenticated | **DONE:** `SIDECAR_TOKEN` bearer auth on `/trade` routes | `execution-worker` |
| Hand-written IDL drift | Regenerate from real IDL on every contract change | `app/lib/*` |
| Pause this whole system's trust narrative | Rewrite README/docs to the honest centralized-risk-desk model | docs |

---

*End of Bible. **Rule:** when any section disagrees with shipped code, the code wins and this
document must be updated in the same change. The protocol is a centralized risk desk with a
non-custodial engine until proven otherwise; the roadmap above is the shortest honest path to
billions-of-dollars-grade soundness — and every item on the cheat sheet is deliberately small.*