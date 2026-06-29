---
name: Arcadia design system
description: Color palette, typography, layout tokens for the Arcadia funded-trading terminal UI
---

## Color tokens (globals.css @theme inline)
- bg: #070b0a (near-black, warm green undertone)
- panel: #0c120f
- panel-2: #131c18
- line: #1c2821 (green-tinted border)
- ink: #e6ede8 (near-white, slight warm cast)
- muted: #6b8a78 (green-tinted secondary)
- faint: #2d4038 (green-tinted dim)
- mint / primary CTA: #5ed29c (from design prompt — softer organic emerald)
- mint-bright: #7eeab4
- mint-dim: rgba(94,210,156,0.10)
- mint-mid: #4ab885
- purple alias: --color-purple = #5ed29c (all var(--color-purple) refs auto-resolve to mint)
- accent (chartreuse, data only): #b2ff00
- green (positive PnL): #22c55e
- red: #ef4444
- gold: #f0b429
- tier-elite: #a855f7 (intentionally purple — do NOT replace)

**Why:** User requested palette change from cold electric teal (#00d4aa) to warmer organic emerald (#5ed29c) per design prompt. RGB of new mint is 94,210,156.

## Typography
- Font: Geist (Google Fonts import in layout.tsx head), Inter as fallback
- Mono: Geist Mono
- `tnum` utility class for tabular number alignment

## Layout
- Sidebar: w-48 (192px) fixed left, icon + label nav, role-aware (hides when wallet disconnected)
- Topbar: h-12 glass blur, breadcrumb left, wallet + icons right
- Content: `pl-48` main area offset for sidebar

## Role system
- RoleProvider in lib/role-context.tsx — persists to localStorage key `arcadia_role`
- RoleGate in components/RoleGate.tsx — full-screen overlay triggered on first wallet connect when no role stored
- Roles: "trader" (Knight) → redirects to /terminal; "investor" (Noble) → redirects to /dashboard
- Sidebar nav is role-aware: TRADER_NAV / INVESTOR_NAV / GUEST_NAV based on wallet+role state
- Sidebar returns null when wallet is disconnected (guest sees topbar only)

## Page patterns
- Dashboard: multi-tab chart (equity/pnl/days), positions table, right Risk & Rules panel
- Leaderboard: podium top-3, table, right Prize Pool panel
- Payouts: stat cards (SVG mini bars, not recharts), request form, recent table
- Profile/Settings: banner + badges + Get Started + Active Accounts + Lifetime Stats, right Markets widget
