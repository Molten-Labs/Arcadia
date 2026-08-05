# Capacity Model — Score-Banded, Market-Allocated

Decision record for how a trader's deployable capacity is derived. Supersedes the older
**Stake × Multiplier** reasoning.

## Philosophy

Three principles, in priority order:

1. **Reputation sets the ceiling.** The Arcadia Score (via its discrete `score_tier`) defines the
   *maximum* capacity a trader may ever hold. Capacity is a function of earned trust, not personal
   wealth.
2. **The market sets the allocation.** Investors decide, vault by vault, how close to that ceiling a
   trader actually gets. The protocol never forces a trader to lock personal capital to be funded.
3. **A small alignment bond, not capital lockup.** The trader maintains a committed bond
   (`trader_shares`) that guarantees skin in the game *and can be slashed*. It proves commitment
   without requiring "Stake = capacity".

## Definitions

| term | meaning |
|------|---------|
| `capacity_cap_usd` | maximum deployable **investor** AUM. Excludes `trader_claimable`. Trader co-invest counts *against* the cap. |
| `band(score_tier)` | = `TIER_BAND_USD[score_tier]`, the capacity upper bound for a tier, fixed in the contract. |
| `effective_cap` | = `band(score_tier)` — a pure integer lookup, no on-chain ramp. |
| bond | the trader's committed `trader_shares` (existing `TraderProfile.trader_shares`). Must be slashable. |
| `score_tier` | `0..=4`, written by the oracle the same way it writes nested capacity facts today. `NOT_FUNDABLE_TIER (255)` → capacity 0. |

## Rules

- **No admin-set USD cap.** `set_capacity` no longer accepts a free-form `cap_usd`. The oracle
  supplies objective facts (`score_tier`); the contract maps tier → capacity with a pure lookup.
- **Ceiling is investor AUM, not total AUM.** `capacity_base` used in the deposit check must
  subtract `trader_claimable` (the trader's own profit shares) so the trader's own position never
  inflates the ceiling. This is already the case post-F-03; keep it invariant under the redesign.
- **Track record lives in the Score, not the chain.** No on-chain ramp. The ramp isn't removed —
  it is **moved into the Score**. The scoring engine adds a **track-record-duration term** to its
  Confidence factor so that reaching a top tier already requires months of spread-out, verified
  history. A wash-trader can fake trade *count* but not trade *time*. The trader is never told "wait a
  bit longer to unlock capacity" on-chain; the months spent earning the tier are the unlock. An
  on-chain ramp layered on top would double-penalize legitimate traders — rejected.
- **Residual risk, stated honestly:** the Score grades the trader's *own* history, not their skill
  managing others' capital. Observing that requires giving capital (chicken-and-egg), so no on-chain
  rule can fully cover it. Accepted by design; a ramp never closed this gap either.
- **Bond must be at risk.** A drawdown past a threshold (default −30% from `hwm_per_share`) slashes
  a share of the bond. Without a slashing rule the "bond" is just an entry fee — it fails principle 3.
- **Deterministic and transparent.** The oracle provides data; the contract is the single source of
  truth for `capacity_cap_usd`. No off-chain admin override, so the number is auditable on-chain.

## Anti-wash lives in the Score, not the chain

Wash trading is a *scoring* problem, so it is solved where the problem exists. The existing wash
detector (`server-rs/crates/core/src/classify.rs`) is currently **not wired into the Score** — it only
labels profiles in a demo API route. It must become a real input.

- **Guard = 1.0 for clean traders.** The wash verdict feeds the **Guard** factor of
  `Score = Quality × Confidence × Guard`, as a *multiplicative* penalty (not a flat point subtraction,
  which would distort Quality weighting). As suspicious behavior accumulates, Guard drops below 1.0 and
  the final score scales down proportionally.
- **Hard gate for severe/repeated wash.** When wash signals cross a threshold, the engine writes
  `score_tier = NOT_FUNDABLE_TIER` (255) — the trader becomes unfundable until they rebuild a clean
  history. Intermediate severity caps the maximum achievable tier.
- Because wash and track-record are both baked into the Score, `score_tier → capacity_band` stays a
  simple deterministic mapping, and the scoring engine is the single source of truth for trust.

## Parameter table (final — confirmed by owner)

| tier | band (max investor AUM USD) |
|:----:|:---------------------------|
| 0 | 25,000 |
| 1 | 100,000 |
| 2 | 250,000 |
| 3 | 500,000 |
| 4 | 1,000,000 |
| 255 | 0 |

Contract constants:
- **No ramp.** Capacity deploys at full band on tier earn. The time/trade-count proof lives in the
  scoring engine's Confidence factor (see `docs/scoring-engine.md`), not in the contract.
- Slash: drawdown ≥ 30% from HWM → convert 50% of `trader_shares` to liquidate-able (sweep to base).

## On-chain shape

No new `TraderProfile` fields needed for capacity. `set_capacity.rs` becomes a stateless lookup:

```
fn effective_cap(score_tier) -> u64 {
    if score_tier == NOT_FUNDABLE_TIER { return 0 }
    TIER_BAND_USD[score_tier]
}
```

Deposit check reads `effective_cap(...)` a pure function — no stored `capacity_cap_usd` drift between
oracle writes, no `days_active`/`trade_count` on-chain state.

## Scope notes (open TODOs, not in first cut)

- Traffic-light announcement of capacity to the frontend (`app/lib/arcadia-sdk.ts` / IDL are
  hand-generated — update both manually).
- Scoring engine — trust gates, off-chain (trace `server-rs/crates/scoring/`):
  1. **Wash → Guard:** make `classify`'s `WashVerdict` an input to the **Guard** factor
     (multiplicative penalty, clean = 1.0). Currently dead code from the Score's perspective — it only
     labels profiles via `routes.rs:42`/`routes.rs:650`; `crates/scoring/**` never references it.
  2. **Hard gate:** severe/repeated wash → `score_tier = NOT_FUNDABLE_TIER`; intermediate → cap max tier.
  3. **Duration term:** add track-record duration to the Confidence factor (currently a logistic over
     `trade_count` only) so a top tier requires spread-out calendar time, not brute force. This is the
     "ramp" — it lives in the Score.
- Note: `classify.rs` declares `total: 4` wash signals but only W1 and W4 are implemented; W2/W3 are
  open work under the wash → Guard item.

## References

- `arcadia_vault/programs/arcadia_vault/src/constants.rs` — `tier_bps` (leverage table; keep separate
  from capacity band so the two don't silently couple).
- `arcadia_vault/programs/arcadia_vault/src/instructions/admin/set_capacity.rs` — today writes a
  free-form `cap_usd`; becomes a pure compute.
- `arcadia_vault/programs/arcadia_vault/src/state.rs` — `TraderProfile` carries `trader_shares`,
  `hwm_per_share`, `score_tier`, `trader_claimable` needed for the above.