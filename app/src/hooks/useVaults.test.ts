import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ connection: null }),
}));

import { decodeVaultState } from "@/lib/solana/accounts";
import type { VaultConfigData, VaultStateData } from "@/lib/solana/accounts";
import { toVaultView } from "./useVaults";

function key(seed: number): PublicKey {
  return Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
}

describe("vault account views", () => {
  it("decodes vault share counts from account bytes", () => {
    const vaultConfig = key(1);
    const data = Buffer.alloc(144);
    data[0] = 3;
    data[2] = 1;
    vaultConfig.toBuffer().copy(data, 8);
    data.writeBigUInt64LE(3_000_000_000n, 48);
    data.writeBigUInt64LE(4_000_000_000n, 56);
    data.writeBigUInt64LE(1_500_000_000n, 64);
    data.writeBigUInt64LE(2_500_000_000n, 72);

    const decoded = decodeVaultState(data);

    expect(decoded.juniorSharesOutstanding).toBe(1_500_000_000n);
    expect(decoded.seniorSharesOutstanding).toBe(2_500_000_000n);
  });

  it("surfaces exact bigint values alongside display USDC values", () => {
    const manager = key(2);
    const managerProfile = key(3);
    const configPubkey = key(4);
    const vaultState = key(5);
    const treasury = key(6);

    const config: VaultConfigData = {
      discriminator: 2,
      configBump: 1,
      stateBump: 2,
      treasuryBump: 3,
      managerFeeBps: 2_000,
      maxSlippageBps: 100,
      manager,
      managerProfile,
      vaultState,
      treasury,
      paperWindowSecs: 2_592_000n,
      createdAt: 1_700_000_000n,
      treasuryRentLamports: 890_880n,
      vaultIndex: 7,
      name: "Parity Vault",
    };
    const state: VaultStateData = {
      discriminator: 3,
      bump: 4,
      isPaperMode: true,
      isGraduated: false,
      isPaused: false,
      tradingEnabled: true,
      vaultConfig: configPubkey,
      originalJuniorDeposit: 1_000_000n,
      juniorCapital: 3_000_000n,
      seniorCapital: 4_000_000n,
      juniorSharesOutstanding: 1_500_000n,
      seniorSharesOutstanding: 2_500_000n,
      currentNav: 7_000_000n,
      lastNav: 6_500_000n,
      highWaterMark: 6_000_000n,
      createdAt: 1_700_000_000n,
      lastNavUpdateAt: 1_700_000_100n,
      graduatedAt: 0n,
      cooldownUntil: 0n,
      paperTradeCount: 10,
      minQualifyingTrades: 10,
      rolling24hLossBps: 0,
      rolling7dLossBps: 0,
    };

    const view = toVaultView({ configPubkey, config, state });

    expect(view?.juniorCapital).toBe(3);
    expect(view?.juniorCapitalLamports).toBe(3_000_000n);
    expect(view?.seniorSharesOutstanding).toBe(2_500_000);
    expect(view?.seniorSharesOutstandingRaw).toBe(2_500_000n);
    expect(view?.originalJuniorDepositLamports).toBe(1_000_000n);
    expect(view?.paperWindowSecs).toBe(2_592_000);
  });
});
