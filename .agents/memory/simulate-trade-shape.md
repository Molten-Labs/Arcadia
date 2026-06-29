---
name: Simulate trade API shape
description: Exact request/response shape for POST /v1/trades/simulate in the Rust backend and what the frontend must send.
---

## Rust SimTradeReq (server-rs/crates/api/src/simulate.rs)
```rust
pub struct SimTradeReq {
    pub profile:    String,       // vault profile pubkey (base58)
    pub market:     String,       // e.g. "SOL/USD"
    pub direction:  i16,          // 0 = long, 1 = short
    pub size_usd:   Decimal,
    pub leverage:   Decimal,      // DECIMAL MULTIPLIER e.g. 3.0 for 3×
    pub entry_px:   Decimal,
    pub exit_px:    Option<Decimal>,   // optional; server uses live Redis price
    pub opened_at:  Option<DateTime<Utc>>,  // optional; defaults to now-1h
    pub closed_at:  Option<DateTime<Utc>>,  // optional; defaults to now
}
```

**Critical:** `leverage` is a decimal multiplier (e.g. 3.0), NOT leverage_x100 (300).
The server computes `fees_usd` and `was_liquidated` — do NOT send them in the body.

## Frontend recordTrade params (use-arcadia-vault.ts)
The hook receives `leverageX100` (integer) from the trading terminal and converts:
```ts
leverage: params.leverageX100 / 100   // 300 → 3.0
```

## SimTradeRes
```rust
pub struct SimTradeRes {
    signature, oracle_signed, market, direction, size_usd, leverage,
    entry_px, exit_px, realized_pnl, fees_usd, was_liquidated,
    opened_at, closed_at, label: "devnet simulation"
}
```
The Next.js mock route (`app/app/api/v1/trades/simulate/route.ts`) also adds `simulated: true` which tells the frontend no chain transaction is needed.

## Auth requirement
The Rust handler requires a valid Bearer JWT. The `extract_wallet` helper reads `Authorization: Bearer <token>` and verifies it with `verify_jwt`. If no JWT, returns 401.

## Fee computation (Rust)
```rust
fees_usd = size_usd × leverage × 0.001  // 10 bps on notional
was_liquidated = realized_pnl < -(size_usd × 0.8)  // >80% loss of margin
```
