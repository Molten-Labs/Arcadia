# Permanent Position Privacy During Live Operation

We chose to keep Trader positions (token holdings, entry prices, swap history) permanently private during vault operation instead of using delayed public disclosure.

## Context

The original architecture proposed a 12-hour trade disclosure delay. During grilling, this was revised to permanent privacy — positions are never visible to investors while the vault is live.

## Decision

Trader positions, asset allocations, entry prices, and individual swap history are visible only to the Trader. Investors see aggregate metrics: vault NAV, Junior health, total PnL, tranche fill levels. Full trade history becomes public only after vault Close or Freeze.

## Reasoning

Even delayed disclosure enables strategy inference — a competitor can reconstruct the Trader's allocation methodology and risk management approach from disclosed trade history. The real-time safety signals (NAV, Junior health) are what actually protect investors.

Post-mortem transparency preserves accountability: a failed Trader's entire decision history is auditable, and a successful Trader's strategy is learnable only after they have chosen to end the vault.

## Consequences

- The VaultDetail page shows aggregate PnL charts, not trade-by-trade feeds
- The backend stores trade events but serves them only to the Trader's own dashboard
- The Trader Profile still shows aggregated performance (vaults graduated, total PnL, frozen count) — public and permanent

## Rejected Alternatives

**6-hour delay with progressive disclosure**: Adds complexity without meaningfully changing the strategy inference problem.

**Full real-time transparency**: Eliminates appeal to serious Traders. Any Trader with genuine alpha will not use a protocol that broadcasts their positions in real time.
