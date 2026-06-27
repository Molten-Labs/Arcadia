---
name: Arcadia design system
description: Color palette, typography, layout tokens for the Arcadia funded-trading terminal UI
---

## Color tokens (globals.css @theme inline)
- bg: #0e0e13 (dark purple-tinted, not pure black)
- panel: #141420
- panel-2: #1c1c28
- line: #252535
- ink: #f0f0f8
- muted: #888898
- faint: #505065
- purple: #7c3aed (primary CTA)
- purple-bright: #a855f7
- purple-dim: #7c3aed20
- green: #22c55e (positive PnL only)
- red: #ef4444 (negative PnL only)
- gold: #f0b429 (ranks/awards)

## Typography
- Font: Inter (not Syne — reference design is neutral sans-serif)
- Mono: JetBrains Mono for data/addresses
- `tnum` utility class for tabular number alignment

## Layout
- Sidebar: 44px fixed left (`w-11`), icon-only with tooltips
- Topbar: full-width 36px sticky bar (breadcrumb label left, wallet + icons right)
- Content: `pl-11` main area with `px-8 py-6` inner padding
- Right panels: ~200-220px fixed-width on Dashboard, Leaderboard, Profile

## Page patterns
- Dashboard: multi-tab chart (equity/pnl/days), positions table, right Risk & Rules panel
- Leaderboard: podium top-3, table, right Prize Pool panel
- Payouts: stat cards (SVG mini bars, not recharts), request form, recent table
- Profile/Settings: banner + badges + Get Started + Active Accounts + Lifetime Stats, right Markets widget

## Why
User provided Hypernova-style reference screenshots; cloned 1:1 with dark purple-tinted theme.
