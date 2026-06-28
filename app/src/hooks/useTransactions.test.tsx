import { renderHook, act } from "@testing-library/react";
import {
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.VITE_PYTH_SOL_USD_ACCOUNT = "So11111111111111111111111111111111111111112";
  process.env.VITE_PYTH_USDC_USD_ACCOUNT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
});

import { useKilnTransactions } from "./useTransactions";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  PROGRAM_ID,
  ORACLE_PRICE_SEED,
  SOL_MINT,
  TOKEN_PROGRAM_ID,
  USDC_MINT,
} from "@/lib/solana/constants";

const mocks = vi.hoisted(() => ({
  publicKey: undefined as unknown,
  connection: {
    getLatestBlockhash: vi.fn(),
    confirmTransaction: vi.fn(),
    getAccountInfo: vi.fn(),
  },
  sendTransaction: vi.fn(),
  invalidateQueries: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  profilePdasByOwner: {} as Record<string, unknown>,
  vaultConfigPda: undefined as unknown,
  vaultStatePda: undefined as unknown,
  treasuryPda: undefined as unknown,
  investorPositionPda: undefined as unknown,
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: mocks.publicKey,
    sendTransaction: mocks.sendTransaction,
  }),
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    connection: mocks.connection,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/lib/solana/pdas", () => ({
  getManagerProfilePDA: (owner: { toBase58: () => string }) => [
    mocks.profilePdasByOwner[owner.toBase58()],
    255,
  ],
  getVaultConfigPDA: () => [mocks.vaultConfigPda, 255],
  getVaultStatePDA: () => [mocks.vaultStatePda, 255],
  getTreasuryPDA: () => [mocks.treasuryPda, 255],
  getInvestorPositionPDA: () => [mocks.investorPositionPda, 255],
}));

vi.mock("sonner", () => ({
  toast: {
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

function key(seed: number): PublicKey {
  return Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
}

function lastInstruction(): TransactionInstruction {
  const call = mocks.sendTransaction.mock.calls.at(-1);
  expect(call).toBeDefined();
  const tx = call?.[0] as Transaction;
  const programIx = tx.instructions.filter((ix) => ix.programId.toBase58() === PROGRAM_ID.toBase58()).at(-1);
  expect(programIx).toBeDefined();
  return programIx!;
}

async function invoke(
  callback: () => Promise<string>,
): Promise<TransactionInstruction> {
  await act(async () => {
    await callback();
  });
  return lastInstruction();
}

function expectKey(
  ix: TransactionInstruction,
  index: number,
  pubkey: PublicKey,
  isSigner: boolean,
  isWritable: boolean,
) {
  expect(ix.keys[index].pubkey.toBase58()).toBe(pubkey.toBase58());
  expect(ix.keys[index].isSigner).toBe(isSigner);
  expect(ix.keys[index].isWritable).toBe(isWritable);
}

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function priceFeed(feed: 1 | 2): PublicKey {
  return PublicKey.findProgramAddressSync([ORACLE_PRICE_SEED, Buffer.from([feed])], PROGRAM_ID)[0];
}

describe("useKilnTransactions", () => {
  const manager = key(1);
  const investor = key(2);
  const caller = key(3);
  const managerProfilePda = key(10);
  const callerProfilePda = key(11);
  const vaultConfigPda = key(12);
  const vaultStatePda = key(13);
  const treasuryPda = key(14);
  const investorPositionPda = key(15);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PublicKey, "findProgramAddressSync").mockImplementation((seeds) => {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < seeds.length; i += 1) {
        const seed = seeds[i];
        for (let j = 0; j < seed.length; j += 1) {
          bytes[j % 32] ^= seed[j] ^ i;
        }
      }
      return [new PublicKey(bytes), 255];
    });
    mocks.publicKey = manager;
    mocks.profilePdasByOwner = {
      [manager.toBase58()]: managerProfilePda,
      [caller.toBase58()]: callerProfilePda,
      [investor.toBase58()]: key(16),
    };
    mocks.vaultConfigPda = vaultConfigPda;
    mocks.vaultStatePda = vaultStatePda;
    mocks.treasuryPda = treasuryPda;
    mocks.investorPositionPda = investorPositionPda;
    mocks.connection.getLatestBlockhash.mockResolvedValue({
      blockhash: "11111111111111111111111111111111",
    });
    mocks.connection.confirmTransaction.mockResolvedValue({ value: { err: null } });
    mocks.connection.getAccountInfo.mockResolvedValue(null);
    mocks.sendTransaction.mockResolvedValue(
      "4Nd1mVa4LZSGHqWb5xBfXMCjjQKC9WdYFFjABhpJZFnYyBYjNWG3g4x21Lw4fQLq7sPxg2CqNmVTQcVNJb6i7aG",
    );
  });

  it("builds manager lifecycle instructions with exact program account order", async () => {
    const { result } = renderHook(() => useKilnTransactions());

    let ix = await invoke(() => result.current.initManager());
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID.toBase58());
    expect(Buffer.from(ix.data).equals(Buffer.from([0]))).toBe(true);
    expectKey(ix, 0, manager, true, true);
    expectKey(ix, 1, managerProfilePda, false, true);
    expectKey(ix, 2, SYSVAR_RENT_PUBKEY, false, false);
    expectKey(ix, 3, SYSVAR_CLOCK_PUBKEY, false, false);
    expectKey(ix, 4, SystemProgram.programId, false, false);

    ix = await invoke(() =>
      result.current.createVault({
        name: "Arcadia Test",
        feeBps: 2_000,
        maxSlippageBps: 50,
        paperWindowSecs: 86_400,
        minQualifyingTrades: 3,
      }),
    );
    expect(ix.data[0]).toBe(1);
    expect(ix.data.readBigInt64LE(1)).toBe(86_400n);
    expect(ix.data.readUInt16LE(9)).toBe(3);
    expect(ix.data.readUInt16LE(11)).toBe(50);
    expect(ix.data.readUInt16LE(13)).toBe(2_000);
    expectKey(ix, 0, manager, true, true);
    expectKey(ix, 1, managerProfilePda, false, true);
    expectKey(ix, 2, vaultConfigPda, false, true);
    expectKey(ix, 3, vaultStatePda, false, true);
    expectKey(ix, 4, treasuryPda, false, true);
    expectKey(ix, 5, SYSVAR_RENT_PUBKEY, false, false);
    expectKey(ix, 6, SYSVAR_CLOCK_PUBKEY, false, false);
    expectKey(ix, 7, SystemProgram.programId, false, false);

    ix = await invoke(() => result.current.depositJunior(vaultConfigPda, 5_000_000_000n));
    expect(ix.data[0]).toBe(2);
    expect(ix.data.readBigUInt64LE(1)).toBe(5_000_000_000n);
    expectKey(ix, 0, manager, true, true);
    expectKey(ix, 1, managerProfilePda, false, true);
    expectKey(ix, 2, vaultConfigPda, false, false);
    expectKey(ix, 3, vaultStatePda, false, true);
    expectKey(ix, 4, treasuryPda, false, false);
    expectKey(ix, 5, ata(manager, USDC_MINT), false, true);
    expectKey(ix, 6, ata(treasuryPda, USDC_MINT), false, true);
    expectKey(ix, 7, TOKEN_PROGRAM_ID, false, false);
    expectKey(ix, 8, SYSVAR_CLOCK_PUBKEY, false, false);
    expectKey(ix, 9, SystemProgram.programId, false, false);

    ix = await invoke(() => result.current.withdrawJunior(vaultConfigPda, 1_000_000_000n));
    expect(ix.data[0]).toBe(7);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_000_000_000n);
    expectKey(ix, 0, manager, true, true);
    expectKey(ix, 1, managerProfilePda, false, true);
    expectKey(ix, 2, vaultConfigPda, false, false);
    expectKey(ix, 3, vaultStatePda, false, true);
    expectKey(ix, 4, treasuryPda, false, false);
    expectKey(ix, 5, ata(treasuryPda, USDC_MINT), false, true);
    expectKey(ix, 6, ata(manager, USDC_MINT), false, true);
    expectKey(ix, 7, TOKEN_PROGRAM_ID, false, false);
    expectKey(ix, 8, SYSVAR_CLOCK_PUBKEY, false, false);
  });

  it("builds permissionless nav, graduation, fee, and swap instructions", async () => {
    mocks.publicKey = caller;
    const { result } = renderHook(() => useKilnTransactions());

    let ix = await invoke(() => result.current.updateNav(vaultConfigPda));
    expect(Buffer.from(ix.data).equals(Buffer.from([3, 0]))).toBe(true);
    expectKey(ix, 0, caller, true, false);
    expectKey(ix, 1, vaultConfigPda, false, false);
    expectKey(ix, 2, vaultStatePda, false, true);
    expectKey(ix, 3, treasuryPda, false, false);
    expectKey(ix, 4, ata(treasuryPda, USDC_MINT), false, true);
    expectKey(ix, 5, ata(treasuryPda, SOL_MINT), false, true);
    expectKey(ix, 6, priceFeed(1), false, false);
    expectKey(ix, 7, priceFeed(2), false, false);
    expectKey(ix, 8, SYSVAR_CLOCK_PUBKEY, false, false);

    ix = await invoke(() => result.current.graduateVault(vaultConfigPda, manager));
    expect(Buffer.from(ix.data).equals(Buffer.from([4]))).toBe(true);
    expectKey(ix, 0, caller, true, false);
    expectKey(ix, 1, vaultStatePda, false, true);
    expectKey(ix, 2, vaultConfigPda, false, false);
    expectKey(ix, 3, treasuryPda, false, false);
    expectKey(ix, 4, managerProfilePda, false, true);
    expectKey(ix, 5, SYSVAR_CLOCK_PUBKEY, false, false);

    ix = await invoke(() => result.current.claimFees(vaultConfigPda));
    expect(Buffer.from(ix.data).equals(Buffer.from([8]))).toBe(true);
    expectKey(ix, 0, caller, true, true);
    expectKey(ix, 1, callerProfilePda, false, false);
    expectKey(ix, 2, vaultConfigPda, false, false);
    expectKey(ix, 3, vaultStatePda, false, true);
    expectKey(ix, 4, treasuryPda, false, true);
    expectKey(ix, 5, SYSVAR_CLOCK_PUBKEY, false, false);

    ix = await invoke(() => result.current.executeSwap(vaultConfigPda, 500_000_000n, 0n));
    expect(ix.data[0]).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(500_000_000n);
    expect(ix.data.readBigUInt64LE(9)).toBe(0n);
    expectKey(ix, 0, caller, true, false);
    expectKey(ix, 1, callerProfilePda, false, false);
    expectKey(ix, 2, vaultConfigPda, false, false);
    expectKey(ix, 3, vaultStatePda, false, true);
    expectKey(ix, 4, treasuryPda, false, true);
    expectKey(ix, 5, SYSVAR_CLOCK_PUBKEY, false, false);
  });

  it("builds investor deposit and withdrawal instructions", async () => {
    mocks.publicKey = investor;
    const { result } = renderHook(() => useKilnTransactions());

    let ix = await invoke(() => result.current.depositSenior(vaultConfigPda, 2_000_000_000n));
    expect(ix.data[0]).toBe(5);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_000_000_000n);
    expectKey(ix, 0, investor, true, true);
    expectKey(ix, 1, vaultConfigPda, false, false);
    expectKey(ix, 2, vaultStatePda, false, true);
    expectKey(ix, 3, treasuryPda, false, false);
    expectKey(ix, 4, investorPositionPda, false, true);
    expectKey(ix, 5, ata(investor, USDC_MINT), false, true);
    expectKey(ix, 6, ata(treasuryPda, USDC_MINT), false, true);
    expectKey(ix, 7, TOKEN_PROGRAM_ID, false, false);
    expectKey(ix, 8, SYSVAR_RENT_PUBKEY, false, false);
    expectKey(ix, 9, SYSVAR_CLOCK_PUBKEY, false, false);
    expectKey(ix, 10, SystemProgram.programId, false, false);

    ix = await invoke(() => result.current.withdrawSenior(vaultConfigPda, 1_000_000_000n));
    expect(ix.data[0]).toBe(6);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_000_000_000n);
    expectKey(ix, 0, investor, true, true);
    expectKey(ix, 1, vaultConfigPda, false, false);
    expectKey(ix, 2, vaultStatePda, false, true);
    expectKey(ix, 3, treasuryPda, false, false);
    expectKey(ix, 4, investorPositionPda, false, true);
    expectKey(ix, 5, ata(treasuryPda, USDC_MINT), false, true);
    expectKey(ix, 6, ata(treasuryPda, SOL_MINT), false, true);
    expectKey(ix, 7, ata(investor, USDC_MINT), false, true);
    expectKey(ix, 8, priceFeed(1), false, false);
    expectKey(ix, 9, priceFeed(2), false, false);
    expectKey(ix, 10, TOKEN_PROGRAM_ID, false, false);
    expectKey(ix, 11, SYSVAR_CLOCK_PUBKEY, false, false);
  });
});
