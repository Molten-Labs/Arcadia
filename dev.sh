#!/bin/bash
# dev.sh — starts the Arcadia frontend on port 5000
# Auto-installs app/node_modules if missing, then launches Vite.

set -e

# Auto-install dependencies if node_modules is missing
if [ ! -d "app/node_modules" ]; then
  echo "[dev] node_modules not found — running npm install in app/..."
  cd app && npm install --legacy-peer-deps
  cd ..
fi

echo "[dev] Starting Vite dev server on port 5000..."
cd app && node node_modules/vite/bin/vite.js --config vite.config.ts
