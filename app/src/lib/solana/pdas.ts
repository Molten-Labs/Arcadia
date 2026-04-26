import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  MANAGER_PROFILE_SEED,
  VAULT_CONFIG_SEED,
  VAULT_STATE_SEED,
  TREASURY_SEED,
  INVESTOR_POSITION_SEED,
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
