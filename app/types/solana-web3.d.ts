declare module "@solana/web3.js" {
  export class PublicKey {
    constructor(value: string | Uint8Array | number[]);
    static default: PublicKey;
    static findProgramAddressSync(seeds: (Uint8Array | Buffer)[], programId: PublicKey): [PublicKey, number];
    toBase58(): string;
    toBytes(): Uint8Array;
    toBuffer(): Buffer;
    equals(other: PublicKey): boolean;
  }

  export class Connection {
    constructor(endpoint: string, commitment?: string | { commitment?: string });
    getMultipleAccountsInfo(keys: PublicKey[]): Promise<(AccountInfo<Buffer> | null)[]>;
    confirmTransaction(signature: string, commitment?: string): Promise<{ value: { err: unknown } }>;
    getAccountInfo(key: PublicKey): Promise<AccountInfo<Buffer> | null>;
    getSlot(commitment?: string): Promise<number>;
    getBalance(key: PublicKey, commitment?: string): Promise<number>;
  }

  export interface AccountInfo<T> {
    executable: boolean;
    owner: PublicKey;
    lamports: number;
    data: T;
    rentEpoch: number;
  }

  export class Transaction {
    static from(buffer: Buffer): Transaction;
    constructor(options?: { feePayer?: PublicKey; signatures?: { publicKey: PublicKey; signature: Buffer | null }[] });
    serialize(): Uint8Array;
    add(...instructions: TransactionInstruction[]): Transaction;
    partialSign(...signers: { publicKey: PublicKey; secretKey: Uint8Array }[]): void;
    sign(...signers: { publicKey: PublicKey; secretKey: Uint8Array }[]): void;
    signature: string | null;
    feePayer?: PublicKey;
    recentBlockhash?: string;
    instructions: TransactionInstruction[];
  }

  export class VersionedTransaction {
    constructor(message: Uint8Array);
    serialize(): Uint8Array;
    signatures: Uint8Array[];
  }

  export class TransactionInstruction {
    constructor(opts: { keys: AccountMeta[]; programId: PublicKey; data?: Buffer });
  }

  export interface AccountMeta {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }

  export class Keypair {
    static generate(): Keypair;
    publicKey: PublicKey;
    secretKey: Uint8Array;
  }

  export const SYSVAR_RENT_PUBKEY: PublicKey;
  export const SystemProgram: {
    programId: PublicKey;
  };

  export const LAMPORTS_PER_SOL: number;
}
