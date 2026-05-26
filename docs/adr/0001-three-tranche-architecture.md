# Three-Tranche Capital Structure Over Two-Tranche

We chose a three-tranche vault architecture (Junior -> Mezzanine -> Senior) instead of the simpler two-tranche model (Junior -> Senior).

## Context

The original codebase had a two-tranche structure: Junior Capital (Trader skin-in-the-game) and Senior Capital (Investor capital). The canonical design was revised to include a Mezzanine tranche that opens after 90 days of proven operations.

## Decision

Three tranches: Junior (Trader, first-loss, performance fees only), Mezzanine (mature investors, 30-day lockup, residual yield), Senior (base investors, target floor rate, anytime exit).

## Reasoning

A two-tranche model forces all investors into the same risk/yield profile. The Mezzanine tranche gives the vault a second buffer layer that grows organically as the vault proves itself — without requiring the Trader to lock additional personal capital. This deepens protection for Senior investors as the vault matures.

## Consequences

- PDA seeds, account layout, and instruction dispatch must change from the deployed two-tranche program
- Share price calculation becomes share-class-aware (one vault share price, different yield distribution per tranche)
- Maturity conditions (90 days, Junior health >= 60%, TVL >= $200K, no freeze) gate Mezzanine access
- Withdrawal rules diverge by tranche: Senior gets emergency instant exit, Mezzanine does not

## Rejected Alternatives

**Keep two-tranche, add yield tiers within Senior**: Would conflate risk protection with yield preference — adding priority tiers within a single tranche is a Mezzanine tranche by another name with needless complexity.

**Unlimited tranches**: Generalizes the model but adds unbounded complexity for marginal benefit. Three tranches cover the three investor archetypes.
