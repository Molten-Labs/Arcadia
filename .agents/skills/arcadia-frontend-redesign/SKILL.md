---
name: arcadia-frontend-redesign
description: Reuse for Arcadia frontend work: dark fintech UI, strict signal-green palette, converted shield logo, production QA, and no hardcoded app colors.
---

# Arcadia Frontend Redesign

Use this skill for future Arcadia UI work in the Vite React frontend.

## Brand Rules

- Product name: `Arcadia`.
- Logo: shield mark from `app/src/components/ArcadiaLogo.tsx`; use `currentColor` for inline UI and `app/public/arcadia-logo.svg` for static assets.
- Palette source of truth:
  - `--bg-primary: #050816`
  - `--bg-secondary: #0B1120`
  - `--surface: #111827`
  - `--surface-elevated: #17171D`
  - `--signal-primary: #00FFB2`
  - `--signal-hover: #5FFFC0`
  - `--signal-deep: #16C784`
  - `--text-primary: #F5F7FA`
  - `--text-secondary: #B0B0B0`
  - `--text-muted: #7C7C84`
  - `--danger: #FF4D6D`
  - `--warning: #C8A75B`

## Typography

- Display/hero: `Outfit`.
- UI/body: `Poppins`.
- Numbers/labels: `IBM Plex Mono`.
- Scale: H1 40-48px, H2 32-36px, H3 24-28px, body 16-18px, small 12-14px.

## UI Rules

- Use tokenized Tailwind classes only; no page-level hardcoded colors.
- Prefer matte panels, subtle borders, and sparse signal-green glow.
- Buttons/tabs use 8px radius; panels use 8-12px.
- Avoid purple/lavender leftovers, generic three-card feature rows, card nesting, oversized hero type, and decorative glow spam.
- Keep trader execution controls out of investor views.

## QA Checklist

- `rg "Synq|SynQ|SYNQ" app` returns no visible brand leftovers.
- `pnpm --dir app test`, `pnpm --dir app build`, and `pnpm --dir app lint` pass.
- Browser QA covers landing, marketplace, vault detail, connect modal, portfolio, manager, create vault, manager vault, trade, docs, FAQ, and 404 at 320/375px, 768px, and 1280px.
- Console is clean, focus rings are visible, and mobile has no horizontal overflow.
