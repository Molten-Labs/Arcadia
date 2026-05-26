# Arcadia

A Solana managed trading protocol where Traders prove themselves with their own capital before managing investor funds, enforced by a three-tranche vault architecture with deterministic loss waterfalls.

## Language

### Actors

**Trader**:
A person who creates and manages a Vault. Deposits Junior Capital, executes trades, earns performance fees.
_Avoid_: Manager, fund manager, portfolio manager

**Senior Investor**:
A person who deposits capital into a graduated Vault's Senior tranche. Receives a target floor yield, protected by Junior and Mezzanine loss buffers. Can exit anytime with 24h cooldown (instant when Junior health < 20%).
_Avoid_: Lender, depositor

**Mezzanine Investor**:
A person who deposits capital into a mature Vault's Mezzanine tranche. Receives residual yield above the Senior floor rate, absorbs losses before Senior. Subject to 30-day lockup per deposit.
_Avoid_: Middle investor, tier-2 investor

### Capital Tranches

**Junior Capital**:
The Trader's own capital deposited into a Vault. First to absorb trading losses. Measured in USDC. Must be at least a tier-based percentage of Target Vault Size before investor deposits are accepted. Never grows from trading profits — Trader upside comes only from performance fees.
_Avoid_: Skin in the game (marketing term), first-loss buffer (imprecise), Trader deposit

**Junior Shares**:
Ownership units representing the Trader's claim on Junior Capital. Non-transferable. Changes only on deposit/withdraw.
_Avoid_: Trader tokens, LP tokens

**Senior Capital**:
Aggregate investor capital in the Senior tranche. Last to absorb losses (after Junior and Mezzanine are wiped). Eligible for target floor yield from settlement profits.
_Avoid_: Delegated capital, investor funds, protected capital

**Senior Shares**:
Aggregate ownership units across all Senior Investors. Pro-rata claim: individual Senior Shares / Senior Shares Outstanding × Senior Capital.
_Avoid_: Investor tokens

**Mezzanine Capital**:
Aggregate investor capital in the Mezzanine tranche. Second to absorb losses (after Junior, before Senior). Receives residual yield above Senior floor rate.
_Avoid_: Middle capital, tier-2 buffer

**Mezzanine Shares**:
Aggregate ownership units across all Mezzanine Investors. Lock tied to the position (deposit date + 30 days), not the share itself.

**Senior Shares (per-investor)**:
One specific Senior Investor's ownership units. Stored in InvestorPosition account.

**Mezzanine Shares (per-investor)**:
One specific Mezzanine Investor's ownership units.

### Vault

**Vault**:
A managed trading vehicle created by a Trader. Has a lifecycle, a three-tranche capital structure, and a treasury holding USDC plus optionally other SPL tokens. Defined by its VaultConfig (static) and VaultState (mutable).
_Avoid_: Fund, pool, strategy, portfolio

**Target Vault Size**:
The total capital capacity the Trader aims to manage. Set at creation, mutable upward only with matching Junior deposit.

**Mezzanine Capacity**:
Percentage of Target Vault Size allocated to the Mezzanine tranche. Set at creation (10-40%), immutable after graduation.

**Vault Treasury**:
The Vault's USDC account. Primary capital store. Subject to the 20% liquidity floor.

**Token Treasury**:
A lazily-created SPL token account for a non-USDC asset. Created on first swap into the asset, closed when balance reaches zero.

**Protocol Treasury**:
Single global PDA receiving Arcadia's 0.2% withdrawal fees. Controlled by 3-of-5 multisig.

**Vault Share Price**:
`total_vault_NAV / total_shares_outstanding`. Same price for all tranches — Senior and Mezzanine differ in yield distribution (settlement), not share price.

### Lifecycle

**Paper Mode**:
Self-funded proving phase. 30 days (configurable). No investor deposits. Trading with Junior Capital only.

**Active**:
Operational state after graduation. Senior deposits open. Trading enabled.

**Cooldown**:
Temporary trading pause from loss velocity. Deposits paused, withdrawals open. Duration: 2h / 24h / 72h based on severity.

**Mature**:
Sub-state of Active. Mezzanine tranche opens. Requires 90 days of Active, Junior health >= 60% throughout, TVL >= $200K, no freeze.

**Frozen**:
Terminal state. Junior Capital = 0 post-graduation. Trading permanently disabled. Recovery waterfall: Senior whole first, Mezzanine from remainder.

**Closed**:
Terminal state. Trader-initiated voluntary wind-down. All positions closed, capital returned. Clean exit.

**Expired**:
Paper window elapsed with unmet graduation conditions. Trading disabled.

### Metrics

**NAV (Net Asset Value)**:
Total vault value in USDC. Computed on-chain during `update_nav` for settlement/guards, estimated off-chain for display.

**Junior Health**:
`junior_capital / original_junior_deposit x 100`. Determines position limits, cooldown thresholds, emergency exit trigger, and freeze trigger.

**HWM (High Water Mark)**:
Highest ever recorded vault share price. Fee claims only when current share price exceeds HWM. Per-share (not per-NAV), so new deposits are neutral.

**Senior Floor Rate**:
Annualized target yield for Senior Investors, paid from 80% of profits after performance fee. Set at vault creation (4-7%), immutable after graduation. Displayed as "target" — not guaranteed.

**Performance Fee**:
20% of gains above HWM, paid directly to Trader's wallet as USDC. Exits the vault entirely.

**Liquid Reserve Rule**:
At least 20% of vault NAV must remain as USDC in the Vault Treasury at all times.

### Settlement

**Settlement**:
Event triggered by Trader calling `claim_fees`. Calculates fee above HWM, pays Trader, credits Senior floor rate, distributes residual to Mezzanine as additional shares, advances HWM.

**Loss Waterfall**:
When NAV decreases: Junior Capital absorbs loss first, then Mezzanine Capital, then Senior Capital. Strict sequential order, never proportional.

**Recovery Waterfall**:
When capital is distributed (freeze or close): Senior made whole first, then Mezzanine from remainder, then Junior last. Inverse of loss waterfall.

### Positions

**Investor Position**:
A record of one investor's stake in one vault tranche. Contains shares, deposit timestamp, and (for Mezzanine) lockup expiry. Separate accounts for Senior and Mezzanine.

**Senior Shares Outstanding**:
Total Senior Shares across all Senior Investors.

**Mezzanine Shares Outstanding**:
Total Mezzanine Shares across all Mezzanine Investors.

**Trader Profile**:
On-chain identity record for a Trader. Contains aggregated statistics: total Junior deposited, vaults created/graduated/frozen/closed, personal PnL (fees earned minus Junior lost to freeze), reputation score, and tier.

## Flagged Ambiguities

- **"Manager"** appears in deployed PDA seeds (`b"manager"`, `ManagerProfile`) — code predates canonical "Trader" decision. On-chain migration required.
- **"Kiln"** and **"Port Protocol"** appear in legacy docs, program comments, and client SDK name — all obsolete. Canonical name is Arcadia.

## Example Dialogue

**Dev**: "When an investor deposits Senior Capital into a vault, what happens to the HWM?"
**Domain Expert**: "Nothing. The HWM is per-share price, not per-total-NAV. New deposits mint shares at the current price, so the share price stays flat and HWM is unchanged."

**Dev**: "What happens if a vault is in Cooldown and Junior Capital hits zero?"
**Domain Expert**: "The vault transitions to Frozen immediately. Cooldown ends. Withdrawals open. Recovery waterfall: Senior made whole first, then Mezzanine from what remains. Junior is zero. Permanent and irreversible."

**Dev**: "Can a Mezzanine Investor withdraw during a Cooldown?"
**Domain Expert**: "If their 30-day lockup has elapsed — yes, with the standard 24h cooldown. If within lockup — no, cannot withdraw under any circumstance other than vault Freeze or Close. Emergency instant exit only applies to Senior withdrawals."
