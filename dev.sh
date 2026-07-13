#!/bin/bash
# dev.sh — starts the Arcadia web app on port 5000

PNPM=/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin/pnpm

# Always sync deps so newly added packages are picked up after commits
echo "[dev] Syncing dependencies in app/..."
$PNPM install --dir app --shamefully-hoist 2>/dev/null || true

echo "[dev] Starting Next.js dev server on port 5000..."
cd app && PORT=5000 node_modules/.bin/next dev --port 5000 --hostname 0.0.0.0
