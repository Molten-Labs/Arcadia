---
name: Icon library
description: @phosphor-icons/react is the standard icon set; lucide-react is replaced.
---

## Rule
Use `@phosphor-icons/react` for all icons in this project. Do not add new lucide-react imports.

## Name mappings (lucide → phosphor)
- `Zap` → `Lightning`
- `ChevronDown` → `CaretDown`
- `ArrowUpRight` → `ArrowUpRight` (same)
- `ArrowRight` → `ArrowRight` (same)
- `TrendingUp` → `TrendingUp` (same)
- `Users` → `Users` (same)
- `Shield` / `ShieldCheck` → `ShieldCheck` (same)

## Why
Project standardized on Phosphor during the landing page redesign. Phosphor has consistent weight variants (Regular/Bold/Fill) that fit the terminal aesthetic better than lucide's stroke-only set.
