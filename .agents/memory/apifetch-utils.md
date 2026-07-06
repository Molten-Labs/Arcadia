---
name: apiFetch location
description: apiFetch is defined in @/lib/utils.ts and used by every page — JWT Bearer auth helper.
---

## Rule
`apiFetch` must be defined and exported from `@/lib/utils.ts`. Every page in the app imports it from that path.

## What it does
- Fetches `/api/v1${path}` (the Next.js API proxy layer)
- Reads `arcadia_jwt` from localStorage and adds `Authorization: Bearer <token>` if present
- Throws on non-2xx with a descriptive message

## Why
Multiple pages import `apiFetch` from `@/lib/utils`. If the export is missing, every page fails to compile. The function was documented in use-auth.ts comments but never shipped to utils.ts until it was caught as a compile error.
