# Arcadia Protocol Invariants

Hard protocol-level constraints. Must hold true at all times.

## 1. Trader Never Holds Direct Custody of Investor Funds

The VaultConfig PDA is the authority of all Treasury accounts. The program signs on its behalf via `invoke_signed`.

## 2. Loss Waterfall Is Strictly Sequential

Losses flow: **Junior Capital -> Mezzanine Capital -> Senior Capital**. Never proportional. Each tranche must be fully depleted before the next absorbs any loss.

## 3. Junior Capital = 0 Post-Graduation -> Permanent Freeze

Once investor capital has entered (Active or Mature state), Junior Capital reaching zero triggers an irreversible freeze. In Paper Mode, Junior = 0 has no freeze effect.

## 4. Performance Fees Exit the Vault Entirely

Performance fees are transferred directly to the Trader's wallet as USDC. Junior Capital is never increased by fee payments.

## 5. VaultConfig Parameters Are Immutable After Graduation

Vault name, performance fee rate, Senior floor rate, max slippage, and Mezzanine capacity cannot be changed after the vault transitions from Paper to Active. Target Vault Size is the sole exception — mutable upward only.

## 6. Position Limits Derived From Junior Health Only

The Trader's maximum single-trade position size depends exclusively on `junior_capital / original_junior_deposit`. Mezzanine Capital and Senior Capital have zero influence.

## 7. Historical Performance Records Are Immutable

NAV history, trade history, freeze events, graduation status, and cooldown events are append-only. A vault's failure history is permanently visible on the Trader's public profile.

## 8. Paper Mode Vaults Cannot Accept Investor Deposits

Both Senior and Mezzanine deposit instructions must reject when `is_paper_mode == true`.

## 9. Fee Settlement Is Deterministic

Performance fee = 20% of (current share price - HWM) x total shares. No discretion. No Trader override.

## 10. Minimum 20% Liquid USDC at All Times

Post-swap Vault Treasury USDC balance must be >= 20% of total vault NAV. Enforced on every `execute_swap`.

## 11. Mezzanine Tranche Does Not Exist Before Maturity

Mezzanine deposits are blocked until all four maturity conditions are met: 90 days since graduation, Junior health >= 60% throughout, TVL >= $200K, no freeze.

## 12. Implied Gross Return Must Be Displayed At Vault Creation

The Create Vault UI must show: `Senior floor rate / (1 - performance fee rate) = minimum gross return to cover floor`.

## 13. Arcadia Withdrawal Fee Deducted Before Delivery

0.2% fee is taken from the withdrawn amount, not added on top. All yield and withdrawal amounts displayed net of this fee.
