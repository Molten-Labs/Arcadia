# Withdrawal Rules by Tranche

## Senior Withdrawals

| Condition | Cooldown |
|-----------|----------|
| Normal Active/Mature vault | 24 hours |
| Junior health < 20% | Instant (emergency exit) |
| Cooldown state | 24 hours |
| Frozen vault | Instant |
| Closed state (wind-down) | Instant |

## Mezzanine Withdrawals

| Condition | Withdrawal |
|-----------|-----------|
| Within 30-day lockup | Blocked entirely |
| After lockup, normal vault | 24h cooldown |
| After lockup, Junior health < 20% | 24h cooldown (emergency exit does NOT apply) |
| Frozen vault | Instant regardless of lockup |
| Closed state (wind-down) | Instant (force-unlocked) |

## Fee Claim Gates

| State | Allowed? |
|-------|----------|
| Paper | No |
| Active | Yes, if share_price > HWM |
| Mature | Yes, if share_price > HWM |
| Cooldown | No |
| Expired | No |
| Frozen | No |
| Closed | Final settlement only |

## Emergency Instant Exit Trigger

`instant_exit_enabled = junior_health < 0.20`

Where `junior_health = junior_capital / original_junior_deposit`. Applies to Senior only.
