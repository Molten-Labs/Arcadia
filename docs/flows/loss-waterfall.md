# Loss Waterfall

## Rule

Losses flow **strictly sequentially**: Junior Capital -> Mezzanine Capital -> Senior Capital.

## Algorithm

```
loss = previous_nav - current_nav

if loss <= junior_capital:
    junior_capital -= loss
    return

remaining = loss - junior_capital
junior_capital = 0

if remaining <= mezzanine_capital:
    mezzanine_capital -= remaining
    return

next_remaining = remaining - mezzanine_capital
mezzanine_capital = 0
senior_capital -= next_remaining

if junior_capital == 0 and vault is Active or Mature:
    vault freezes (permanent, irreversible)
```

## Scenarios

### Scenario 1: Junior absorbs fully
```
Initial:  Junior=50K, Mezzanine=30K, Senior=120K, NAV=200K
Loss:     25K
Result:   Junior=25K, Mezzanine=30K, Senior=120K, NAV=175K
```
No freeze. Junior health = 50%.

### Scenario 2: Junior wiped, Mezzanine partially hit
```
Initial:  Junior=50K, Mezzanine=30K, Senior=120K, NAV=200K
Loss:     65K
Result:   Junior=0, Mezzanine=15K, Senior=120K, NAV=135K
```
Freeze triggered. Recovery waterfall applies.

### Scenario 3: Both buffers wiped, Senior hit
```
Initial:  Junior=50K, Mezzanine=30K, Senior=120K, NAV=200K
Loss:     90K
Result:   Junior=0, Mezzanine=0, Senior=110K, NAV=110K
```
Freeze triggered. Senior impaired — principal not fully recoverable.

---

# Recovery Waterfall (Freeze Distribution)

1. **Senior made whole first** (up to deposited principal)
2. **Mezzanine from remainder** (up to deposited principal)
3. **Junior last** (always zero on freeze)

---

# Gain Allocation (Settlement)

```
gain = current_nav - (HWM x total_shares)

1. Performance fee = 20% x gain -> Trader wallet (exits vault)
2. Remaining 80%:
   a. Senior floor credit (prorated annualized rate x Senior Capital x days / 365)
   b. Residual -> Mezzanine (as additional shares)
3. HWM advances to post-fee share price
```

HWM is per-share (`vault_share_price`), not per-total-NAV. New deposits are neutral.
