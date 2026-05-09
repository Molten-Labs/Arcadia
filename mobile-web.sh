#!/bin/bash
# mobile-web.sh — runs the Arcadia mobile app in web mode on port 8000

set -e

if [ ! -d "mobile/node_modules" ]; then
  echo "[mobile] Installing dependencies..."
  cd mobile && npm install --legacy-peer-deps
  cd ..
fi

echo "[mobile] Starting Expo web on port 8000..."
cd mobile && npx expo start --web --port 8000
