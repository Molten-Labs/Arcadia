import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  MANAGER_PROFILE_SEED,
  VAULT_CONFIG_SEED,
  VAULT_STATE_SEED,
  TREASURY_SEED,
  INVESTOR_POSITION_SEED,
  PRIVATE_INTENT_SESSION_SEED,
  MAGICBLOCK_PERMISSION_SEED,
  MAGICBLOCK_DELEGATION_BUFFER_SEED,
  MAGICBLOCK_DELEGATION_RECORD_SEED,
  MAGICBLOCK_DELEGATION_METADATA_SEED,
  MAGICBLOCK_DELEGATION_PROGRAM_ID,
  MAGICBLOCK_PERMISSION_PROGRAM_ID,
} from "./constants";

export function getManagerProfilePDA(manager: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MANAGER_PROFILE_SEED, manager.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultConfigPDA(
  manager: PublicKey,
  vaultIndex: number
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(vaultIndex);
  return PublicKey.findProgramAddressSync(
    [VAULT_CONFIG_SEED, manager.toBuffer(), indexBuf],
    PROGRAM_ID
  );
}

export function getVaultStatePDA(
  vaultConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_STATE_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID
  );
}

export function getTreasuryPDA(
  vaultConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, vaultConfig.toBuffer()],
    PROGRAM_ID
  );
}

export function getInvestorPositionPDA(
  investor: PublicKey,
  vaultConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INVESTOR_POSITION_SEED, investor.toBuffer(), vaultConfig.toBuffer()],
    PROGRAM_ID
  );
}

export function getPrivateIntentSessionPDA(
  vaultConfig: PublicKey,
  sessionId: Buffer,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PRIVATE_INTENT_SESSION_SEED, vaultConfig.toBuffer(), sessionId],
    PROGRAM_ID,
  );
}

export function getMagicBlockPermissionPDA(
  permissionedAccount: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MAGICBLOCK_PERMISSION_SEED, permissionedAccount.toBuffer()],
    MAGICBLOCK_PERMISSION_PROGRAM_ID,
  );
}

export function getMagicBlockDelegationBufferPDA(
  delegatedAccount: PublicKey,
  ownerProgram: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MAGICBLOCK_DELEGATION_BUFFER_SEED, delegatedAccount.toBuffer()],
    ownerProgram,
  );
}

export function getMagicBlockDelegationRecordPDA(
  delegatedAccount: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MAGICBLOCK_DELEGATION_RECORD_SEED, delegatedAccount.toBuffer()],
    MAGICBLOCK_DELEGATION_PROGRAM_ID,
  );
}

export function getMagicBlockDelegationMetadataPDA(
  delegatedAccount: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MAGICBLOCK_DELEGATION_METADATA_SEED, delegatedAccount.toBuffer()],
    MAGICBLOCK_DELEGATION_PROGRAM_ID,
  );
}
