/**
 * Arcadia Vault — Anchor IDL (hand-generated from source)
 * Program ID: gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C
 */
export const IDL = {
  address: "gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C",
  metadata: {
    name: "arcadia_vault",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Arcadia first-loss managed vault protocol",
  },
  instructions: [
    {
      name: "initializePlatform",
      discriminator: [233, 146, 209, 142, 207, 104, 64, 188],
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
      discriminator: [134, 189, 219, 93, 25, 73, 192, 35],
      accounts: [
        { name: "trader", writable: true, signer: true },
        { name: "config" },
        { name: "profile", writable: true, pda: { seeds: [{ kind: "const", value: [112, 114, 111, 102, 105, 108, 101] }, { kind: "account", path: "trader" }] } },
        { name: "baseMint" },
        { name: "vaultToken", writable: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
        { name: "tokenProgram" },
        { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
      ],
      args: [{ name: "maxLeverage", type: "u8" }],
    },
    {
      name: "setCapacity",
      discriminator: [7, 94, 122, 66, 242, 200, 104, 89],
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
      discriminator: [188, 69, 226, 186, 218, 243, 104, 106],
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
      discriminator: [100, 177, 45, 117, 44, 96, 31, 217],
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
      discriminator: [163, 103, 49, 166, 3, 79, 190, 37],
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
      discriminator: [237, 106, 73, 25, 214, 252, 107, 91],
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
      discriminator: [195, 142, 119, 27, 119, 143, 197, 4],
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
      discriminator: [143, 220, 132, 57, 53, 175, 183, 12],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "smokeState", writable: true, pda: { seeds: [{ kind: "const", value: [115, 109, 111, 107, 101] }, { kind: "account", path: "authority" }] } },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "message", type: "string" }],
    },
    {
      name: "ping",
      discriminator: [5, 152, 233, 195, 124, 206, 136, 182],
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
      discriminator: [218, 32, 57, 94, 162, 123, 217, 6],
    },
    {
      name: "TraderProfile",
      discriminator: [74, 130, 64, 151, 111, 201, 182, 25],
    },
    {
      name: "InvestorAccount",
      discriminator: [121, 192, 186, 102, 79, 159, 174, 198],
    },
    {
      name: "InvestorPosition",
      discriminator: [253, 152, 119, 229, 60, 182, 253, 61],
    },
  ],
  events: [
    {
      name: "ProfileInitialized",
      discriminator: [168, 197, 63, 244, 173, 226, 81, 27],
    },
    {
      name: "InvestorInitialized",
      discriminator: [12, 94, 144, 196, 196, 201, 84, 120],
    },
    {
      name: "Deposited",
      discriminator: [52, 210, 210, 162, 80, 60, 193, 71],
    },
    {
      name: "WithdrawRequested",
      discriminator: [105, 139, 152, 197, 51, 191, 188, 121],
    },
    {
      name: "Withdrawn",
      discriminator: [28, 234, 51, 98, 113, 181, 16, 192],
    },
    {
      name: "TradeClosed",
      discriminator: [136, 105, 183, 51, 97, 108, 21, 175],
    },
    {
      name: "Settled",
      discriminator: [176, 215, 151, 166, 82, 191, 21, 181],
    },
    {
      name: "ProfitWithdrawn",
      discriminator: [8, 176, 86, 84, 183, 22, 212, 213],
    },
  ],
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
