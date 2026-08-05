# Imported Track Record (Future Feature — Design Plan)

**Status:** proposed / not implemented
**Owner:** TBD
**Sources of truth for the scoring model:** `docs/scoring-engine.md`, `server-rs/crates/scoring/src/metrics.rs`

> This is a forward-looking plan. Nothing here is built yet. The goal is to capture the
> design decisions we converged on so implementation can proceed without re-litigating them.

---

## 1. What is it?

New traders join Arcadia with **zero Arcadia history** (`metrics::compute` returns `zero`
when there are no trades, and the score is floored at 100). The protocol's promise is to
route capital to *skilled* traders — but a genuinely skilled trader with years of history
elsewhere has no way to prove it on Arcadia.

This feature lets a trader **import their on-chain trading history from other protocols**
(and eventually other chains), so their profile reflects a real — but honestly-labeled —
prior track record instead of a blank slate.

Acceptance criteria:
- A trader proves ownership of an external wallet and imports its history.
- The profile can display that imported history (equity curve, aggregate PnL, spot round-trips).
- The imported data feeds the **same** scoring pipeline as native trades, without making
  an imported track look falsely pristine (no fabricated leverage/liquidation data).
- UI surfaces imported history as a **grid inside the portfolio page** (not a separate page
  or tab).

---

## 2. Why Zerion (decision)

Arcadia's scoring data today is **self-indexed** (`equity_point` rows + `vault_trade` rows
produced by Arcadia's own on-chain indexer from vault trades). For *native* data no external
provider is needed and none is used.

Imported history is the one case where the data lives **outside** Arcadia's indexer, so an
external source is required.

**We chose Zerion** because a **multi-chain roadmap** is on the table. Zerion's wallet API is
chain-agnostic (positions, daily charts, PnL, and transactions for an arbitrary wallet across
EVM chains and, on the roadmap, Solana). A Solana-only source (Helius DAS / self-indexing the
connected wallet) would be cheaper and more sovereign but would have to be re-platformed the
moment multi-chain import ships — a stopgap, which we reject.

Trade-off accepted: Zerion adds a third-party dependency and an API-key/cost surface that only
exists for this feature.

---

## 3. Data mapping — what Zerion can and cannot supply

The scoring engine consumes two inputs (`metrics::compute(equity_curve, trades)`):

### 3.1 Equity curve — FULL fidelity

From `GET /v1/wallets/{address}/charts/day`:
`attributes.points` is an array of `[unix_ts, usd_value]`. This is a daily wallet-value series.

We normalize it like the native path: start NAV at `1.0` and compound daily value changes into a
TWR NAV curve. This single input drives the highest-weight score components:
Sharpe, Sortino, Max DD, Calmar, Volatility, Downside Deviation, Mean Return
(~90% of the Quality weights in `docs/scoring-engine.md`).

### 3.2 Aggregate PnL & fees — FULL fidelity

From `GET /v1/wallets/{address}/pnl`:
`realized_gain`, `unrealized_gain`, `total_fee`, `realized_cost_basis`, plus a breakdown by
token/implementation with `average_buy_price` / `average_sell_price`.

### 3.3 Per-trade records — PARTIAL, and only for spot

`metrics::compute` needs per-closed-trade fields. Mapping against Zerion's responses:

| Engine needs | In Zerion? | Note |
|---|---|---|
| `realized_pnl` (per trade) | **No** | only aggregate; must reconstruct by pairing buys/sells |
| `fees_usd` | Yes | `transactions[].fee.value` |
| `opened_at` / `closed_at` | Yes | `mined_at` (single ts; open/close from pair matching) |
| `market` | ~ | map `fungible` address → market string |
| `size_usd` | ~ | transfer `value` (spot only) |
| `direction` | ~ | transfer direction (spot only) |
| `signature` | Yes | `hash` |
| **`leverage_x`** | **No** | not exposed |
| **`was_liquidated`** | **No** | not exposed |

**Consequence:** imported history is **spot-only**. Leverage and liquidation events — critical to
the native score via `liq_rate` (Guard Factor) and `avg_leverage` — are unknowable from Zerion's API
for an EVM wallet feed. We must NOT fabricate them.

---

## 4. Scoring approach (decision)

Follow the user's direction: **"import it like a normal score"** — one unified score, same
formula, no discounting track, no 0.N multiplier, no maturity-decay mechanism.

- Imported data seeds the same pipeline as native data. Since scoring runs continuously on an
  accumulating feed, native vault data naturally dilutes the import over time and the score
  converges on real Arcadia truth without any extra mechanism.
- **No fabricated trade features:** we never synthesize `was_liquidated=false` or
  `leverage_x=1.0` for imported trades, because a real perps trader with liquidation history
  would otherwise score as a pristine spot trader.
- Imported track record is **wallet-verified on-chain** (the trader signs a proof of ownership
  of the imported wallet via SIWS), so it is trusted at par.

### This requires a small scoring-engine change

`metrics::compute` currently returns `Metrics::zero()` whenever `trades.is_empty()`
(`metrics.rs:82-84`). Imported tracks need an **equity-curve-only mode** that still computes
returns/risk (Sharpe, Sortino, Max DD, etc.) from the curve without fabricating trade-level
features. Trade-derived fields (`liq_rate`, `avg_leverage`, `win_rate`, `wash`) should be
explicitly **unset / marked unknown**, never silently zero.
This is a TODO for implementation and the one code touch outside the new feature module.

---

## 5. UI — grid in the portfolio (decision)

Per the user: imported history is shown as a **grid embedded in the portfolio page**, not a
separate tab, page, or sidebar.

Desired grid content (sourced from the data above):
- Imported wallet equity curve (mini chart via the existing `NavHistoryChart`/`EquityChart` patterns).
- Aggregate realized / unrealized PnL and total fees.
- Track-record duration / `months_active`.
- Per-token breakdown (symbol, avg buy / avg sell, realized gain) from `/pnl.breakdown`.
- A clear **"Imported track record — spot-only, no leverage/liquidation data"** callout so
  viewers (investors deciding to allocate) don't confuse it with native Arcadia performance.

Components to reuse: `app/components/ui/table.tsx`, `app/components/ui/card.tsx`,
`app/components/NavHistoryChart.tsx`, `app/components/EquityChart.tsx`.
Frontend proxy pattern: `app/app/api/v1/*` routes proxying to `$BACKEND_URL` with mock fallback
in `app/lib/mock-data.ts`.

---

## 6. Proposed architecture (sketch)

- **New Rust crate / module** (e.g. `arcadia-import`) in `server-rs/crates/`:
  - Zerion client (authenticated HTTP, cursor-paginated `/transactions`).
  - Normalizer: `/charts/day` → `(day, twr_nav)` equity points; `/pnl` → aggregate stats;
    transaction stream → spot round-trip reconstruction per fungible.
  - Write imported rows to DB (`equity_point`-style + a new `imported_trade` /
    `imported_track` table keyed on the proven wallet).
  - Idempotent: import once, then only pull deltas on re-import.
- **Frontend:** a `transform*` helper in `app/lib/backend-transform.ts` maps the new DTO to the
  portfolio grid.
- **Backend route:** e.g. `POST /v1/wallets/import` (prove ownership) + `GET /v1/wallets/{addr}/imported`.
- **Security:** wallet ownership proof via SIWS before any import writes data; rate-limit and
  cache the cost-heavy backfill.

---

## 7. Scope boundaries

IN:
- Import on-chain wallet history from another protocol (spot), via Zerion.
- Unified scoring with an equity-curve-only mode.
- Grid UI in the portfolio.

OUT (explicitly not now):
- CEX CSV import / self-reported history — unverifiable, gameable, never routed-real capital.
- Fabricated leverage/liquidation for imported data — rejected (see §4).
- Re-platforming to a non-Zerion source while Solana-only; revisit only if multi-chain is dropped.

---

## 8. Open questions (for implementation time)

1. Exact SIWS flow to prove ownership of an EVM wallet (EIP-4361 / Sign-In-With-Ethereum) vs
   the existing Solana SIWS path — one shared or two separate proofs?
2. How much of `/transactions` to decode in v1: full spot round-trip matching, or start with
   `/charts` + `/pnl` only and defer per-trade reconstruction?
3. Pagination/cost budget for backfilling long histories (rate limits, caching, staleness).

---

## 9. TL;DR

Import = prove ownership of an external wallet (SIWS) → pull its on-chain history via Zerion →
seed the **same** scoring pipeline with an equity-curve-only mode (no fabricated leverage/liq) →
show it as a **grid in the portfolio** labeled "imported, spot-only". One unified score; native
data naturally takes over as the trader trades on Arcadia.