#!/bin/bash
# start-backend.sh — start the compiled Rust Axum backend on port 8080.
# Automatically falls back to a "not built yet" message if the binary is missing.

BINARY="./target/release/server-rs"

if [ ! -f "$BINARY" ]; then
  echo "[backend] Binary not found at $BINARY."
  echo "[backend] Run ./build-backend.sh first to compile the Rust server."
  echo "[backend] Frontend will continue with mock data fallback."
  exit 0
fi

echo "[backend] Starting arcadia-server on port 8080..."

# Load .env for the backend
if [ -f server-rs/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source server-rs/.env
  set +a
fi

exec $BINARY
