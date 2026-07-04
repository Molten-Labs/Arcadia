#!/bin/bash
# build-backend.sh — compile the Rust Axum backend.
# Run once before starting dev.sh if you want real API responses.
#
# Finds cargo via common Replit nix paths or PATH.
set -e

find_cargo() {
  # 1. Rustup install (preferred — correct toolchain version 1.89.0)
  if [ -x "$HOME/.cargo/bin/cargo" ]; then
    echo "$HOME/.cargo/bin/cargo"
    return
  fi
  # 2. Source rustup env if present
  if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
    if command -v cargo &>/dev/null; then
      echo "cargo"
      return
    fi
  fi
  # 3. PATH (nix system install)
  if command -v cargo &>/dev/null; then
    echo "cargo"
    return
  fi
  # 4. Common nix profile paths
  local candidates=(
    "/nix/var/nix/profiles/per-user/runner/profile/bin/cargo"
    "/home/runner/.nix-profile/bin/cargo"
    "/nix/var/nix/profiles/default/bin/cargo"
  )
  for c in "${candidates[@]}"; do
    if [ -x "$c" ]; then
      echo "$c"
      return
    fi
  done
}

CARGO=$(find_cargo)
if [ -z "$CARGO" ]; then
  echo "ERROR: cargo not found. Install Rust via the Replit language modules." >&2
  exit 1
fi

echo "[build-backend] Using cargo: $CARGO"
echo "[build-backend] Compiling server-rs (this takes a few minutes)..."

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-target}"
$CARGO build --release --manifest-path server-rs/Cargo.toml 2>&1

echo "[build-backend] Build complete: target/release/server-rs"
