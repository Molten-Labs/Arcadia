# Arcadia Marketing Video — Creative Direction & Upgrades

## Overview

This video positions Arcadia as a **category-defining capital network** where performance earns trust. The messaging avoids fear-based framing ("traders lose first") in favor of aspirational clarity ("performance earns capital").

---

## Key Creative Decisions

### 1. Reframed Hook (Not Punishment, But Opportunity)

**Before:** "Traders lose first"  
**After:** "Traders commit capital first" / "Performance earns capital"

This shift transforms the core mechanic from something that feels adversarial to something that feels credible. Traders see it as a way to scale, not as a risk.

---

### 2. Beat of Silence Between Hook Lines

**Implementation:** Frame 45-60 (0.5s silence)

```
Frame 0-45:   "Most systems rely on trust."
Frame 45-60:  (silence - emphasis moment)
Frame 60-90:  "Arcadia relies on performance."
```

This creates:
- **Authority** — the pause shows confidence
- **Impact** — the second line hits harder
- **Cinematic feel** — breathing room between ideas

---

### 3. Visual Metaphor: Capital Alignment Bars

**Location:** MechanicScene, after headline

Shows two bars:
- **Trader capital** (green, 40% width): "absorbs losses first"
- **Investor capital** (dark green, 60% width): "protected"

**Why:** Communicates first-loss protection visually without explaining it. Shows alignment structurally.

---

### 4. Value Loop Closure: "Allocate to proven traders"

**Location:** ProductScene, after marketplace UI

The video was explaining the system but not stating the outcome. This line completes the loop:

"Explore verified traders." (what you see)  
"Allocate to proven traders." (what you do)

This moves from explanation to **desired action**.

---

### 5. Wording Precision: On-Chain Native Language

**Change:**  
"Performance is **publicly verifiable**" →  
"Performance is **verifiable on-chain**"

Reason: "On-chain" is native to the audience. One word change = credibility boost with crypto-native users.

---

### 6. End Card Polish: Structured Hierarchy

**Layout:**
```
[Logo/Brand]          (top, animates first)

[Main CTA]            (center, message)

[Status]              (bottom, animates last)

[Accent bar]          (slides up from bottom)
```

This creates a **brand stamp** feeling instead of just "text on black."

---

## Scene Breakdown

### Scene 1: Hook (0-3s)
- Question posed (frames 0-3)
- First answer appears (frames 30-45)
- **Beat of silence** (frames 45-60)
- Second answer appears (frames 60-90)

**Feeling:** Institutional, thoughtful, authoritative

### Scene 2: Core Mechanic (3-12s)
- Headline: "Traders commit capital first" (frames 10-40)
- Capital alignment bars animate in (frames 40-75)
- Two supporting cards slide in staggered (frames 120-150)

**Feeling:** Clear, visual, showing structure not lecturing

### Scene 3: Product (12-20s)
- Marketplace screenshot scales in (frames 15-35)
- Two text overlays appear separately:
  - "Explore verified traders" (frames 40-70)
  - "Allocate to proven traders" (frames 50-70)

**Feeling:** Concrete, actionable, outcome-focused

### Scene 4: Close (20-27s)
- Main tagline: "Performance earns capital" (frames 0-20)
- Supporting lines appear one-by-one:
  - "Serious traders." (frames 40-60)
  - "Protected investors." (frames 55-75)
  - "One protocol." (frames 70-90)

**Feeling:** Confident conclusion, settling on the promise

### Scene 5: CTA (27-30s)
- Logo "Arcadia" at top (frames 0-15)
- "Explore live traders" in center (frames 15-35)
- "Devnet Live" status at bottom (frames 35-55)
- Accent bar slides up (frames 40-60)

**Feeling:** Professional brand stamp, not rushed

---

## Animation Vocabulary

### Spring (Default)
```
damping: 200 (no bounce, smooth)
mass: 1
```

This creates institutional feel. No playful bounce.

### Timing
- **Fade in:** 15 frames (0.5s)
- **Slide in:** 20 frames (0.67s)
- **Scale in:** 15 frames (0.5s)
- **Stagger between elements:** 30-35 frames

### Color Reveals
All color animations use `signalPrimary` (#00FFB2) as accent on entry, drawing focus.

---

## Pacing: 30-Second Twitter Cut

```
0-3s:    Hook (question + pause + answer)
3-12s:   Mechanic (headline + visual + cards)
12-20s:  Product (UI + outcome)
20-27s:  Close (tagline + supporting statements)
27-30s:  CTA (end card with spacing)
```

Total: **30 seconds**, 900 frames @ 30fps

---

## Hackathon Variant: 90-Second Cut

Extends mechanic explanation, adds Solana context, allows for longer narrative. Same creative principles applied with more breathing room.

---

## What This Avoids

❌ Over-animation (not every frame needs movement)  
❌ Generic crypto imagery (no blockchain nodes, no matrix code)  
❌ Fear messaging (no "losses" or "risk" language)  
❌ Hype tone (no exclamation marks, no degen energy)  
❌ Unclear CTAs (every action is specific: "allocate", "explore", "try")

---

## What This Delivers

✅ **Clarity:** Each scene answers one question  
✅ **Structure:** Visual hierarchy matches message hierarchy  
✅ **Credibility:** Institutional tone, on-chain language, no BS  
✅ **Action:** Three clear CTAs (explore, allocate, try demo)  
✅ **Memoryability:** One phrase sticks: "Performance earns capital"

---

## Optional: Ambient Audio

A very subtle low-frequency tone or ambient hum (without speech) creates cinematic feel. Think Apple keynote — not silence, not music, just presence.

Suggested: 40-60Hz tone, -30dB, faded in at hook, faded out at CTA.

---

## Future Enhancements

1. **Real screenshots** of /vaults, /traders, /manager from live app
2. **Live metrics** rendered into the video (TVL, trader count, etc.)
3. **Voiceover** (optional, not required — visuals + text work)
4. **Music layer** (optional, recommended for YouTube)
5. **Platform cuts:** Instagram (1:1), TikTok (9:16), LinkedIn (3:4)

---

## Rendering Instructions

### 30-Second Twitter Cut
```bash
npm run render:twitter
# Output: out/arcadia-twitter.mp4
```

### 90-Second Hackathon Cut
```bash
npm run render:hackathon
# Output: out/arcadia-hackathon.mp4
```

### All Formats
```bash
npm run build
```

---

## Brand Compliance

All colors sourced from `brand.md`:
- Primary dark: `#050816`
- Signal green: `#00FFB2`
- Text primary: `#F5F7FA`
- Typography: Outfit (display) + Poppins (UI)

Voice: Precise, calm, risk-aware. Concrete language about proof, allocation, vaults, buffers, non-custodial control.

---

## References

- Brand guide: `../brand.md`
- Remotion docs: https://remotion.dev
- Official Remotion skills: https://github.com/remotion-dev/skills
