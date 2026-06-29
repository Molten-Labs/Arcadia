---
name: Nav cleanup pattern
description: How to handle the old Nav component vs layout-level Topbar
---

## Rule
The old `components/nav.tsx` is superseded by `components/Topbar.tsx` which lives in `app/layout.tsx`.

**Why:** The nav was in individual pages before; moving it to layout prevents duplication and ensures consistent chrome across all routes.

**How to apply:** When editing any page that still has `import { Nav } from "@/components/nav"` + `<Nav />`:
1. Delete the import line
2. Delete the `<Nav />` JSX usage
3. The layout already wraps all pages with Topbar + Sidebar

Can bulk-remove with:
```bash
sed -i '/import.*Nav.*from.*@\/components\/nav/d' "$f"
sed -i 's|<Nav />||g' "$f"
```
