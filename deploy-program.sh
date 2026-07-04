#!/bin/bash
# deploy-program.sh — build and deploy the Arcadia Vault Anchor program to devnet.
#
# Prerequisites:
#   - Solana CLI installed (solana-install install stable)
#   - Anchor CLI installed (cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.31.1)
#   - Devnet wallet with SOL: solana airdrop 2
#   - HELIUS_RPC set in env
#
# After deploying, run the IDL init so the TypeScript client can fetch it:
#   anchor idl init --provider.cluster devnet --filepath target/idl/arcadia_vault.json gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C

set -e

PROGRAM_ID="gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C"
HELIUS_RPC="${HELIUS_RPC:-https://devnet.helius-rpc.com/?api-key=649881b9-dbd1-4a90-98bd-bd38240af548}"

echo "=== Arcadia Protocol — Devnet Deploy ==="
echo "Program ID: $PROGRAM_ID"
echo "RPC: $HELIUS_RPC"
echo ""

# ── Check prerequisites ────────────────────────────────────────────────────
check_tool() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 not found. Please install it first." >&2
    exit 1
  fi
}
check_tool anchor
check_tool solana

# ── Configure Solana CLI ───────────────────────────────────────────────────
solana config set --url "$HELIUS_RPC"
echo "Wallet: $(solana address)"
echo "Balance: $(solana balance)"
echo ""

# ── Build ──────────────────────────────────────────────────────────────────
echo "[1/4] Building Anchor program..."
cd arcadia_vault
anchor build --provider.cluster devnet

# ── Verify program ID ──────────────────────────────────────────────────────
echo "[2/4] Verifying program ID matches..."
BUILT_ID=$(anchor keys list 2>/dev/null | grep arcadia_vault | awk '{print $NF}')
if [ "$BUILT_ID" != "$PROGRAM_ID" ]; then
  echo "WARNING: Built ID ($BUILT_ID) does not match expected ($PROGRAM_ID)."
  echo "Update declare_id!() in lib.rs if this is a fresh keypair."
fi

# ── Deploy ─────────────────────────────────────────────────────────────────
echo "[3/4] Deploying to devnet..."
anchor deploy --provider.cluster devnet

# ── Publish IDL ────────────────────────────────────────────────────────────
echo "[4/4] Publishing IDL on-chain..."
anchor idl init \
  --provider.cluster devnet \
  --filepath target/idl/arcadia_vault.json \
  "$PROGRAM_ID"

cd ..
echo ""
echo "=== Deploy complete! ==="
echo "Program:  https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "Verify:   solana program show $PROGRAM_ID --url devnet"
echo ""
echo "Next: seed the indexer DB by running the ingest worker, or"
echo "      insert rows manually into trader_profile table."
