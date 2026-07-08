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

## Status
Living checklist maintained as phases land. Commits are local on this branch; no push/PR
without owner approval.
