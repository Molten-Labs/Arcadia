// Kiln/app/lib/kiln.ts
/**
 * Kiln SDK helpers
 *
 * Utilities to build instruction objects for the Kiln program using the
 * Codama-generated client (clients/src/generated). These helpers:
 *  - derive canonical PDAs used by the program (manager profile, vault config, vault state, treasury)
 *  - provide small convenience functions to create the instruction objects produced by Codama
 *
 * Notes:
 *  - The generated SDK returns instruction descriptors compatible with `@solana/kit`.
 *    We import and forward those descriptors (so your wallet/transaction builder can consume them).
 *  - The exact `TransactionSigner` shape is dependent on whichever wallet / signing abstraction
 *    you use in the frontend. The helpers below accept either a TransactionSigner (preferred) or
 *    a plain `PublicKey` for addresses. When a signer is required (manager/create flows) you should
 *    pass a TransactionSigner compatible with @solana/kit; otherwise the instruction will not be
 *    marked as signed and the on-chain validation will fail.
 *
 * How to use (example)
 *  import { PublicKey } from "@solana/web3.js";
 *  import { useWalletAdapter } from "your-wallet-hook";
 *  import { buildCreateVaultIx } from "@/lib/kiln";
 *
 *  const managerSigner = walletAdapter.asTransactionSigner(); // your wallet helper
 *  const vaultIndex = 0; // u16 index
 *  const createIx = buildCreateVaultIx({
 *    manager: managerSigner,
 *    managerProfile: deriveManagerProfilePda(managerSigner.address, PROGRAM_ID)[0],
 *    vaultIndex,
 *    paperWindowSecs: 30 * 24 * 60 * 60,
 *    minQualifyingTrades: 10,
 *    maxSlippageBps: 50,
 *    managerFeeBps: 200,
 *    name: "My Vault",
 *  });
 *
 *  // then send the instruction with @solana/kit or @solana/web3.js transaction builders
 */

import { PublicKey } from "@solana/web3.js";
import {
  // types used by generated SDK / kit
  type TransactionSigner,
  type Address,
} from "@solana/kit";

import * as Generated from "../../clients/src/generated";

/* Program ID constant (keeps parity with the on-chain declare_id!) */
export const PROGRAM_ID = new PublicKey(
  Generated.KILN_PROGRAM_PROGRAM_ADDRESS as unknown as string,
);

/* PDA seed strings - must match the on-chain seeds used in the program */
const MANAGER_PROFILE_SEED = "manager_profile";
const VAULT_CONFIG_SEED = "vault_config";
const VAULT_STATE_SEED = "vault_state";
const TREASURY_SEED = "treasury";

/* --- PDA derivation helpers --- */

/**
 * Derive the ManagerProfile PDA and bump for a given manager pubkey.
 * @param manager PublicKey of the manager wallet
 * @returns [pda, bump]
 */
export function deriveManagerProfilePda(
  manager: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MANAGER_PROFILE_SEED), manager.toBuffer()],
    programId,
  );
}

/**
 * Derive the VaultConfig PDA for a manager + vault index (u16).
 * @param manager PublicKey of the manager wallet
 * @param vaultIndex number (u16)
 * @returns [pda, bump]
 */
export function deriveVaultConfigPda(
  manager: PublicKey,
  vaultIndex: number,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  const indexBytes = Buffer.alloc(2);
  indexBytes.writeUInt16LE(vaultIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED), manager.toBuffer(), indexBytes],
    programId,
  );
}

/**
 * Derive the VaultState PDA for a vault config public key.
 * @param vaultConfig PublicKey of the vault config PDA
 * @returns [pda, bump]
 */
export function deriveVaultStatePda(
  vaultConfig: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_STATE_SEED), vaultConfig.toBuffer()],
    programId,
  );
}

/**
 * Derive the Treasury PDA for a given vault config public key.
 * @param vaultConfig PublicKey of the vault config PDA
 * @returns [pda, bump]
 */
export function deriveTreasuryPda(
  vaultConfig: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_SEED), vaultConfig.toBuffer()],
    programId,
  );
}

/* --- Encoding helpers --- */

/**
 * Encode a name string into a fixed 32-byte Uint8Array (pads with zeros / truncates).
 */
export function encodeName(name: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name);
  if (bytes.length === 32) return bytes;
  const out = new Uint8Array(32);
  out.set(bytes.slice(0, 32));
  return out;
}

/**
 * Create a fixed-size reserved field (2 bytes) as Uint8Array.
 */
export function reserved2(): Uint8Array {
  return new Uint8Array([0, 0]);
}

/* --- Instruction builders using the generated SDK --- */

/**
 * Build a CreateVault instruction for the Kiln program.
 *
 * IMPORTANT: `manager` should be a TransactionSigner (wallet signer). The generated
 * instruction expects the manager to be a signer account. If you pass a plain PublicKey,
 * the instruction will not be signed on-chain.
 */
export function buildCreateVaultIx(input: {
  manager: TransactionSigner<string>;
  managerProfile: Address<string> | PublicKey;
  vaultIndex: number;
  paperWindowSecs: number | bigint;
  minQualifyingTrades: number;
  maxSlippageBps: number;
  managerFeeBps: number;
  name: string;
  // optional accounts
  rent?: Address<string> | PublicKey;
  clock: Address<string> | PublicKey;
  systemProgram?: Address<string> | PublicKey;
}) {
  // Resolve addresses into forms expected by the generated SDK.
  const managerProfileAddr =
    (input.managerProfile as PublicKey)?.toBase58
      ? (input.managerProfile as PublicKey).toBase58()
      : (input.managerProfile as Address<string>);
  const vaultConfigPda = deriveVaultConfigPda(
    new PublicKey((input.manager as any).address ?? (input.manager as any)),
    input.vaultIndex,
  )[0];
  const vaultStatePda = deriveVaultStatePda(vaultConfigPda)[0];
  const treasuryPda = deriveTreasuryPda(vaultConfigPda)[0];

  const nameBytes = encodeName(input.name);

  return Generated.getCreateVaultInstruction({
    manager: input.manager,
    managerProfile: managerProfileAddr as Address<string>,
    vaultConfig: vaultConfigPda.toBase58() as Address<string>,
    vaultState: vaultStatePda.toBase58() as Address<string>,
    treasury: treasuryPda.toBase58() as Address<string>,
    rent: (input.rent as any) ?? undefined,
    clock: input.clock as Address<string>,
    systemProgram: (input.systemProgram as any) ?? undefined,
    paperWindowSecs: input.paperWindowSecs,
    minQualifyingTrades: input.minQualifyingTrades,
    maxSlippageBps: input.maxSlippageBps,
    managerFeeBps: input.managerFeeBps,
    reserved: reserved2(),
    name: nameBytes,
  });
}

/**
 * Build a DepositJunior instruction.
 *
 * `manager` must be a TransactionSigner (the manager signs to transfer lamports).
 */
export function buildDepositJuniorIx(input: {
  manager: TransactionSigner<string>;
  managerProfile: Address<string> | PublicKey;
  vaultConfig: Address<string> | PublicKey;
  amountLamports: number | bigint;
  clock: Address<string> | PublicKey;
  systemProgram?: Address<string> | PublicKey;
}) {
  const managerProfileAddr =
    (input.managerProfile as PublicKey)?.toBase58
      ? (input.managerProfile as PublicKey).toBase58()
      : (input.managerProfile as Address<string>);

  const vaultConfigPub =
    (input.vaultConfig as PublicKey)?.toBase58
      ? (input.vaultConfig as PublicKey).toBase58()
      : (input.vaultConfig as Address<string>);

  const vaultStatePda = deriveVaultStatePda(new PublicKey(vaultConfigPub))[0];
  const treasuryPda = deriveTreasuryPda(new PublicKey(vaultConfigPub))[0];

  return Generated.getDepositJuniorInstruction({
    manager: input.manager,
    managerProfile: managerProfileAddr as Address<string>,
    vaultConfig: vaultConfigPub as Address<string>,
    vaultState: vaultStatePda.toBase58() as Address<string>,
    treasury: treasuryPda.toBase58() as Address<string>,
    clock: input.clock as Address<string>,
    systemProgram: (input.systemProgram as any) ?? undefined,
    amountLamports: input.amountLamports as any,
  });
}

/**
 * Build an UpdateNav instruction.
 *
 * This recomputes NAV using the simplified on-chain treasury model (current implementation).
 * The generated SDK expects updater (any address), vaultConfig, vaultState, treasury and clock.
 */
export function buildUpdateNavIx(input: {
  updater: Address<string> | PublicKey;
  vaultConfig: Address<string> | PublicKey;
  clock: Address<string> | PublicKey;
}) {
  const updaterAddr =
    (input.updater as PublicKey)?.toBase58
      ? (input.updater as PublicKey).toBase58()
      : (input.updater as Address<string>);
  const vaultConfigAddr =
    (input.vaultConfig as PublicKey)?.toBase58
      ? (input.vaultConfig as PublicKey).toBase58()
      : (input.vaultConfig as Address<string>);

  const vaultStatePda = deriveVaultStatePda(new PublicKey(vaultConfigAddr))[0];
  const treasuryPda = deriveTreasuryPda(new PublicKey(vaultConfigAddr))[0];

  return Generated.getUpdateNavInstruction({
    updater: updaterAddr as Address<string>,
    vaultConfig: vaultConfigAddr as Address<string>,
    vaultState: vaultStatePda.toBase58() as Address<string>,
    treasury: treasuryPda.toBase58() as Address<string>,
    pythPrice: undefined as any,
    clock: (input.clock as any) as Address<string>,
  });
}

/**
 * Build a GraduateVault instruction.
 *
 * Caller must be a signer (the manager or any account that satisfies the program requirement).
 */
export function buildGraduateVaultIx(input: {
  caller: TransactionSigner<string> | Address<string> | PublicKey;
  managerProfile: Address<string> | PublicKey;
  vaultConfig: Address<string> | PublicKey;
  clock: Address<string> | PublicKey;
}) {
  const callerResolved =
    (input.caller as PublicKey)?.toBase58
      ? // plain PublicKey provided (not ideal; better to provide signer)
        (input.caller as PublicKey).toBase58()
      : (input.caller as Address<string>);

  const managerProfileAddr =
    (input.managerProfile as PublicKey)?.toBase58
      ? (input.managerProfile as PublicKey).toBase58()
      : (input.managerProfile as Address<string>);

  const vaultConfigAddr =
    (input.vaultConfig as PublicKey)?.toBase58
      ? (input.vaultConfig as PublicKey).toBase58()
      : (input.vaultConfig as Address<string>);

  const vaultStatePda = deriveVaultStatePda(new PublicKey(vaultConfigAddr))[0];

  return Generated.getGraduateVaultInstruction({
    caller: callerResolved as any,
    vaultState: vaultStatePda.toBase58() as Address<string>,
    vaultConfig: vaultConfigAddr as Address<string>,
    treasury: deriveTreasuryPda(new PublicKey(vaultConfigAddr))[0].toBase58() as Address<string>,
    managerProfile: managerProfileAddr as Address<string>,
    clock: input.clock as Address<string>,
  });
}

/* --- Small convenience utilities --- */

/**
 * Build a manager TransactionSigner placeholder from a wallet adapter.
 * Wallet adapters vary; the generated SDK expects a TransactionSigner object that:
 *   - exposes an `address` (base58) and a `.signTransaction` method (or matches your kit's TransactionSigner shape)
 *
 * This helper tries to shape a common wallet adapter into a TransactionSigner for the generated client.
 *
 * Example adapter (pseudo):
 *  { publicKey: PublicKey, signTransaction: async (tx) => { ... } }
 */
export function makeManagerSignerFromAdapter(adapter: {
  publicKey?: PublicKey | null;
  signTransaction?: (tx: any) => Promise<any>;
}) {
  if (!adapter.publicKey) throw new Error("adapter missing publicKey");
  // The generated SDK's "isTransactionSigner" check expects an object with an `address` property
  // and kit-compatible signer semantics. We produce a minimal wrapper.
  return {
    address: adapter.publicKey.toBase58(),
    // Pass-through sign function - your code that executes the transaction must use this shape.
    // The exact `signTransaction` shape will depend on your transaction runtime (kit/web3.js).
    signTransaction: adapter.signTransaction,
  } as unknown as TransactionSigner<string>;
}

export default {
  deriveManagerProfilePda,
  deriveVaultConfigPda,
  deriveVaultStatePda,
  deriveTreasuryPda,
  buildCreateVaultIx,
  buildDepositJuniorIx,
  buildUpdateNavIx,
  buildGraduateVaultIx,
  encodeName,
  makeManagerSignerFromAdapter,
};
