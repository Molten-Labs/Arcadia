# Per-Share HWM Over Per-NAV HWM

We chose a per-share High Water Mark instead of tracking HWM as an absolute NAV threshold.

## Context

Performance fees are 20% of gains above HWM. A NAV-based HWM breaks when new investor deposits enter the vault mid-lifecycle — new deposits raise NAV and can falsely trigger fee eligibility.

## Decision

Track HWM as the highest-ever vault share price (`total_vault_NAV / total_shares_outstanding`), not the highest-ever total NAV.

## Reasoning

New deposits mint shares at the current share price. Deposit increases both NAV and shares proportionally, leaving share price unchanged. New capital is neutral to HWM. Only actual trading performance moves the share price.

## Consequences

- Single vault share price serves both Senior and Mezzanine tranches
- Fee claim logic: `fee = 0.20 x (current_share_price - HWM) x total_shares`

## Rejected Alternatives

**NAV HWM with deposit/withdraw rebasing**: Requires adjusting HWM on every capital event. A withdrawal at a loss could reset HWM below its true high.

**No HWM (fee on all positive NAV change)**: Trader could withdraw all investor capital at NAV low, redeposit, and immediately claim fees on the same performance.
