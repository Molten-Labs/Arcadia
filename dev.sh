#!/bin/bash
# dev.sh — starts the Arcadia web app on port 5000

PNPM=/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin/pnpm

if [ ! -f "app/node_modules/.bin/next" ]; then
  echo "[dev] Installing dependencies in app/..."
  cd app && $PNPM install --shamefully-hoist 2>/dev/null \
    || npm install --legacy-peer-deps
  cd ..
fi

echo "[dev] Starting Next.js dev server on port 5000..."
cd app && PORT=5000 node_modules/.bin/next dev --port 5000 --hostname 0.0.0.0
