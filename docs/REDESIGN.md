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

## Status (updated 2026-07-09, evening)

DONE (today, after the morning entries below)
- Lint: FlatCompat -> eslint-config-next 16 native flat exports; acid primitives now
  hook-rule clean (useSyncExternalStore reduced-motion, render-derived end states);
  temporary warn-downgrade scoped to pre-redesign files only (shrinks per rebuild).
- Arch: typed ArcadiaIdl (Program<ArcadiaIdl>, no anchor `as any`); cursor borsh
  decoders + PlatformConfig decoder; lib/vault-client.ts (RpcUnreachableError,
  offline/platform/vault-live status union); use-arcadia-vault rewritten around
  structured VaultTxState — RPC outage = error, simulation = labelled + sigless;
  DepositModal consumes the hook (dup flow deleted); Phoenix WS scoped to /terminal;
  dev auth actually verifies (HMAC nonce + ed25519, probed: 5/5 cases); BACKEND_URL
  outage = 502, not mock; use-auth/role-context on useSyncExternalStore; typed
  backend-transform (lib/** out of the lint override).
- Phase 3: acid landing (components/landing/, / prerenders static); (app) route
  group so the landing is shell-free; acid shell (components/shell/: Sidebar,
  Topbar, MobileNav, notifications, wallet) with legacy shell deleted; wallet
  adapter button acid-restyled in globals.
- Phase 3 COMPLETE: all pages rebuilt on the acid system — discovery (traders,
  leaderboard, t/[handle](+trades)), investor (dashboard, portfolio,
  vault/[handle], settings, DepositModal reskin), trader-side (terminal
  reskinned in place with 4 panels extracted, analytics, reputation, payouts,
  manage) into components/pages/{discovery,investor,trader}/.
- Phase 4 cleanup: dead deps removed (framer-motion, @phosphor-icons/react,
  @base-ui/react); orphaned legacy components deleted (StatCard, TraderCard,
  TierBadge, CapacityBar, DepositsStatusBadge, RiskBars, EmptyState,
  SkeletonCard, legacy ScoreDial).
- VERIFIED: lint 0 errors (59 warnings, all in remaining legacy scope),
  typecheck clean, build green (23 routes), all 17 routes smoke-tested 200
  with zero real console errors in headless Chromium, deposit modal renders
  correct disconnected state. Dev-auth probed earlier: 5/5 signature/nonce
  cases correct.

DONE (2026-07-09 late, post-build polish with Allen reviewing live)
- /terminal crash fixed: Phoenix REST seed sends ms, WS sends seconds; candles
  normalized to unix seconds at both ingest points + TvChart sorts/dedupes
  before setData (commit 7f6c2e3).
- Hero layout: 16vw "PROVE" min-content starved the card column to 8px slivers
  and clipped the copy column on phones; per-breakpoint clamp + minmax(360px,)
  card column + flex-wrap on tight rows (9fd12ea).
- Hero + landing nav widened to a 1660px container (b19e277, 8d78ca7);
  decorative left rail removed with its offset padding (3031515).

DONE (2026-07-09, second session — redesign COMPLETE, 30 commits on branch)
- Allen's decisions: /trade -> RESTYLE (done); LandingRedirect -> DELETE (done).
- components/charts/** (the visx framework, ~70 files) had ZERO consumers after
  the page rebuilds — deleted wholesale with its 10 @visx/* deps and
  shimmering-text (its last dependent). Chart stack rationalized to
  recharts (3 shared components) + lightweight-charts (terminal).
- Chart retokening: TvChart reads acid tokens from the :root mirror via
  getComputedStyle (canvas needs concrete strings); EquityChart /
  NavHistoryChart / ScoreHistoryChart on acid/danger/cyan/tier tokens;
  PnLHeatmap ramp rebuilt on color-mix over success/danger.
- Legacy bits reskinned: RoleGate (accessible acid dialog), ShareCard(+Modal)
  (tier tokens at runtime for html2canvas, QR img -> role=img div), ErrorState;
  TextSwap audited clean, unchanged.
- /trade rebuilt on the acid system (PaperTradeMarketBar/OrderForm/Positions in
  components/pages/trader/), honest simulation labelling, disconnected gate,
  secondary "Paper Trade" nav link (FlaskConical).
- API proxy routes de-any'd (Array.isArray narrowing).
- globals.css purged: legacy tokens (mint/gold/green/red/accent), dead visx
  chart token blocks, dead utilities and landing-era classes/keyframes;
  922 -> 504 lines. pnlClass/pnlArrow helpers removed. 404 page rebuilt acid.
- eslint override block DELETED — `eslint .` = 0 errors, 0 warnings, no
  exceptions. typecheck + build green (29 routes).
- BUG found by smoke + fixed: terminal's candle-seed effect depended on the
  phoenix context object (recreated per WS message) -> refired per tick and
  stampeded the Phoenix REST API into 429s. Now depends on the stable
  callbacks (548cc7c).
- Verified: all 17 routes 200 on a production build; fresh-visit consoles
  clean; 0 phoenix requests outside /terminal; screenshots confirm acid
  charts/404//trade.

DONE (2026-07-09, third session — live-review polish round 2)
- Chrome CTA cleaned: beveled metal gradient + mix-blend label replaced by a
  hairline outline pill (ink label, acid border/glow on hover) (27af94f).
- Hero card cluster rethought: breathing iridescent blobs (clipped their own
  kickers/rows, rainbow borders) -> sharp terminal tiles with acid corner
  ticks, 01-04 indices, staggered right column, solid acid bars, seat glow
  (27af94f); BlobCard primitive kept in the kit but now unused.
- Interaction vocabulary added to globals + acid README: acid-int (lift +
  acid edge + glow), acid-sheen (single diagonal sweep), acid-bar (fill
  shimmer on group hover); centrally hover-capability + reduced-motion gated
  (bc3298f). Hero tiles are the reference implementation.
- Site-wide hover pass via 2 agents (081522d landing/discovery, e4cba6c
  investor/trader/shell): TraderMarketCard lift + avatar tilt + bar sheen,
  row hovers with key-cell sharpen, stat tiles lift, sidebar acid edge
  indicator + icon nudge, bell tilt, mobile active-tab pop, press feedback
  app-wide; DepositModal carries the single app sheen; terminal kept subtle
  (border/row tints only); form panels with live inputs not lifted
  (focus-within would hold the raise while typing).
- Verified: eslint . 0/0, typecheck, build green; traders-card + hero hover
  states confirmed via forced-hover screenshots; consoles clean.

REMAINING
- /investments + /returns are redirect stubs to /portfolio — keep (URL compat).
- Manual pass with a real wallet (Phantom, devnet): connect, role gate, SIWS
  sign-in, deposit (simulated + live), withdraw, paper-trade flow on /trade,
  analytics/dashboard charts (wallet-gated, not headless-verifiable).
- Topbar label for /trade says "Trade" while the nav link says "Paper Trade" —
  unify if Allen cares (one ROUTE_LABELS line).
- NO push/PR yet — owner approval required.

## Status (updated 2026-07-09, morning)

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
