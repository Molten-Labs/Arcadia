#!/bin/bash
# setup.sh — one-time environment bootstrap
# Uses npm (ships with Node 20) so no pnpm version issues.

set -e

echo "[setup] Installing frontend dependencies..."
cd app && npm install --legacy-peer-deps --ignore-scripts
echo "[setup] Done. Run 'bash dev.sh' or click Run to start the app."
