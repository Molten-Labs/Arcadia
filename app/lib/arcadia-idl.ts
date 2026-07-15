/**
 * Arcadia Vault — Anchor IDL (hand-generated from source)
 * Program ID: FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd
 */
export const IDL = {
  address: "FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd",
  metadata: {
    name: "arcadia_vault",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Arcadia first-loss managed vault protocol",
  },
  instructions: [
    {
      name: "initializePlatform",
      discriminator: [119, 201, 101, 45, 75, 122, 89, 3],
      accounts: [
        { name: "admin", writable: true, signer: true },
        { name: "config", writable: true, pda: { seeds: [{ kind: "const", value: [112, 108, 97, 116, 102, 111, 114, 109] }] } },
        { name: "treasuryToken", writable: true },
        { name: "baseMint" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
        { name: "tokenProgram" },
        { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
      ],
      args: [
        { name: "perfFeeBps", type: "u16" },
        { name: "mgmtFeeBps", type: "u16" },
        { name: "oracleAuthority", type: "pubkey" },
      ],
    },
    {
      name: "initializeProfile",
      discriminator: [32, 145, 77, 213, 58, 39, 251, 234],
      accounts: [
        { name: "trader", writable: true, signer: true },
        { name: "config" },
        { name: "profile", writable: true, pda: { seeds: [{ kind: "const", value: [112, 114, 111, 102, 105, 108, 101] }, { kind: "account", path: "trader" }] } },
        { name: "baseMint" },
        { name: "vaultToken", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
        { name: "tokenProgram" },
        { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
      ],
      args: [{ name: "maxLeverage", type: "u8" }],
    },
    {
      name: "setCapacity",
      discriminator: [144, 85, 95, 65, 125, 139, 44, 27],
      accounts: [
        { name: "oracleAuthority", signer: true },
        { name: "config" },
        { name: "profile", writable: true },
      ],
      args: [
        { name: "capUsd", type: "u64" },
        { name: "scoreTier", type: "u8" },
      ],
    },
    {
      name: "initializeInvestor",
      discriminator: [12, 105, 129, 28, 138, 149, 223, 135],
      accounts: [
        { name: "wallet", writable: true, signer: true },
        { name: "investorAccount", writable: true, pda: { seeds: [{ kind: "const", value: [105, 110, 118, 101, 115, 116, 111, 114] }, { kind: "account", path: "wallet" }] } },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "deposit",
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182],
      accounts: [
        { name: "depositor", writable: true, signer: true },
        { name: "investorAccount", writable: true, pda: { seeds: [{ kind: "const", value: [105, 110, 118, 101, 115, 116, 111, 114] }, { kind: "account", path: "depositor" }] } },
        { name: "profile", writable: true },
        { name: "position", writable: true, pda: { seeds: [{ kind: "const", value: [112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "depositor" }, { kind: "account", path: "profile" }] } },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "depositorToken", writable: true },
        { name: "tokenProgram" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "requestWithdraw",
      discriminator: [137, 95, 187, 96, 250, 138, 31, 182],
      accounts: [
        { name: "owner", signer: true },
        { name: "profile" },
        { name: "vaultToken" },
        { name: "position", writable: true, pda: { seeds: [{ kind: "const", value: [112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "owner" }, { kind: "account", path: "profile" }] } },
      ],
      args: [{ name: "shares", type: "u64" }],
    },
    {
      name: "processWithdraw",
      discriminator: [166, 189, 47, 170, 19, 135, 210, 19],
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "profile", writable: true },
        { name: "position", writable: true, pda: { seeds: [{ kind: "const", value: [112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "owner" }, { kind: "account", path: "profile" }] } },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "ownerToken", writable: true },
        { name: "tokenProgram" },
      ],
      args: [],
    },
    {
      name: "recordTrade",
      discriminator: [83, 201, 2, 171, 223, 122, 186, 127],
      accounts: [
        { name: "trader", signer: true },
        { name: "oracleAuthority", signer: true },
        { name: "config" },
        { name: "profile", writable: true },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "treasuryToken", writable: true },
        { name: "treasuryAuthority", signer: true },
        { name: "tokenProgram" },
      ],
      args: [
        { name: "market", type: "string" },
        { name: "direction", type: "u8" },
        { name: "sizeUsd", type: "u64" },
        { name: "leverageX100", type: "u16" },
        { name: "entryPx", type: "u64" },
        { name: "exitPx", type: "u64" },
        { name: "feesUsd", type: "u64" },
        { name: "wasLiquidated", type: "bool" },
        { name: "openedAt", type: "i64" },
        { name: "closedAt", type: "i64" },
      ],
    },
    {
      name: "settle",
      discriminator: [175, 42, 185, 87, 144, 131, 102, 212],
      accounts: [
        { name: "caller", signer: true },
        { name: "config" },
        { name: "profile", writable: true },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "treasuryToken", writable: true },
        { name: "tokenProgram" },
        { name: "clock", address: "SysvarC1ock11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "traderWithdrawProfit",
      discriminator: [87, 1, 195, 95, 15, 124, 120, 152],
      accounts: [
        { name: "trader", writable: true, signer: true },
        { name: "profile", writable: true },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "traderToken", writable: true },
        { name: "tokenProgram" },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "initializeSmoke",
      discriminator: [81, 152, 126, 223, 22, 188, 176, 110],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "smokeState", writable: true, pda: { seeds: [{ kind: "const", value: [115, 109, 111, 107, 101] }, { kind: "account", path: "authority" }] } },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "message", type: "string" }],
    },
    {
      name: "ping",
      discriminator: [173, 0, 94, 236, 73, 133, 225, 153],
      accounts: [
        { name: "authority", signer: true },
        { name: "smokeState", writable: true, pda: { seeds: [{ kind: "const", value: [115, 109, 111, 107, 101] }, { kind: "account", path: "authority" }] } },
      ],
      args: [{ name: "message", type: "string" }],
    },
  ],
  accounts: [
    {
      name: "PlatformConfig",
      discriminator: [160, 78, 128, 0, 248, 83, 230, 160],
    },
    {
      name: "TraderProfile",
      discriminator: [99, 135, 170, 100, 49, 79, 225, 169],
    },
    {
      name: "InvestorAccount",
      discriminator: [170, 82, 242, 38, 219, 28, 212, 55],
    },
    {
      name: "InvestorPosition",
      discriminator: [145, 143, 236, 150, 229, 40, 195, 88],
    },
  ],
  events: [],
  errors: [
    { code: 6000, name: "Unauthorized",              msg: "Caller is not authorized for this action" },
    { code: 6001, name: "VaultNotActive",             msg: "Profile/vault is not active" },
    { code: 6002, name: "ZeroAmount",                 msg: "Amount must be greater than zero" },
    { code: 6003, name: "InsufficientFunds",          msg: "Insufficient funds in source token account" },
    { code: 6004, name: "InvalidLeverage",            msg: "Leverage must be valid and within limits" },
    { code: 6005, name: "LeverageTooHigh",            msg: "Leverage exceeds profile max_leverage" },
    { code: 6006, name: "NotionalTooLarge",           msg: "Trade notional exceeds 20% of AUM" },
    { code: 6007, name: "InvalidTradeParams",         msg: "Invalid trade parameters" },
    { code: 6008, name: "NoShares",                   msg: "Vault has no shares; NAV undefined" },
    { code: 6009, name: "CapacityNotSet",             msg: "Capacity has not been set by oracle" },
    { code: 6010, name: "CapacityExceeded",           msg: "Deposit would exceed capacity cap" },
    { code: 6011, name: "DustDeposit",                msg: "Deposit too small; mints zero shares" },
    { code: 6012, name: "InvalidTier",                msg: "Invalid score tier" },
    { code: 6013, name: "InvalidFeeConfig",           msg: "Invalid or unsafe fee configuration" },
    { code: 6014, name: "InsufficientShares",         msg: "Insufficient shares for withdrawal" },
    { code: 6015, name: "NothingPending",             msg: "No pending withdrawal" },
    { code: 6016, name: "NoticeNotElapsed",           msg: "Withdrawal window not yet reached" },
    { code: 6017, name: "InsufficientVaultLiquidity", msg: "Vault token balance insufficient for payout" },
    { code: 6018, name: "InsufficientClaimable",      msg: "Amount exceeds trader claimable" },
    { code: 6019, name: "MathOverflow",               msg: "Arithmetic overflow" },
    { code: 6020, name: "TokenConservationFailed",    msg: "Token transfer did not conserve the requested amount" },
    { code: 6021, name: "SmokeMessageTooLong",        msg: "Smoke message is too long" },
    { code: 6022, name: "SmokeCounterOverflow",       msg: "Smoke ping counter overflowed" },
  ],
  types: [
    {
      name: "PlatformConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "admin",            type: "pubkey" },
          { name: "oracleAuthority",  type: "pubkey" },
          { name: "treasuryToken",    type: "pubkey" },
          { name: "baseMint",         type: "pubkey" },
          { name: "perfFeeBps",       type: "u16" },
          { name: "mgmtFeeBps",       type: "u16" },
          { name: "bump",             type: "u8" },
        ],
      },
    },
    {
      name: "TraderProfile",
      type: {
        kind: "struct",
        fields: [
          { name: "trader",           type: "pubkey" },
          { name: "baseMint",         type: "pubkey" },
          { name: "vaultToken",       type: "pubkey" },
          { name: "totalShares",      type: "u64" },
          { name: "traderShares",     type: "u64" },
          { name: "hwmPerShare",      type: "u64" },
          { name: "capacityCapUsd",   type: "u64" },
          { name: "traderClaimable",  type: "u64" },
          { name: "lastSettleTs",     type: "i64" },
          { name: "createdAt",        type: "i64" },
          { name: "status",           type: "u8" },
          { name: "scoreTier",        type: "u8" },
          { name: "maxLeverage",      type: "u8" },
          { name: "bump",             type: "u8" },
        ],
      },
    },
    {
      name: "InvestorAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "owner",              type: "pubkey" },
          { name: "positionCount",      type: "u32" },
          { name: "totalDepositedUsd",  type: "u64" },
          { name: "createdAt",          type: "i64" },
          { name: "bump",               type: "u8" },
        ],
      },
    },
    {
      name: "InvestorPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "owner",                  type: "pubkey" },
          { name: "profile",                type: "pubkey" },
          { name: "shares",                 type: "u64" },
          { name: "costBasisUsd",           type: "u64" },
          { name: "pendingWithdrawShares",  type: "u64" },
          { name: "withdrawReadyTs",        type: "i64" },
          { name: "depositedAt",            type: "i64" },
          { name: "bump",                   type: "u8" },
        ],
      },
    },
  ],
} as const;

type DeepMutable<T> = T extends object
  ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
  : T;

/**
 * Mutable literal type of the IDL, shaped like an `anchor build` generated
 * type. Lets `Program<ArcadiaIdl>` fully type `.methods` / `.accounts` /
 * account decoding without `as any` at the call sites.
 */
export type ArcadiaIdl = DeepMutable<typeof IDL>;

/** The IDL value cast to its mutable type, for `new Program(ARCADIA_IDL, …)`. */
export const ARCADIA_IDL = IDL as ArcadiaIdl;
