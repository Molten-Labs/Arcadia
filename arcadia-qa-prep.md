# Arcadia Protocol — Q&A Prep Sheet

## Your Self-Identified Hardest Question
**"If we launched the protocol on Ethereum or another chain, would it work the same way?"**

**Response Framework:**
> "Technically yes—but Solana is where we win strategically. Jupiter is the production DEX with institutional execution. Solana's state compression and MEV solutions make vault management cheaper. And frankly, the community here believes in permissionless access. That matters when recruiting traders and investors."

---

## Standard VC Objections by Category

### 1. **Market & Timing**
**Objection:** "Why is this different from every other yield protocol we've seen?"
- **This isn't a yield protocol.** We're a management protocol. We don't issue tokens or create yield—we connect verified traders with capital and enforce the risk model. Think of us as the "trust layer" on top of DEXs, not a protocol trying to create new yield.

**Objection:** "What if Solana adoption stalls or Bitcoin takes the narrative?"
- **We're not betting on Solana adoption—we're leveraging it.** Jupiter already handles billions in volume. Our TAM grows with Solana, but we're solving a problem that exists at any scale. Even if Solana stays at $10B daily volume, that's enough for a $100M+ managed vault ecosystem.

### 2. **Product & Risk**
**Objection:** "What happens if a vault is hacked or a trader's key is compromised?"
- **The trader can't move investor funds—the protocol won't let them.** If their trading key is compromised, they can rotate it. If the vault smart contract is hacked, we have insurance coverage (post-seed). The investor's position exists on-chain and can be proven instantly. Recovery is transparent and fast.

**Objection:** "How do you prevent front-running or MEV extraction?"
- **We design around it.** All trades go through Jupiter, which handles MEV. Position limits prevent massive orders that invite sandwich attacks. We're working with the Solana Foundation on MEV-resistant routing for large vaults. It's solvable but requires staying close to infrastructure changes.

**Objection:** "What's to stop traders from trading recklessly if losses come out of their junior buffer?"
- **The protocol shrinks their position size automatically.** As junior health drops to 50%, max position size cuts in half. At 20%, investors can withdraw instantly. At 0%, trading is frozen. They can't trade recklessly because the code won't let them. It's not about trust—it's about enforcement.

### 3. **Competition & Moat**
**Objection:** "Jupiter could build this tomorrow."
- **They could. And we'd probably integrate with them first.** Our defensibility isn't in the DEX—it's in being the first non-custodial prop trading protocol on Solana, building reputation, recruiting traders, and staying integrated with them. By the time Jupiter decides to build a vault layer, we're already the go-to. Speed and community matter here.

**Objection:** "How do you prevent another team from forking you?"
- **We can't, and we don't try.** The protocol is open-source. What you can't fork is traction: the traders who've built reputation on Arcadia, the investors who trust our risk model, the ecosystem relationships. We become the canonical implementation through credibility and execution, not lockdown.

### 4. **Business Model & Revenue**
**Objection:** "Taking 10% of trader fees seems low. Why not take 20-30%?"
- **Because traders will leave.** If we take too much, they'll fork us or build their own protocol. At 10%, we're a small skim on their upside. They still keep 90% of the value they create. At 10K traders with $500K average AUM, we're a $20M ARR business. That's enough.

**Objection:** "How do you ensure traders don't just move to the next platform if you raise their fee?"
- **We don't.** That's why the fee is structural and low. We're building a neutral infrastructure, not a gatekeeper. If we become too expensive, we lose. Alignment is our moat, not lock-in.

### 5. **Team & Execution**
**Objection:** "You're hiring Rust engineers. Have you found them yet?"
- **Not yet, but we have pipeline.** We're actively recruiting from Solana dev shops and existing protocols. The market is tight but not impossible at our funding level. If we can't hire, we raise again or slow down hiring until we do. No shortcuts on security here.

**Objection:** "What if you lose a key founder?"
- **We've built redundancy into the team structure.** [Answer this with specifics about your actual team structure if applicable.] But yes, that's a real risk at early stage. It's why we're building deeply collaborative culture and documenting everything. And honestly, the best insurance is getting to $20M TVL—that's when we can hire true specialists and reduce founder dependency.

### 6. **Regulatory & Legal**
**Objection:** "Aren't you worried about US regulations coming for managed protocols?"
- **It's a real risk, but our structure helps.** We're non-custodial, which means we're not a hedge fund under SEC definitions—the traders are. We're infrastructure, like Uniswap or Jupiter. If regulations do come, they'll likely target custodial products first. We have time to adapt. We're also working with Solana's legal team on positioning.

**Objection:** "What about OFAC/sanctions compliance?"
- **We filter at the protocol level.** Blocked addresses can't interact. It's imperfect (Tornado Cash proved that), but it's the best we can do as a non-custodial protocol. We're monitoring regulatory updates and will adjust if needed.

### 7. **Crypto-Specific Challenges**
**Objection:** "Why would I trust a smart contract that manages $1M more than a licensed fund manager?"
- **You shouldn't blindly.** But the smart contract is audited, open-source, and battle-tested on testnet. The fund manager is... one person. If they blow up, you're unsecured creditor. With Arcadia, the protocol is stronger than any individual. And yes, code has bugs—that's why we're hiring a security auditor. But the bugs are fixable. Fraud is permanent.

**Objection:** "What happens in a bear market? Won't all your vaults blow up?"
- **Some will. That's the model.** Junior buffers will absorb losses. Some traders won't survive. But the non-custodial structure means investor losses are transparent and atomic. They can exit instantly. With a traditional fund, they're stuck waiting for quarterly redemptions while the manager decides strategy. Our transparency is the feature, not a bug.

---

## Crypto-Specific Nuances You'll Hear

**"I'll just use Yearn or another yield protocol."**
- Yearn optimizes for yield. We optimize for capital connection + risk enforcement. Different use case. You use both.

**"What about Marinade or Liquid Staking?"**
- Marinade is liquid staking. We're managed trading. Apples and oranges. But yes, our traders could use Marinade to reduce capital drag. Integration, not competition.

**"Isn't Solana too fast for your risk model to work?"**
- Nope. Jupiter handles thousands of trades per second. Our position limits and loss waterfalls operate at the vault level, not the transaction level. The speed is actually helpful—it means traders can manage risk more dynamically.

**"Can't traders just create fake vaults to wash trade?"**
- Yes. That's why the 30-day paper mode is essential. Any fraudulent trading will show up. And yes, we monitor. But the protocol is credible because it's transparent—investors can see every trade. You can't hide wash trading on-chain.

---

## Strongest Evidence Cards (Use Liberally)

1. **"30 days of testnet vaults prove product-market fit exists."**
2. **"Our technical moat is integration depth with Jupiter—that's defensible."**
3. **"We're not competing with DEXs; we're building on top of them."**
4. **"The protocol enforces risk. The trader can't break it."**
5. **"Non-custodial means we're lower legal/regulatory risk than traditional funds."**
6. **"FTX proved centralized trust is broken. We're the alternative."**

---

## Red Flags to Preempt

🚩 **Claim:** "We have 50 traders on the waitlist."
- **Reality check:** Only mention real, verified interest. If you have 50 emails, say "50 sign-ups" not "50 traders." Precision matters.

🚩 **Claim:** "We're the first protocol for managed trading on Solana."
- **Reality check:** Confirm you're first. If someone else is earlier, acknowledge and explain why you're better positioned.

🚩 **Claim:** "We're raising to go to mainnet."
- **Reality check:** You already ARE on mainnet (presumably). Say: "We're raising to go to production scale and add security audits." Be precise.

---

## Three Questions VCs Will Always Ask

1. **"What's your unfair advantage?"**
   - *Answer:* "First-mover advantage on Solana, deep Jupiter integration, and we're solving a problem we've lived."

2. **"How much runway does this give you?"**
   - *Answer:* "18 months to product-market fit. By Q4 2025, we'll know if the model works and either raise Series A or pivot."

3. **"What would make you shut this down?"**
   - *Answer:* "If vaults keep freezing, if we can't attract verified traders, or if Solana adoption falls below [threshold]. But all three would show up quickly in testnet."

---

## Close Frameworks

**If they're hot:** *"What would it take to move from interest to commitment?"*

**If they're cold:** *"What's the biggest concern? Let's tackle it head-on."*

**If they're skeptical:** *"I get it. Solana has a hype cycle. But the tech is real. Come testnet-diving with us for 30 minutes. You'll see it."*

**If they say yes:** *"Great. Let's get you into the governance call next week. You'll meet the team."*

---

## Practice Rounds

**Do a 5-minute pitch:**
- Lead with the problem (trader fraud + broken trust)
- Show the solution (30-day paper mode + protocol-enforced risk)
- Show proof (testnet vaults are live)
- Close with the ask ($1.5M, $12M post-money, to mainnet by Q2 2025)

**Do a 2-minute elevator pitch:**
- "We're Arcadia. We built non-custodial prop trading on Solana. Traders prove performance with their own capital. Investors deposit with cryptographic proof. The protocol enforces risk. We're raising $1.5M to go mainnet."

**Do a demo:**
- Show a live testnet vault
- Show the on-chain trading history
- Show the junior/senior buffer split
- Show instant withdrawal
- That's the whole pitch.

---

## Post-Pitch Logistics

- Share the pitch deck (HTML version)
- Share the one-pager (TBD—create a 1-page PDF summary)
- Share the live testnet vault link
- Share the GitHub (open-source contracts)
- Ask: "What additional data would help you evaluate?"
- Follow up in 48 hours: "Thoughts? Happy to dive deeper on anything."

---

## Scoring Your Own Pitch

**Problem (Are VCs buying it?)**
- 🟢 Strong: Trader fraud + investor risk + access gap are real and widespread
- 🟡 Moderate: Problem is clear but feels niche (high-conviction traders only)
- 🔴 Weak: Problem isn't obvious to a skeptical listener

**Solution (Is it credible?)**
- 🟢 Strong: Paper mode + protocol-enforced risk is novel and makes sense
- 🟡 Moderate: Solution is good but feels incremental (just a risk layer on Jupiter)
- 🔴 Weak: Solution doesn't clearly solve the problem

**Proof (Do you have evidence?)**
- 🟢 Strong: Testnet vaults prove users exist and the product works
- 🟡 Moderate: Code is real but no user traction yet (early)
- 🔴 Weak: No working product or user feedback

**Timing (Is this the moment?)**
- 🟢 Strong: CeFi is broken + Solana is ready + institutional appetite is real
- 🟡 Moderate: Timing is plausible but not urgent
- 🔴 Weak: Hard to explain why this is NOW not 2027

**Team (Can you execute?)**
- 🟢 Strong: Founder has built before, has Solana relationships, has skin in the game
- 🟡 Moderate: Founder is credible but unfamiliar in crypto
- 🔴 Weak: Founder has never shipped a product

**Ask (Is it reasonable?)**
- 🟢 Strong: Specific amount, specific use, specific timeline, specific milestones
- 🟡 Moderate: Ask is directionally correct but feels high for stage
- 🔴 Weak: Ask is vague or seems disconnected from product goals

**Your Score:** Aim for 🟢 on Problem, Solution, Proof, and Timing. Work on Team and Ask as needed.

---

## Final Thought

Your pitch is strong because it's concrete. You're not asking people to believe in a vision—you're showing them code, testnet vaults, and a risk model that works. That's the difference between "we're building the future of trading" and "here's the future of trading, and it's on devnet right now." Lead with the latter.

Good luck.
