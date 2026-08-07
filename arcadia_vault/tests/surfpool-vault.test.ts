/**
 * Surfpool integration test for the FINAL arcadia_vault binary.
 *
 * Why this exists: the devnet-deployed binary is stale relative to current
 * source (its PlatformConfig uses the old 141-byte layout; current source is
 * the 173-byte layout). Forking devnet would (a) exercise the OLD binary and
 * (b) collide with the stale deterministic PDAs left from prior deploys, which
 * the new IDL cannot even decode. So this suite boots an in-process offline
 * surfnet, deploys the freshly-built local `target/deploy/arcadia_vault.so`,
 * creates a fresh 6-dec USDC-like mint, and runs the full
 * initialize -> set capacity -> seed deposit -> investor deposit ->
 * request/process withdraw vault flow against the FINAL binary.
 *
 * Run: npm run test:surfpool   (vitest run --config vitest.config.surfpool.ts)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Surfnet } from "@solana/surfpool";
import {
  AnchorProvider,
  Program,
  Wallet,
  BN,
  setProvider,
} from "@anchor-lang/core";
import { MintLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

/**
 * surfpool's WebSocket endpoint is unavailable, so @solana/web3.js
 * `Connection.confirmTransaction` (which confirms via WS signature
 * subscription) never resolves and anchor's sendAndConfirm times out.
 * getSignatureStatuses polling works fine, so override the confirm step.
 */
class PollingAnchorProvider extends AnchorProvider {
  async sendAndConfirm(
    tx: any,
    signers: Array<{ publicKey: PublicKey; secretKey: Uint8Array }>,
    opts: any,
  ): Promise<string> {
    if (opts === undefined) opts = this.opts;
    if ((tx as any).version) {
      if (signers) tx.sign(signers);
    } else {
      tx.feePayer = tx.feePayer || this.wallet.publicKey;
      if (
        !tx.recentBlockhash ||
        tx.recentBlockhash === "11111111111111111111111111111111"
      ) {
        tx.recentBlockhash = (
          await this.connection.getLatestBlockhash(opts.preflightCommitment)
        ).blockhash;
      }
      if (signers) {
        for (const signer of signers) tx.partialSign(signer);
      }
    }
    tx = await this.wallet.signTransaction(tx);
    const rawTx = tx.serialize();
    const signature = await this.connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
    });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: false,
      });
      const value = status.value;
      if (value) {
        if (value.err) {
          throw new Error(
            `Transaction ${signature} failed: ${JSON.stringify(value.err)}`,
          );
        }
        return signature;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Transaction ${signature} not confirmed within 60s`);
  }
}

const PROGRAM_ID = new PublicKey(
  "FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd",
);
const SECONDS_PER_DAY = 86_400;

const IDL: any = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "target/idl/arcadia_vault.json"),
    "utf8",
  ),
);
const SO_PATH = path.resolve(process.cwd(), "target/deploy/arcadia_vault.so");
const IDL_PATH = path.resolve(process.cwd(), "target/idl/arcadia_vault.json");

let surfnet: Surfnet;
let provider: AnchorProvider;
let program: Program;
let baseMint: PublicKey;
let payerKp: Keypair;
let admin: PublicKey;
let oracleAuthority: Keypair;
let processor: PublicKey;
let trader: Keypair;
let investor: Keypair;
let configPda: PublicKey;
let treasuryToken: PublicKey;
let profilePda: PublicKey;
let vaultToken: PublicKey;
let investorPda: PublicKey;
let positionPda: PublicKey;
let investorToken: PublicKey;

function findPdaPlatform(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID,
  );
}
function findPdaProfile(trader: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), trader.toBuffer()],
    PROGRAM_ID,
  );
}
function findPdaInvestor(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), wallet.toBuffer()],
    PROGRAM_ID,
  );
}
function findPdaPosition(
  owner: PublicKey,
  profile: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), owner.toBuffer(), profile.toBuffer()],
    PROGRAM_ID,
  );
}
function ata(owner: PublicKey): PublicKey {
  return new PublicKey(surfnet.getAta(owner.toBase58(), baseMint.toBase58()));
}
function lamports(amountUsdc: number): number {
  return amountUsdc * 1_000_000;
}
/** Create a funded, initialized 6-dec mint account via the setAccount cheatcode. */
function createFundedMint(mintAuthority: PublicKey): PublicKey {
  const mint = Keypair.generate();
  const data = Buffer.alloc(MintLayout.span);
  MintLayout.encode({ mintAuthority, isInitialized: 1 }, data);
  surfnet.setAccount(
    mint.publicKey.toBase58(),
    10_000_000_000,
    Array.from(data),
    TOKEN_PROGRAM_ID.toBase58(),
  );
  return mint.publicKey;
}

beforeAll(() => {
  surfnet = Surfnet.startWithConfig({
    blockProductionMode: "clock",
  });

  payerKp = Keypair.fromSecretKey(surfnet.payerSecretKey);
  provider = new PollingAnchorProvider(
    new Connection(surfnet.rpcUrl, "confirmed"),
    new Wallet(payerKp),
    { commitment: "confirmed", skipPreflight: true },
  );
  setProvider(provider);

  baseMint = createFundedMint(payerKp.publicKey);

  const deployed = surfnet.deploy({
    programId: PROGRAM_ID.toBase58(),
    soPath: SO_PATH,
    idlPath: IDL_PATH,
  });
  // eslint-disable-next-line no-console
  console.log("deployed program:", deployed);

  program = new Program(IDL, provider);
});

afterAll(() => {
  surfnet.stop();
});

describe("arcadia_vault final binary (offline surfpool)", () => {
  it("boots an offline surfnet; config not yet set", async () => {
    const bal = await provider.connection.getBalance(payerKp.publicKey);
    expect(Number(bal)).toBeGreaterThan(0);
    [configPda] = findPdaPlatform();
    const cfg: any = await program.account.platformConfig.fetchNullable(
      configPda.toBase58(),
    );
    expect(cfg).toBeNull();
  });

  it("initialize_platform pins the config", async () => {
    admin = payerKp.publicKey;
    oracleAuthority = Keypair.generate();
    processor = Keypair.generate().publicKey;
    treasuryToken = ata(payerKp.publicKey);
    surfnet.fundToken(
      payerKp.publicKey.toBase58(),
      baseMint.toBase58(),
      lamports(1_000_000),
    );

    await program.methods
      .initializePlatform(500, 100, oracleAuthority.publicKey, processor)
      .accounts({
        admin,
        config: configPda,
        baseMint,
        treasuryToken,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg: any = await program.account.platformConfig.fetch(configPda);
    expect(Number(cfg.perfFeeBps)).toBe(500);
    expect(Number(cfg.mgmtFeeBps)).toBe(100);
    expect(cfg.admin.toBase58()).toBe(admin.toBase58());
    expect(cfg.oracleAuthority.toBase58()).toBe(oracleAuthority.publicKey.toBase58());
    expect(cfg.processor.toBase58()).toBe(processor.toBase58());
  });

  it("initialize_profile + set_capacity create a fundable vault", async () => {
    trader = Keypair.generate();
    surfnet.fundSol(trader.publicKey.toBase58(), 10_000_000_000);

    [profilePda] = findPdaProfile(trader.publicKey);
    const vaultKeypair = Keypair.generate();
    vaultToken = vaultKeypair.publicKey;

    const tx = await program.methods
      .initializeProfile(10, 5000)
      .accounts({
        trader: trader.publicKey,
        config: configPda,
        profile: profilePda,
        baseMint,
        vaultToken,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([trader, vaultKeypair])
      .transaction();
    await provider.sendAndConfirm(tx, [trader, vaultKeypair], provider.opts);

    const p: any = await program.account.traderProfile.fetch(profilePda);
    expect(p.trader.toBase58()).toBe(trader.publicKey.toBase58());
    expect(Number(p.maxLeverage)).toBe(10);

    await program.methods
      .setCapacity(new BN(lamports(100_000)), 2)
      .accounts({ oracleAuthority: oracleAuthority.publicKey, config: configPda, profile: profilePda })
      .signers([oracleAuthority])
      .rpc();

    const p2: any = await program.account.traderProfile.fetch(profilePda);
    expect(Number(p2.capacityCapUsd)).toBe(lamports(100_000));
    expect(Number(p2.scoreTier)).toBe(2);
  });

  it("trader seeds the vault with an equity deposit", async () => {
    surfnet.fundToken(
      trader.publicKey.toBase58(),
      baseMint.toBase58(),
      lamports(1_000),
    );
    const traderToken = ata(trader.publicKey);
    const traderPos = findPdaPosition(trader.publicKey, profilePda)[0];
    const traderInvestorPda = findPdaInvestor(trader.publicKey)[0];

    await program.methods
      .initializeInvestor()
      .accounts({
        wallet: trader.publicKey,
        investorAccount: traderInvestorPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    await program.methods
      .deposit(new BN(lamports(1_000)))
      .accounts({
        depositor: trader.publicKey,
        investorAccount: traderInvestorPda,
        profile: profilePda,
        position: traderPos,
        baseMint,
        vaultToken,
        depositorToken: traderToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    const prof: any = await program.account.traderProfile.fetch(profilePda);
    expect(Number(prof.totalShares)).toBe(lamports(1_000));
  });

  it("investor initialize + deposit mints shares, then request/process withdraw", async () => {
    investor = Keypair.generate();
    surfnet.fundSol(investor.publicKey.toBase58(), 10_000_000_000);
    surfnet.fundToken(
      investor.publicKey.toBase58(),
      baseMint.toBase58(),
      lamports(10_000),
    );

    [investorPda] = findPdaInvestor(investor.publicKey);
    [positionPda] = findPdaPosition(investor.publicKey, profilePda);
    investorToken = ata(investor.publicKey);

    await program.methods
      .initializeInvestor()
      .accounts({
        wallet: investor.publicKey,
        investorAccount: investorPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    await program.methods
      .deposit(new BN(lamports(10_000)))
      .accounts({
        depositor: investor.publicKey,
        investorAccount: investorPda,
        profile: profilePda,
        position: positionPda,
        baseMint,
        vaultToken,
        depositorToken: investorToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([investor])
      .rpc();
    const pos: any = await program.account.investorPosition.fetch(positionPda);
    expect(Number(pos.shares)).toBe(lamports(10_000));
    expect(Number(pos.pendingWithdrawShares)).toBe(0);

    await program.methods
      .requestWithdraw(new BN(lamports(10_000)))
      .accounts({
        owner: investor.publicKey,
        profile: profilePda,
        vaultToken,
        position: positionPda,
      })
      .signers([investor])
      .rpc();

    const pos2: any = await program.account.investorPosition.fetch(positionPda);
    expect(Number(pos2.pendingWithdrawShares)).toBe(lamports(10_000));

    // fast-forward past the next midnight-UTC settlement window so the
    // notice period has elapsed.
    const slot = await provider.connection.getSlot();
    const now = await provider.connection.getBlockTime(slot);
    const readyAt = Math.floor(now! / SECONDS_PER_DAY) + 1;
    surfnet.timeTravelToTimestamp(readyAt * SECONDS_PER_DAY * 1000 + 1000);

    const pwt = await program.methods
      .processWithdraw()
      .accounts({
        authority: investor.publicKey,
        config: configPda,
        profile: profilePda,
        owner: investor.publicKey,
        investorAccount: investorPda,
        position: positionPda,
        baseMint,
        vaultToken,
        ownerToken: investorToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investor])
      .rpc();
    const pos3: any = await program.account.investorPosition.fetchNullable(
      positionPda,
    );
    expect(pos3).toBeNull();
    expect(
      Number(
        (await program.account.investorAccount.fetch(investorPda)).positionCount,
      ),
    ).toBe(0);
    const bal = await provider.connection.getTokenAccountBalance(
      investorToken,
    );
    expect(Number(bal.value.uiAmount)).toBeGreaterThan(0);
  });
});