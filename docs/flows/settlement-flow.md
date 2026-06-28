# Settlement Flow

## Trigger

Trader calls `claim_fees`. Event-driven (Trader chooses when), not scheduled.

## Preconditions

- Vault in Active or Mature state
- Current share price > HWM

## Steps

### 1. Calculate Gain
```
current_share_price = total_vault_NAV / total_shares_outstanding
gain_above_hwm = (current_share_price - HWM) x total_shares_outstanding
```

### 2. Pay Performance Fee to Trader
```
fee = 0.20 x gain_above_hwm
Transfer fee USDC from Vault Treasury -> Trader wallet
NAV decreases by fee amount
```

### 3. Compute Distributable Profit
```
distributable = gain_above_hwm - fee  (= 0.80 x gain_above_hwm)
```

### 4. Credit Senior Floor Rate
```
days = days since last settlement
senior_floor_credit = floor_rate x senior_capital x (days / 365)
actual_credit = min(senior_floor_credit, distributable)
Mint additional Senior Shares representing actual_credit
distributable -= actual_credit
```

### 5. Distribute Residual to Mezzanine
```
mezzanine_residual = distributable
Mint additional Mezzanine Shares representing mezzanine_residual
```

### 6. Advance HWM
```
HWM = vault_share_price (post-fee)
```

## Edge Cases

**No Mezzanine (pre-maturity):** Steps 4 and 5 simplify — residual stays as undesignated NAV growth.

**Distributable < Senior Floor Credit:** Senior receives partial credit. Mezzanine receives zero. Shortfall not carried forward.

**Back-to-Back Claims:** Both valid. HWM advances with each claim, so second claim only produces fees on incremental gains.

**New Capital Between Settlements:** New deposits mint shares at current share price — neutral to HWM.
