#!/bin/bash
# mobile-dev.sh — builds and serves the Arcadia mobile app (Expo web) on port 5000

set -e

if [ ! -d "mobile/node_modules" ]; then
  echo "[mobile] Installing dependencies..."
  cd mobile && npm install --legacy-peer-deps
  cd ..
fi

echo "[mobile] Building Expo web export..."
cd mobile && EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir dist 2>&1
cd ..

echo "[mobile] Starting static server on port 5000..."
node mobile-server.js
