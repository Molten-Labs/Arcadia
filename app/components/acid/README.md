# Acid Graphic primitives

Signature building blocks for the Arcadia "Acid Graphic" system (liquid chrome +
techno-surrealism, dark-only). Aggressive skin, readable core.

Import from the barrel:

```tsx
import {
  ChromeText, AcidButton, ChromeButton, BlobCard, Marquee,
  Reveal, CountUp, ScoreDial, NoiseOverlay, DriftBlobs,
} from "@/components/acid";
```

Design tokens live in `app/globals.css` (`@theme` block + `:root` mirror).
Pull colors from tokens (`bg-acid`, `text-ink`, `var(--color-pink)` …) — never
hardcode hex in composed pages.

All motion is disabled under `prefers-reduced-motion`: CSS via the `.acid-animate`
/ media-query guards in globals, JS via `usePrefersReducedMotion`.

---

## ChromeText
Liquid-chrome gradient text. Server component.

| prop | type | default | notes |
|------|------|---------|-------|
| `as` | `ElementType` | `"span"` | tag to render |
| `aberration` | `boolean` | `false` | RGB-split ghosts (string children only) |
| `className` | `string` | — | |

```tsx
<ChromeText as="h1" aberration className="text-8xl font-display">PROVE</ChromeText>
```

## AcidButton / ChromeButton
Signature CTA. Real `<button>` (or any element via `asChild`).

| prop | type | default |
|------|------|---------|
| `variant` | `"acid" \| "chrome" \| "ghost"` | `"acid"` |
| `size` | `"default" \| "sm" \| "lg"` | `"default"` |
| `asChild` | `boolean` | `false` |
| …native button props | | |

`ChromeButton` = `<AcidButton variant="chrome" />`. Hover lifts + neon-glows with
expo-out easing; chrome label uses `mix-blend-difference`.

```tsx
<AcidButton>Prove yourself</AcidButton>
<ChromeButton asChild><a href="/leaderboard">Browse the proven</a></ChromeButton>
```

## BlobCard
Amoeba card with a breathing asymmetric radius, iridescent gradient border, and a
solid inner panel. Client component.

| prop | type | default |
|------|------|---------|
| `radius` | `"organic" \| "soft" \| "blob"` | `"organic"` |
| `className` | `string` | — | outer (border) layer |
| `innerClassName` | `string` | — | inner panel |
| `children` | `ReactNode` | — |

```tsx
<BlobCard radius="soft" innerClassName="p-6">…content…</BlobCard>
```

## Marquee
Seamless infinite scroll (track duplicated, translated -50%). Client component.

| prop | type | default | notes |
|------|------|---------|-------|
| `speed` | `number` | `30` | seconds per loop |
| `direction` | `"left" \| "right"` | `"left"` | |
| `rotation` | `number` | `0` | degrees — for the diagonal acid band |
| `pauseOnHover` | `boolean` | `true` | |
| `className` / `trackClassName` | `string` | — | |

```tsx
<Marquee speed={26} rotation={-4} className="bg-acid text-void">
  <span className="px-6 font-display">PROOF REPLACES PROMISES //</span>
</Marquee>
```

## Reveal
Fade + translate-in on first scroll into view (fires once). Client component.

| prop | type | default |
|------|------|---------|
| `delay` | `number` (ms) | `0` |
| `y` | `number` (px) | `28` |
| `className` | `string` | — |

```tsx
<Reveal delay={80}><h2>Section</h2></Reveal>
```

## CountUp
Counts 0 -> `value` (rAF, ease-out-cubic) on scroll-in. Tabular monospace.
Client component.

| prop | type | default |
|------|------|---------|
| `value` | `number` | — |
| `duration` | `number` (ms) | `1600` |
| `decimals` | `number` | `0` |
| `prefix` / `suffix` | `string` | `""` |
| `className` | `string` | — |

```tsx
<CountUp value={387} prefix="$" suffix="K" />
```

## ScoreDial
SVG circular gauge; arc fills violet -> cyan -> acid on scroll-in with a count-up
center + optional tier ring. Client component.

| prop | type | default |
|------|------|---------|
| `value` | `number` | — |
| `max` | `number` | `1000` |
| `size` | `number` (px) | `220` |
| `tier` | `"verified" \| "established" \| "advanced" \| "elite"` | — |
| `label` | `string` | `/ {max}` |
| `className` | `string` | — |

```tsx
<ScoreDial value={912} tier="elite" size={260} />
```

## NoiseOverlay
Fixed full-screen SVG film grain. Static, `pointer-events:none`, `aria-hidden`.
Server component. Render once near the page root.

| prop | type | default |
|------|------|---------|
| `opacity` | `number` | `0.07` |
| `className` | `string` | — |

## DriftBlobs
Fixed background layer of large blurred drifting blobs (GPU transforms). Client
component. Sits at `z-0`; wrap page content in `relative z-10`.

| prop | type | default |
|------|------|---------|
| `className` | `string` | — |

```tsx
<DriftBlobs />
<main className="relative z-10">…</main>
```

## Interaction vocabulary (CSS utilities in globals.css)

Shared hover language so every surface across the app feels the same. All
three are hover-capability gated (`@media (hover: hover)`) and reduced-motion
safe centrally - consumers need no extra guards.

| class | what it does | where to use |
|-------|--------------|--------------|
| `acid-int` | lift 3px + acid border tint + glow on hover/focus-within | cards/tiles that link somewhere or hold actions |
| `acid-sheen` | one diagonal light sweep across the surface on hover | showcase cards only (hero tiles, CTA panels); pair with `acid-int` |
| `acid-bar` | light sweep across a progress FILL when the enclosing Tailwind `group` is hovered | the fill span inside bars, in a `group` card |

```tsx
<article className="group acid-int rounded-xl border border-line bg-panel ...">
  ...
  <span className="acid-bar block h-full bg-acid" style={{ width: "42%" }} />
</article>
```

Rows in tables/lists: keep it lighter than `acid-int` - `transition-colors
hover:bg-white/[0.03]` plus sharpening key text to `text-ink`. Dense work
surfaces (the terminal) get border highlights only, no lifts.
