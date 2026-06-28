# Vault Lifecycle State Machine

## States

### Paper
Self-funded proving phase. No investor deposits. Trading with Junior Capital only.

**Transitions:**
- -> **Active** (graduation conditions met: window elapsed, positive PnL, minimum trades)
- -> **Expired** (paper window elapsed, conditions unmet)

### Expired
Paper window elapsed but graduation conditions not met (negative PnL, insufficient trades, or both). Trading disabled.

**Transitions:**
- -> **Active** (Trader resolves conditions and retriggers graduation)
- Stays **Expired** indefinitely (if conditions cannot be resolved)

### Active
Post-graduation operational state. Senior deposits open. Trading enabled. Mezzanine not yet open.

**Sub-states:** Mature (Mezzanine tranche open)

**Transitions:**
- -> **Cooldown** (loss velocity trigger)
- -> **Mature** (maturity conditions met)
- -> **Closed** (Trader calls `close_vault`)
- -> **Frozen** (Junior = 0)

### Cooldown
Temporary trading pause after loss velocity trigger. Deposits paused. Withdrawals open.

**Triggers:**
| Trigger | Duration |
|---------|----------|
| Single trade > 3% NAV drop | 2 hours |
| Rolling 24h > 7% NAV drop | 24 hours |
| Rolling 7d > 15% NAV drop | 72 hours |

**Transitions:**
- -> **Active** (cooldown duration elapsed)
- -> **Frozen** (Junior = 0 during cooldown)

### Frozen
Terminal failure. Junior Capital = 0 post-graduation. Irreversible. Trading permanently disabled. Withdrawals open (instant). Recovery waterfall: Senior made whole first, then Mezzanine from remainder.

### Closed
Voluntary wind-down by Trader. All positions closed, all capital returned. Clean exit. No reputation penalty.

**Preconditions:** Vault in Active/Mature state, all Token Treasuries at zero, Junior > 0.

## State Transition Diagram

```
Paper --(graduate)--> Active --(mature)--> Mature
  |                     |  |                 |  |
  |                     |  +--(close)---> Closed |
  |                     |                        |
  |                     +--(velocity)--> Cooldown-+
  |                     |                        |
  |                     +--(Junior=0)--> Frozen <-+
  |
  +--(timeout)--> Expired
                    |
                    +--(resolve)--> Active
```

## State Summary

| State | Trading | Senior Deposits | Mezzanine Deposits | Withdrawals | Fee Claims |
|-------|---------|----------------|-------------------|-------------|------------|
| Paper | Yes | No | No | Junior only | No |
| Expired | No | No | No | Junior only | No |
| Active | Yes | Yes | No | Yes (24h) | Yes |
| Mature | Yes | Yes | Yes | Yes (24h) | Yes |
| Cooldown | No | No | No | Yes (24h) | No |
| Frozen | No | No | No | Yes (instant) | No |
| Closed | No | No | No | Yes (instant) | Final only |
