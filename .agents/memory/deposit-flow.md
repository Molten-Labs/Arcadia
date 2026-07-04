---
name: Deposit flow wiring
description: How the end-to-end deposit transaction is wired — DepositModal, use-arcadia-vault hook, RPC endpoint, and on-chain vs sim fallback.
---

## Packages installed (in app/)
- `@coral-xyz/anchor@0.32.1` — Anchor program client
- `@solana/spl-token@0.4.14` — ATA derivation

## Correct Program ID
`gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C` — defined as `PROGRAM_ID` in `app/lib/arcadia-sdk.ts`. The old use-arcadia-vault.ts had the wrong ID (`4QX1neZXvYnhFT4bGfbbnA17LfCKtrVa2Xwk3kuhUNWM`), now fixed.

## RPC endpoint
`providers.tsx` uses Helius devnet: `https://devnet.helius-rpc.com/?api-key=649881b9-…` (reads `NEXT_PUBLIC_HELIUS_RPC` env var or falls back to hardcoded).

## Profile binary layout (for decoding on-chain)
- offset 0–7: discriminator
- offset 8–39: trader pubkey (32 bytes)
- offset 40–71: baseMint pubkey (32 bytes)
- offset 72–103: vaultToken pubkey (32 bytes)

## On-chain vs simulation decision
Check `platformPDA` and `profilePDA` existence via `getMultipleAccountsInfo`. If both exist → real Anchor txs. If either is null → devnet simulation (realistic delays, fake base58 sig, same UI steps).

## Deposit instruction accounts (in order)
depositor (writable, signer), investorAccount (PDA writable), profile (writable), position (PDA writable), baseMint, vaultToken (writable), depositorToken (writable ATA), tokenProgram, systemProgram

## ATA derivation
`getAssociatedTokenAddressSync(baseMint, publicKey)` from `@solana/spl-token`

## Devnet USDC mint
`DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz`

## Wire points
- `app/components/DepositModal.tsx` — standalone deposit UI (amount input, presets, step progress, success/error)
- `app/lib/use-arcadia-vault.ts` — hook with all vault actions; all fns use real Anchor or sim fallback
- `app/app/t/[handle]/page.tsx` — "Fund Vault" button triggers `setShowDeposit(true)` + `<DepositModal>` at bottom
- `app/app/manage/page.tsx` — self-fund calls `deposit(publicKey, amount)` from the hook

**Why:** The Fund Vault button was a broken `<Link href="/vault/[profile]">` pointing to a non-existent route. It's now a button that opens the DepositModal in-place.
