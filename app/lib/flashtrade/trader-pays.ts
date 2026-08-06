import { BN } from "@coral-xyz/anchor";
import { hash } from "tweetnacl";
import {
  ComputeBudgetProgram,
  Keypair,
  MessageV0,
  VersionedTransaction,
  type PublicKey,
  type Signer,
  type TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { FlashPerpetualsClient } from "@flash_trade/flash-sdk-v2";
import type {
  FlashTradeExecutionClient,
  FlashTradeResolvedMarket,
} from "./v2";

/**
 * Trader-pays Flash execution.
 *
 * The trader's identity wallet (Privy embedded wallet) is the SOLE fee payer
 * and rent payer on the base chain. The execution wallet is a deterministic
 * keypair derived from the identity — it owns the Flash basket and deposit
 * ledger but never holds SOL. All base-chain txs (setup + deposit) are batched
 * into a single message signed once by the identity. Open/close run on the
 * MagicBlock Ephemeral Rollup and are signed by the execution keypair
 * (fee-sponsored by MagicBlock, so the execution wallet still needs no SOL).
 */

export type IdentitySigner = {
  publicKey: PublicKey;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

/**
 * Deterministic execution keypair for an identity.
 *
 * The identity signs the domain-separated message "arcadia-flash-v1" (Privy
 * embedded-wallet `signMessage`, no popup); the 64-byte ed25519 signature is
 * sha512'd and the first 32 bytes become the ed25519 seed. Same identity +
 * message always yields the same execution wallet.
 */
export function deriveExecutionKeypair(signature: Uint8Array): Keypair {
  const seed = hash(signature).slice(0, 32);
  return Keypair.fromSeed(seed);
}

export function keypairIdentitySigner(keypair: Keypair): IdentitySigner {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      tx.sign([keypair]);
      return tx;
    },
  };
}

export type SendBaseAsTraderArgs = {
  client: FlashPerpetualsClient;
  instructions: TransactionInstruction[];
  identitySigner: IdentitySigner;
  additionalSigners?: Signer[];
  computeUnitLimit?: number;
  prioritizationFee?: number;
};

/**
 * Send base-chain instructions with the identity wallet as fee payer.
 *
 * The SDK's own `sendAndConfirmTransaction` hardcodes the provider wallet as
 * the MessageV0 fee payer. Here the message is compiled with the identity as
 * `payerKey`, additional signers (e.g. a temp WSOL keypair) are pre-signed, and
 * the identity wallet signs the fee-payer slot last — exactly one popup per
 * base transaction.
 */
export async function sendBaseAsTrader(args: SendBaseAsTraderArgs): Promise<string> {
  const connection = args.client.provider.connection;
  const budgetIxs: TransactionInstruction[] = [];
  if (args.computeUnitLimit) {
    budgetIxs.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: args.computeUnitLimit }),
    );
  }
  if (args.prioritizationFee) {
    budgetIxs.push(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: args.prioritizationFee }),
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const message = MessageV0.compile({
    payerKey: args.identitySigner.publicKey,
    instructions: [...budgetIxs, ...args.instructions],
    recentBlockhash: latestBlockhash.blockhash,
  });

  let tx = new VersionedTransaction(message);
  if (args.additionalSigners?.length) {
    tx.sign(args.additionalSigners);
  }
  tx = await args.identitySigner.signTransaction(tx);

  const signature = await connection.sendTransaction(tx, {
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });
  const result = await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
  if (result.value.err) {
    throw new Error(`Base tx failed: ${JSON.stringify(result.value.err)} (sig ${signature})`);
  }
  return signature;
}

/**
 * The SDK builders set the execution wallet as the rent `payer` (signer) of
 * each base instruction. Under trader-pays the identity pays rent instead, so
 * swap the execution pubkey → identity pubkey on every signer meta. Non-signer
 * `owner` metas (structural, PDA-derived) are left as the execution wallet.
 */
function rebasePayer(
  instructions: TransactionInstruction[],
  executionPubkey: PublicKey,
  identityPubkey: PublicKey,
): TransactionInstruction[] {
  return instructions.map((instruction) => ({
    ...instruction,
    keys: instruction.keys.map((key) =>
      key.pubkey.equals(executionPubkey) && key.isSigner
        ? { ...key, pubkey: identityPubkey }
        : key,
    ),
  }));
}

export type TraderSetupAndDepositArgs = {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
  amount: BN;
  identitySigner: IdentitySigner;
  /** Override the collateral token mint (default: resolvedMarket.collateralSymbol). */
  collateralMintOverride?: PublicKey;
};

export type TraderSetupAndDepositResult = {
  signature: string;
  /** Setup instructions included (0 when the wallet is already fully set up). */
  setupIxCount: number;
};

/**
 * One-popup base-chain batch: initialize ledger + basket + delegate + deposit,
 * all in a single identity-signed transaction. Setup instructions are
 * idempotent (the SDK builders skip whatever already exists), so re-trades cost
 * only the deposit.
 */
export async function traderSetupAndDeposit(
  args: TraderSetupAndDepositArgs,
): Promise<TraderSetupAndDepositResult> {
  const { client, keypair } = args.executionClient;
  const lockToken = args.resolvedMarket.poolConfig.getTokenFromSymbol(
    args.resolvedMarket.collateralSymbol,
  );
  const fundMint = args.collateralMintOverride ?? lockToken.mintKey;
  const fundTokenProgramId = args.collateralMintOverride
    ? undefined
    : (lockToken.isToken2022 ? TOKEN_2022_PROGRAM_ID : undefined);

  const ledger = await client.initializeUserDepositLedger();
  const basket = await client.initializeBasket();
  const delegate = await client.delegateBasket(keypair.publicKey);

  // Depositor is the identity wallet: the trader's own USDC funds the ledger and
  // the identity pays ATA rent + tx fee. The ledger stays owned by the execution
  // wallet (the SDK derives it from the provider wallet pubkey).
  const deposit = await client.depositDirect(
    fundMint,
    args.amount,
    fundTokenProgramId,
    args.identitySigner.publicKey,
  );

  const instructions = [
    ...ledger.instructions,
    ...basket.instructions,
    ...delegate.instructions,
    ...deposit.instructions,
  ];
  const additionalSigners = [
    ...(ledger.additionalSigners ?? []),
    ...(basket.additionalSigners ?? []),
    ...(delegate.additionalSigners ?? []),
    ...(deposit.additionalSigners ?? []),
  ];

  const signature = await sendBaseAsTrader({
    client,
    instructions: rebasePayer(instructions, keypair.publicKey, args.identitySigner.publicKey),
    identitySigner: args.identitySigner,
    additionalSigners,
  });

  return {
    signature,
    setupIxCount:
      ledger.instructions.length +
      basket.instructions.length +
      delegate.instructions.length,
  };
}
