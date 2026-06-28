# Maturity as Distinct Gate From Graduation

We chose to separate vault maturity (Mezzanine eligibility) from vault graduation (Senior eligibility) as two independent lifecycle gates.

## Context

Graduation proves the Trader can generate returns with their own capital (30-day paper window, positive PnL, minimum trades). Mezzanine was decoupled into its own lifecycle gate with stricter conditions.

## Decision

Graduation (Paper -> Active) and Maturity (Active -> Mature sub-state) are separate events. Senior deposits available after graduation. Mezzanine deposits require both graduation and maturity.

## Reasoning

Senior investors enter a vault with only the Trader's Junior Capital as loss buffer. Mezzanine investors enter a vault that has operated with real Senior investor capital for 90 days with proven health. Conflating graduation and maturity would let Mezzanine investors enter a freshly graduated vault with zero track record of managing investor capital.

## Consequences

- Vault lifecycle has two gates, not one
- Mature sub-state requires additional tracking: 90-day health measurement, TVL snapshot check
- Pre-maturity vaults operate as two-tranche (Junior + Senior), post-maturity as three-tranche

## Rejected Alternatives

**Maturity = graduation (Mezzanine opens at graduation)**: Eliminates the 90-day track record requirement. Mezzanine investors take second-loss risk against an unproven manager.

**Maturity = 90-day timer with no performance conditions**: The time gate alone is insufficient. A Trader who did nothing for 90 days with zero investors would qualify for Mezzanine despite no demonstrated ability.
