#!/bin/bash
# dev.sh — starts the Arcadia full stack in development.
#
#   Port 5000 — Next.js 15 frontend
#   Port 8080 — Rust Axum backend (when binary exists)
#
# Run ./build-backend.sh once to compile the Rust backend.
# Without it the frontend falls back to mock data automatically.

set -e

PNPM=/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin/pnpm

# ── Source rustup env (preferred toolchain = 1.89.0) ─────────────────────────
# shellcheck disable=SC1091
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

# ── Install frontend deps ────────────────────────────────────────────────────
if [ ! -f "app/node_modules/.bin/next" ]; then
  echo "[dev] Installing dependencies in app/..."
  cd app && $PNPM install --shamefully-hoist 2>/dev/null \
    || npm install --legacy-peer-deps
  cd ..
fi

# ── Load backend env ─────────────────────────────────────────────────────────
if [ -f server-rs/.env ]; then
  set -a
  # Read .env, expanding any shell variables already in the environment
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    eval "export $line" 2>/dev/null || true
  done < server-rs/.env
  set +a
fi

# ── Optionally start Redis ───────────────────────────────────────────────────
if command -v redis-server &>/dev/null; then
  if ! redis-cli ping &>/dev/null 2>&1; then
    echo "[dev] Starting Redis on port 6379..."
    redis-server --daemonize yes --logfile /tmp/redis.log --port 6379
    sleep 1
  else
    echo "[dev] Redis already running."
  fi
else
  echo "[dev] Redis not installed — price cache disabled."
fi
REDIS_PID=$(pgrep redis-server 2>/dev/null | head -1)

# ── Optionally start Rust backend ────────────────────────────────────────────
BACKEND_BIN="./target/release/server-rs"
if [ -f "$BACKEND_BIN" ]; then
  echo "[dev] Starting Rust backend on port 8080..."
  PORT=8080 "$BACKEND_BIN" &
  BACKEND_PID=$!
  echo "[dev] Backend PID: $BACKEND_PID"
else
  echo "[dev] Rust backend not built yet — frontend uses mock data."
  echo "[dev] Run ./build-backend.sh to compile (takes ~5 min on first run)."
fi

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  echo "[dev] Shutting down..."
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${REDIS_PID:-}" ]; then
    redis-cli shutdown 2>/dev/null || kill "$REDIS_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ── Start Next.js frontend ───────────────────────────────────────────────────
echo "[dev] Starting Next.js dev server on port 5000..."
cd app && PORT=5000 \
  BACKEND_URL="${BACKEND_URL:-http://localhost:8080}" \
  node_modules/.bin/next dev --port 5000 --hostname 0.0.0.0
