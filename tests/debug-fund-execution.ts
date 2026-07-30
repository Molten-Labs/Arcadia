import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const HELIUS_RPC = process.env.HELIUS_RPC || process.env.RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(HELIUS_RPC);
const PROGRAM_ID = new PublicKey("FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

function sha256Discriminator(name: string): Buffer {
  return require("crypto").createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function findPlatformConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("platform")], PROGRAM_ID);
}

function findTraderProfile(trader: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("profile"), trader.toBuffer()], PROGRAM_ID);
}

async function getBalance(conn: Connection, pk: PublicKey): Promise<bigint> {
  const info = await conn.getAccountInfo(pk);
  if (!info) return 0n;
  return info.data.readBigUInt64LE(64);
}

async function getOrCreateAta(conn: Connection, mint: PublicKey, owner: PublicKey, payer: Keypair): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, true);
  const info = await conn.getAccountInfo(ata);
  if (info) return ata;
  const tx = new Transaction().add(createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint));
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  await conn.sendRawTransaction(tx.serialize());
  return ata;
}

async function main() {
  const adminPath = join(homedir(), ".config/solana/id.json");
  if (!existsSync(adminPath)) { console.error("No admin keypair"); process.exit(1); }
  const admin = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(adminPath, "utf-8"))));

  const [configPda] = findPlatformConfig();
  const [profilePda] = findTraderProfile(admin.publicKey);

  // Read vault token from profile data
  const profileInfo = await connection.getAccountInfo(profilePda);
  if (!profileInfo) throw new Error("Profile PDA not found");
  const vaultTokenPk = new PublicKey(profileInfo.data.slice(72, 104));

  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Profile PDA:", profilePda.toBase58());
  console.log("Vault token:", vaultTokenPk.toBase58());

  const vaultBal = await getBalance(connection, vaultTokenPk);
  console.log("Vault USDC:", Number(vaultBal) / 1e6);

  if (vaultBal < 5_000_000n) {
    console.log("Vault too low, need to deposit first");
    return;
  }

  const execSeed = randomBytes(32);
  const execKp = Keypair.fromSeed(execSeed);
  const execAta = await getOrCreateAta(connection, USDC_MINT, execKp.publicKey, admin);

  console.log("\nExecution wallet:", execKp.publicKey.toBase58());
  console.log("Execution ATA:", execAta.toBase58());

  // Verify
  console.log("\nAccount verification:");
  const va = await connection.getAccountInfo(vaultTokenPk);
  console.log("vault_token owner:", va?.owner.toBase58(), "len:", va?.data.length);
  const ma = await connection.getAccountInfo(USDC_MINT);
  console.log("USDC mint owner:", ma?.owner.toBase58(), "len:", ma?.data.length);
  const ea = await connection.getAccountInfo(execAta);
  console.log("exec ATA owner:", ea?.owner.toBase58(), "len:", ea?.data.length);
  const ca = await connection.getAccountInfo(configPda);
  console.log("config exists:", !!ca, "len:", ca?.data.length);
  const pa = await connection.getAccountInfo(profilePda);
  console.log("profile exists:", !!pa, "len:", pa?.data.length);

  // Build fund_execution
  const amount = 5_000_000n;
  const fundBuf = Buffer.alloc(8);
  fundBuf.writeBigUInt64LE(amount);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: vaultTokenPk, isSigner: false, isWritable: true },
      { pubkey: execAta, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([sha256Discriminator("fund_execution"), fundBuf]),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);

  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 0 });
  console.log("\nSignature:", sig);

  await new Promise(r => setTimeout(r, 10000));
  const txInfo = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0 });
  if (txInfo) {
    console.log("Logs:", txInfo.meta?.logMessages);
    console.log("Error:", txInfo.meta?.err);
  } else {
    console.log("Transaction not found yet");
    const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
    console.log("Status:", JSON.stringify(status));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
