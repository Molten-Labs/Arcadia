import { useCallback } from "react";
import {
  Transaction,
  TransactionInstruction,
  SystemProgram,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@/lib/wallet";
import { PROGRAM_ID } from "@/lib/solana/constants";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ORACLE_PRICE_SEED,
  SOL_MINT,
  TOKEN_PROGRAM_ID,
  USDC_MINT,
} from "@/lib/solana/constants";
import {
  getManagerProfilePDA,
  getVaultConfigPDA,
  getVaultStatePDA,
  getTreasuryPDA,
  getInvestorPositionPDA,
} from "@/lib/solana/pdas";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type JupiterRoute = "SolToUsdc" | "UsdcToSol";

interface JupiterAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

interface ExecuteJupiterSwapParams {
  route: JupiterRoute;
  inAmount: bigint;
  minimumAmountOut: bigint;
  maxSlippageBps: number;
  quoteExpiryUnix: bigint;
  jupiterProgram: PublicKey;
  tokenProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  solPriceAccount: PublicKey;
  usdcPriceAccount: PublicKey;
  jupiterInstructionData: Buffer;
  jupiterAccounts: JupiterAccountMeta[];
}

function buildInstruction(
  discriminator: number,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data?: Buffer
): TransactionInstruction {
  const disc = Buffer.alloc(1);
  disc[0] = discriminator;
  const ixData = data ? Buffer.concat([disc, data]) : disc;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: ixData,
  });
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function getCustodyTokenAccounts(treasury: PublicKey) {
  return {
    vaultUsdc: getAssociatedTokenAddress(treasury, USDC_MINT),
    vaultWsol: getAssociatedTokenAddress(treasury, SOL_MINT),
  };
}

function getOraclePriceAccounts() {
  const derivedSol = PublicKey.findProgramAddressSync(
    [ORACLE_PRICE_SEED, Buffer.from([1])],
    PROGRAM_ID,
  )[0];
  const derivedUsdc = PublicKey.findProgramAddressSync(
    [ORACLE_PRICE_SEED, Buffer.from([2])],
    PROGRAM_ID,
  )[0];
  return {
    solPrice: derivedSol,
    usdcPrice: derivedUsdc,
  };
}

function buildOraclePriceIx(
  payer: PublicKey,
  priceAccount: PublicKey,
  feed: 1 | 2,
  price: bigint,
  confidence: bigint,
) {
  const data = Buffer.alloc(17);
  data.writeUInt8(feed, 0);
  data.writeBigUInt64LE(price, 1);
  data.writeBigUInt64LE(confidence, 9);
  return buildInstruction(10, [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: priceAccount, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

function buildDevnetOracleRefreshIxs(payer: PublicKey) {
  const { solPrice, usdcPrice } = getOraclePriceAccounts();
  const scale = 1_000_000n;
  return [
    buildOraclePriceIx(payer, solPrice, 1, 150n * scale, 1_500_000n),
    buildOraclePriceIx(payer, usdcPrice, 2, scale, 10_000n),
  ];
}

export function useKilnTransactions() {
  const { connection } = useWallet();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const queryClient = useQueryClient();

  const send = useCallback(
    async (ixOrIxs: TransactionInstruction | TransactionInstruction[], label: string) => {
      if (!connection || !publicKey) throw new Error("Wallet not connected");
      const instructions = Array.isArray(ixOrIxs) ? ixOrIxs : [ixOrIxs];
      const tx = new Transaction().add(...instructions);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendTransaction(tx, connection);
      toast.info(`${label} submitted`, { description: sig.slice(0, 16) + "..." });

      const confirmation = await connection.confirmTransaction(sig, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });

      toast.success(`${label} confirmed`, { description: sig.slice(0, 16) + "..." });
      return sig;
    },
    [connection, publicKey, sendTransaction, queryClient]
  );

  // Disc 0: [manager, profile, rent, clock, system_program]
  const initManager = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");
    const [profilePda] = getManagerProfilePDA(publicKey);
    const ix = buildInstruction(0, [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ]);
    return send(ix, "Init Manager");
  }, [publicKey, send]);

  // Disc 1: [manager, profile, config, state, treasury, rent, clock, system_program]
  // Args layout (48 bytes): paperWindowSecs(i64,8) | minQualifyingTrades(u16,2) | maxSlippageBps(u16,2) | managerFeeBps(u16,2) | reserved(2) | name([u8;32],32)
  const createVault = useCallback(
    async (params: {
      name: string;
      feeBps: number;
      maxSlippageBps: number;
      paperWindowSecs: number;
      minQualifyingTrades?: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);

      if (!connection) throw new Error("No connection");
      const profileInfo = await connection.getAccountInfo(profilePda);
      let vaultIndex = 0;
      if (profileInfo) {
        vaultIndex = Buffer.from(profileInfo.data).readUInt16LE(56);
      }

      const [configPda] = getVaultConfigPDA(publicKey, vaultIndex);
      const [statePda] = getVaultStatePDA(configPda);
      const [treasuryPda] = getTreasuryPDA(configPda);

      const data = Buffer.alloc(48);
      let offset = 0;
      data.writeBigInt64LE(BigInt(params.paperWindowSecs), offset); offset += 8;
      data.writeUInt16LE(params.minQualifyingTrades ?? 10, offset); offset += 2;
      data.writeUInt16LE(params.maxSlippageBps, offset); offset += 2;
      data.writeUInt16LE(params.feeBps, offset); offset += 2;
      data.writeUInt16LE(0, offset); offset += 2; // reserved
      const nameBytes = Buffer.from(params.name, "utf8").subarray(0, 32);
      nameBytes.copy(data, offset);

      const ix = buildInstruction(1, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Create Vault");
    },
    [publicKey, connection, send]
  );

  // Disc 2 USDC: [manager, profile, vault_config, vault_state, treasury, manager_usdc, vault_usdc, token_program, clock, system_program]
  const depositJunior = useCallback(
    async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const { vaultUsdc } = getCustodyTokenAccounts(treasuryPda);
      const managerUsdc = getAssociatedTokenAddress(publicKey, USDC_MINT);
      const ensureManagerUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        managerUsdc,
        publicKey,
        USDC_MINT,
      );
      const ensureVaultUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultUsdc,
        treasuryPda,
        USDC_MINT,
      );

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(usdcUnits, 0);

      const ix = buildInstruction(2, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: managerUsdc, isSigner: false, isWritable: true },
        { pubkey: vaultUsdc, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send([ensureManagerUsdc, ensureVaultUsdc, ix], "Deposit Junior");
    },
    [publicKey, send]
  );

  // Disc 5 USDC: [investor, vault_config, vault_state, treasury, investor_position, investor_usdc, vault_usdc, token_program, rent, clock, system_program]
  const depositSenior = useCallback(
    async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const [positionPda] = getInvestorPositionPDA(publicKey, vaultConfigPubkey);
      const { vaultUsdc } = getCustodyTokenAccounts(treasuryPda);
      const investorUsdc = getAssociatedTokenAddress(publicKey, USDC_MINT);
      const ensureInvestorUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        investorUsdc,
        publicKey,
        USDC_MINT,
      );
      const ensureVaultUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultUsdc,
        treasuryPda,
        USDC_MINT,
      );

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(usdcUnits, 0);

      const ix = buildInstruction(5, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: investorUsdc, isSigner: false, isWritable: true },
        { pubkey: vaultUsdc, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send([ensureInvestorUsdc, ensureVaultUsdc, ix], "Deposit Senior");
    },
    [publicKey, send]
  );

  // Disc 6 USDC: [investor, vault_config, vault_state, treasury, investor_position, vault_usdc, vault_wsol, investor_usdc, sol_price, usdc_price, token_program, clock]
  const withdrawSenior = useCallback(
    async (vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const [positionPda] = getInvestorPositionPDA(publicKey, vaultConfigPubkey);
      const { vaultUsdc, vaultWsol } = getCustodyTokenAccounts(treasuryPda);
      const investorUsdc = getAssociatedTokenAddress(publicKey, USDC_MINT);
      const { solPrice, usdcPrice } = getOraclePriceAccounts();
      const refreshPrices = buildDevnetOracleRefreshIxs(publicKey);
      const ensureInvestorUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        investorUsdc,
        publicKey,
        USDC_MINT,
      );
      const ensureVaultUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultUsdc,
        treasuryPda,
        USDC_MINT,
      );
      const ensureVaultWsol = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultWsol,
        treasuryPda,
        SOL_MINT,
      );

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(amountUsdcUnits, 0);

      const ix = buildInstruction(6, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: vaultUsdc, isSigner: false, isWritable: true },
        { pubkey: vaultWsol, isSigner: false, isWritable: true },
        { pubkey: investorUsdc, isSigner: false, isWritable: true },
        { pubkey: solPrice, isSigner: false, isWritable: false },
        { pubkey: usdcPrice, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ], data);
      return send([
        ensureInvestorUsdc,
        ensureVaultUsdc,
        ensureVaultWsol,
        ...refreshPrices,
        ix,
      ], "Withdraw Senior");
    },
    [publicKey, send]
  );

  // Disc 7 USDC: [manager, manager_profile, vault_config, vault_state, treasury, vault_usdc, manager_usdc, token_program, clock]
  const withdrawJunior = useCallback(
    async (vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const { vaultUsdc } = getCustodyTokenAccounts(treasuryPda);
      const managerUsdc = getAssociatedTokenAddress(publicKey, USDC_MINT);
      const ensureManagerUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        managerUsdc,
        publicKey,
        USDC_MINT,
      );
      const ensureVaultUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultUsdc,
        treasuryPda,
        USDC_MINT,
      );

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(amountUsdcUnits, 0);

      const ix = buildInstruction(7, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: vaultUsdc, isSigner: false, isWritable: true },
        { pubkey: managerUsdc, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ], data);
      return send([ensureManagerUsdc, ensureVaultUsdc, ix], "Withdraw Junior");
    },
    [publicKey, send]
  );

  // Disc 3: [updater, vault_config, vault_state, treasury, pyth_placeholder, clock]
  const updateNav = useCallback(
    async (vaultConfigPubkey: PublicKey) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const { vaultUsdc, vaultWsol } = getCustodyTokenAccounts(treasuryPda);
      const { solPrice, usdcPrice } = getOraclePriceAccounts();
      const data = Buffer.from([0]);
      const refreshPrices = buildDevnetOracleRefreshIxs(publicKey);
      const ensureVaultUsdc = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultUsdc,
        treasuryPda,
        USDC_MINT,
      );
      const ensureVaultWsol = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        vaultWsol,
        treasuryPda,
        SOL_MINT,
      );

      const ix = buildInstruction(3, [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: vaultUsdc, isSigner: false, isWritable: true },
        { pubkey: vaultWsol, isSigner: false, isWritable: true },
        { pubkey: solPrice, isSigner: false, isWritable: false },
        { pubkey: usdcPrice, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ], data);
      return send([
        ensureVaultUsdc,
        ensureVaultWsol,
        ...refreshPrices,
        ix,
      ], "Update NAV");
    },
    [publicKey, send]
  );

  // Disc 4: [caller, vault_state, vault_config, treasury, manager_profile, clock]
  const graduateVault = useCallback(
    async (vaultConfigPubkey: PublicKey, managerPubkey: PublicKey) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(managerPubkey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const ix = buildInstruction(4, [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ]);
      return send(ix, "Graduate Vault");
    },
    [publicKey, send]
  );

  // Disc 8: [manager, manager_profile, vault_config, vault_state, treasury, clock]
  const claimFees = useCallback(
    async (vaultConfigPubkey: PublicKey) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const ix = buildInstruction(8, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ]);
      return send(ix, "Claim Fees");
    },
    [publicKey, send]
  );

  // Disc 9: [manager, manager_profile, vault_config, vault_state, treasury, clock]
  const executeSwap = useCallback(
    async (vaultConfigPubkey: PublicKey, inAmount: bigint, minimumAmountOut: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const data = Buffer.alloc(16);
      data.writeBigUInt64LE(inAmount, 0);
      data.writeBigUInt64LE(minimumAmountOut, 8);

      const ix = buildInstruction(9, [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Execute Swap");
    },
    [publicKey, send]
  );

  // Disc 9 extended: fixed Arcadia validation accounts followed by Jupiter route accounts.
  const executeJupiterSwap = useCallback(
    async (vaultConfigPubkey: PublicKey, params: ExecuteJupiterSwapParams) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const data = Buffer.alloc(32 + params.jupiterInstructionData.length);
      data.writeUInt8(params.route === "SolToUsdc" ? 1 : 2, 0);
      data.writeUInt8(0, 1);
      data.writeUInt16LE(params.maxSlippageBps, 2);
      data.writeUInt32LE(0, 4);
      data.writeBigUInt64LE(params.inAmount, 8);
      data.writeBigUInt64LE(params.minimumAmountOut, 16);
      data.writeBigInt64LE(BigInt(params.quoteExpiryUnix), 24);
      params.jupiterInstructionData.copy(data, 32);

      const ix = buildInstruction(9, [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: params.jupiterProgram, isSigner: false, isWritable: false },
        { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: params.sourceTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.destinationTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.solPriceAccount, isSigner: false, isWritable: false },
        { pubkey: params.usdcPriceAccount, isSigner: false, isWritable: false },
        ...params.jupiterAccounts,
      ], data);
      return send(ix, "Execute Jupiter Swap");
    },
    [publicKey, send]
  );

  return {
    initManager,
    createVault,
    depositJunior,
    depositSenior,
    withdrawSenior,
    withdrawJunior,
    updateNav,
    graduateVault,
    claimFees,
    executeSwap,
    executeJupiterSwap,
  };
}
