# Arcadia Landing Restructure QA

Date: 2026-05-04

## Automated checks

- `pnpm --dir app test`: passed, 9 files and 23 tests.
- `pnpm --dir app build`: passed. Vite reported existing bundle-size and dependency externalization warnings.
- `pnpm --dir app lint`: passed with existing Fast Refresh warnings only.

## Browser QA

Local target: `http://127.0.0.1:8080/`

- Verified landing section order at 375px, 768px, and 1280px:
  1. Hero
  2. Problem to Solution
  3. How Arcadia works
  4. Stats / Credibility
  5. Marketplace
  6. Reputation Layer
  7. Projected Outcomes
  8. Integrations
  9. FAQ
  10. Final CTA
- Verified no horizontal overflow at 375px, 768px, or 1280px.
- Verified token price ticker is removed from the landing page.
- Verified marketplace preview renders exactly three vault cards.
- Verified primary CTAs route to `/vaults` and `/manager/create`.
- Verified `/`, `/vaults`, `/manager/create`, and `/faq` load without browser console errors.
- Verified `/faq` resolves to the shared FAQ page.

## Fixes made during QA

- Registered the `/faq` route.
- Allowed API-backed vault reads without requiring an RPC connection when an API URL is configured.
- Added an accessible amount label to the vault deposit/withdraw input.
- Updated the withdrawal test to select the Withdraw tab before submitting.
- Replaced an intentionally ignored localStorage catch with a documented fallback comment.

## Git hygiene

- `Kiln_program/target/.rustc_info.json` was left unstaged and untouched for this landing work.
- Backup stashes from the media-preservation pull flow were left in place.
