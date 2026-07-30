# Arcadia Scoring Engine

## What is it?

The scoring engine is the **trust system** of Arcadia. It looks at a trader's history (trades, profits, losses, liquidations) and gives them a **score from 0 to 1000**. This score decides:

- **Their reputation tier** (Verified → Apex)
- **Their capacity multiplier** (1× → 10×) — how much capital they can manage relative to their own stake
- **What profit share they earn** (20% → 40%)

Every new trader starts at **score 100** — you belong here from day one.

---

## How does it work — the 4-step pipeline

The engine runs 4 steps, one after another:

```
Equity Curve + Trades  → ① TWR  → ② Metrics  → ③ Score  → ④ Capacity
```

### Step 1: TWR (Time-Weighted Return)

**What it does:** Builds a clean performance curve of the trader's returns, removing the effect of deposits and withdrawals.

**Why:** If a trader adds $10k to their vault, their balance goes up — but that's not trading skill. TWR strips that out so only *actual trading performance* shows.

**Output:** A list of daily return percentages (e.g., +0.5%, -0.2%, +1.1%...).

---

### Step 2: Metrics

**What it does:** Takes the daily returns and calculates standard financial metrics.

**The metrics (and what they measure):**

| Metric | What it measures | Why it matters |
|--------|-----------------|----------------|
| **Sharpe Ratio** | Return vs total volatility | Classic risk-adjusted return |
| **Sortino Ratio** | Return vs *bad* volatility only | Focuses on downside risk |
| **Calmar Ratio** | Return vs max drawdown | How well you recover from losses |
| **Max Drawdown** | Biggest peak-to-trough loss (%) | Worst-case scenario |
| **Ulcer Index** | How deep/long drawdowns last | How painful the ride is |
| **Volatility** | How wild the returns are | Stability |
| **Liquidation Rate** | % of trades that got liquidated | Risk of blowing up |
| **Win Rate** | % of profitable trades | Consistency |
| **Avg Leverage** | Average leverage used | Risk appetite |

---

### Step 3: Score (the main formula)

**The formula:**

```
Score = Q × C × G
```

#### Q — Quality

Each metric from step 2 is **normalized** to a score of 0–100 (higher = better). Then they are **weighted and combined**:

| Metric | Weight |
|--------|--------|
| Sharpe Ratio | 25% |
| Sortino Ratio | 20% |
| Max Drawdown | 15% |
| Calmar Ratio | 15% |
| Volatility | 10% |
| Downside Deviation | 10% |
| Mean Return | 5% |

The combined score is multiplied by 10 to get a raw quality score from **0 to 1000**.

#### C — Confidence

A trader with 5 trades is less trustworthy than one with 500. Confidence is a **logistic curve** that grows with trade count:

- At 0 trades → confidence ≈ 0.17
- At ~200 trades → confidence = 0.5
- At 500+ trades → confidence ≈ 0.92

The curve has been tuned so that new traders see meaningful scores faster. Combined with the 100-point floor, everyone starts with value.

#### G — Guard Factor (safety penalties)

Hard penalties kick in when a trader crosses danger thresholds:

- **Liquidation rate > 5%** → score starts dropping
- **Max drawdown > 30%** → score starts dropping

These factors multiply the score down (to as low as 0) if the trader is too risky.

#### Final Score

Multiply all three: `Score = Q × C × G`, then **clamp between 0 and 1000**.

Scores below 100 are **floored to 100** — giving new traders a positive starting point.

A **95% confidence interval** is also computed to show the range the "true" score likely falls in.

---

### Step 4: Capacity (how much capital a trader can manage)

Capacity is simple: **your own stake × your tier multiplier**.

```
capacity = trader_shares × multiplier
```

No more exponential formulas. The multiplier grows with your tier:

| Tier | Score | Multiplier |
|------|-------|-----------|
| Verified | 100–249 | 1× |
| Established | 250–499 | 2× |
| Advanced | 500–749 | 3× |
| Elite | 750–949 | 5× |
| Apex | 950–1000 | 10× |

Example: A trader with $5,000 of their own capital at **Advanced** tier (3×) can manage up to **$15,000**.

---

## Tiers and Profit Share

| Tier | Score Range | Multiplier | Profit Share |
|------|------------|-----------|-------------|
| Verified | 100–249 | 1× | 20% |
| Established | 250–499 | 2× | 25% |
| Advanced | 500–749 | 3× | 30% |
| Elite | 750–949 | 5× | 35% |
| Apex | 950–1000 | 10× | 40% |

Every trader gets a tier from day one. There is no gate.

---

## How the Score Gets Updated (Background Worker)

A background worker runs periodically:

1. Fetches all active traders from the database
2. For each trader, pulls their equity curve and trade history
3. Runs the 4-step scoring pipeline
4. Computes capacity: `trader_shares × multiplier`
5. Saves a `score_snapshot` to the database
6. Updates the trader's capacity and tier

---

## Architecture notes

- The scoring engine is **pure Rust** — no I/O, no database calls. It takes data in and returns a score.
- The multiplier is computed by the engine; the USD capacity is computed by the worker.
- It lives in the `arcadia-scoring` crate at `server-rs/crates/scoring/`.
- The background worker lives in `arcadia-workers` and calls the engine.
- The frontend displays the score using a circular dial component (`ScoreDial.tsx`) and a history chart (`ScoreHistoryChart.tsx`).

---

## Summary

```
Raw trading data  →  TWR (strip cash flows)  →  Metrics (Sharpe, Sortino, etc.)
→  Score = Quality × Confidence × Guard (floored at 100)
→  Capacity = trader_shares × multiplier
→  Tier + profit share assigned
```

The scoring engine is the **reputation layer** of Arcadia. The better you trade, the higher your score climbs, the more capital you unlock.
