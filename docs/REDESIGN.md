# Arcadia Frontend Redesign — Acid Graphic

Branch: `redesign/acid-graphic`

Goal: rebuild the `app/` frontend on Next.js 16 with the "Acid Graphic" design system
(liquid chrome, techno-surrealism, acid-green on pure black), fix every issue flagged in
the earlier frontend review, and land modular, maintainable, verified code.

Guiding principle: aggressive skin, readable core. All distortion, chrome, and chaos live in
display type, heroes, section dividers, and big numbers. Body copy, financial figures, the
allocation-rail guarantees, and the trust content stay clean and legible.

## Phases

### Phase 1 — Platform + hygiene (foundation)
- Upgrade Next 15.3 -> 16; keep React 19; Tailwind v4 stays.
- Add ESLint (eslint + eslint-config-next flat config); wire `lint` + `typecheck` scripts.
- Remove dead deps: `drizzle-orm`, `pg` (backend-only, unused in app). Move `shadcn` CLI to devDependencies.
- Declare `qrcode` + `@types/qrcode` properly (was a phantom transitive dep used by ShareCard).
- Secrets: untrack `app/.env.local`, add `.env*.local` to `.gitignore`, remove the hardcoded
  Helius RPC fallback literal from client source (env-only). Rotation of the leaked key is an
  owner action, noted in the report.
- `next.config`: set `outputFileTracingRoot` to silence the multi-lockfile workspace warning.
- Keep `framer-motion` and `@phosphor-icons/react` installed until pages stop importing them,
  then remove (consolidate on `motion` + `lucide-react`). Same for `@base-ui/react` -> shadcn.

### Phase 2 — Design system + primitives
- Fonts via `next/font`: Syne (display), Space Grotesk (body), Space Mono (data). No raw <link> tags.
- `globals.css` `@theme` tokens: void black, acid green (#CCFF00), chrome ramp, hyper-pink,
  iridescent cyan, semantic success/danger, tier colors. Single source of truth, no scattered hex.
- shadcn (Radix + Tailwind v4 + React 19) primitives: Button, Card, Dialog, Tabs, Accordion,
  Tooltip, Table, Skeleton, etc. Styled once to the acid system; pages compose them.
- Acid primitives (modular, reduced-motion aware): ChromeText, AcidButton/ChromeButton,
  BlobCard, Marquee, Reveal, CountUp, ScoreDial, NoiseOverlay, DriftBlobs.
- Architecture fixes: one shared vault/tx hook (kill the duplicated deposit flow); RPC errors
  distinguished from "program not live" (never render an outage as a fake success); Phoenix
  WebSocket scoped to the terminal route, not global; typed API boundary (drop `any` at the
  transform + Anchor call seams); real signature verification on the auth path.

### Phase 3 — Page migration (frontend team, parallel)
Rebuild each route on the design system: landing, dashboard, terminal, traders, leaderboard,
trader profile, vault, portfolio, settings, and the shared shell (sidebar/topbar). Server
components for public read-only pages where it helps first paint.

### Phase 4 — Verification
ESLint clean, `tsc --noEmit` clean, `next build` passes, dev server runs, smoke-test every
route, exercise the deposit flow. Fix findings. Commit per feature with Conventional Commits.

## Status (updated 2026-07-09)

DONE
- Phase 1 platform + hygiene. Next 16 (webpack bundler via --webpack), ESLint added, dead deps
  removed (drizzle-orm, pg), qrcode declared, env secrets untracked + hardcoded RPC key removed,
  outputFileTracingRoot set, 3 latent vault type errors fixed. `typecheck` + `build` green.
  Commits: fix(web) secrets, chore(web) Next 16.
- Phase 2 design-system foundation. next/font (Syne / Space Grotesk / Space Mono), acid `@theme`
  tokens (additive; legacy tokens retuned or kept so all routes still build), shadcn primitives
  hand-authored on Radix + acid-themed (button/card/badge/input/skeleton/table/tabs/accordion/
  tooltip/dialog/dropdown-menu/select), acid primitives in app/components/acid/ (ChromeText,
  AcidButton/ChromeButton, BlobCard, Marquee, Reveal, CountUp, ScoreDial, NoiseOverlay,
  DriftBlobs) + usePrefersReducedMotion + README. `typecheck` + `build` green (29 routes).

NEXT (resume order)
1. FIX LINT FIRST: `pnpm lint` fails at config load. Cause: eslint.config.mjs uses the Next 15
   FlatCompat pattern, which throws a circular-structure error against eslint-config-next 16
   (native flat config). Replace FlatCompat with eslint-config-next 16's flat export, then
   `pnpm lint` clean before writing more code.
2. Architecture fixes (own pass): dedupe the deposit flow into one shared hook (use-arcadia-vault
   + DepositModal duplicate it); make RPC failures surface as errors, never a fake "confirmed
   (simulation)" success; scope the Phoenix WebSocket to the /terminal route (currently global in
   providers); type the API transform + Anchor call boundary (drop `any`); real ed25519 signature
   verification on /api/v1/auth/verify (currently mints a session for any pubkey when BACKEND_URL
   unset).
3. Page migration (frontend team, on top of the primitives): landing first (acid hero), then the
   app shell (Sidebar/Topbar), then dashboard, terminal, traders, leaderboard, t/[handle], vault,
   portfolio, settings. Consume components/acid/* + components/ui/*; server components for public
   read-only pages where it helps first paint.
4. Cleanup pass: remove now-unused legacy tokens/classes, framer-motion, @phosphor-icons,
   @base-ui/react once no page imports them; rationalize the 3 chart libs.
5. Full verify: lint + typecheck + build + run + smoke every route + exercise deposit. Then report.

Working copy: ~/projects/arcadia, branch redesign/acid-graphic. Commits local only; no push/PR
without owner approval. Visual reference comp: ~/Brain/Inbox/arcadia-redesign/arcadia-d-acid.html
(canonical content + tone for the landing; other pages extrapolate the same system).

## Phase 3 page-build brief (contract for every page rebuild)

Principle: aggressive skin, readable core. Chrome/distortion/acid chaos lives in display
type (Syne via `font-display`), heroes, section dividers, marquees, and big numbers. Body
copy, tables, financial figures, and trust content stay clean (Space Grotesk body,
Space Mono `font-mono` for data, `tabular-nums`).

Materials
- Tokens: app/globals.css `@theme` block (+ `:root` mirror for inline/SVG use). Use
  token classes (`bg-void`, `text-ink`, `text-acid`, `border-line`, `bg-panel`,
  `text-muted`, `text-faint`, `text-success`, `text-danger`, tier tokens) — never raw hex.
- Acid primitives: components/acid (ChromeText, AcidButton/ChromeButton, BlobCard,
  Marquee, Reveal, CountUp, ScoreDial, NoiseOverlay, DriftBlobs) — README in that folder.
- shadcn primitives: components/ui (button, card, badge, input, table, tabs, accordion,
  tooltip, dialog, dropdown-menu, select, skeleton) — already acid-themed via the
  semantic bridge tokens.
- Vault txs: lib/use-arcadia-vault (structured txState) — never build Anchor calls in pages.

Rules
1. Preserve each page's data flow (apiFetch/backend-transform/mock fallbacks) and its
   routes/links; rebuild the presentation.
2. Server components for public read-only content where possible; "use client" only
   where interactivity/hooks demand it.
3. Reduced-motion: all JS motion via the acid primitives (already gated) or
   usePrefersReducedMotion; CSS animation behind the globals.css media guards.
4. No new dependencies. No framer-motion / @phosphor-icons / @base-ui imports in
   rebuilt pages (lucide-react for icons, motion via acid primitives/CSS).
5. After rebuilding a file: remove it from the legacy-override list in
   eslint.config.mjs, then `pnpm exec eslint <file>` must be clean, and
   `pnpm typecheck` + `pnpm build` must pass.
6. Keyboard/a11y: focus-visible states, aria labels on icon buttons, semantic headings.
