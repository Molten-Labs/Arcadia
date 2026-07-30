import {
  AnchorProvider,
  BN,
  Wallet,
} from "@coral-xyz/anchor";
import {
  FlashPerpetualsClient,
  PoolConfig,
  Side,
  PROGRAM_ID,
  type Cluster,
  type ContractOraclePrice,
  isVariant,
} from "@flash_trade/flash-sdk-v2";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  type PublicKey,
} from "@solana/web3.js";

const DEVNET_POOL_NAMES = [
  "devnet.1",
  "devnet.2",
  "devnet.3",
  "devnet.4",
  "devnet.5",
] as const;

const MAINNET_POOL_NAMES = [
  "Crypto.1",
  "Virtual.1",
  "Governance.1",
  "Community.1",
  "Community.2",
  "Trump.1",
  "Ore.1",
  "Remora.1",
  "Equity.1",
] as const;

const APP_MARKET_TO_TARGET_SYMBOL = {
  "XAU/USD": "XAU",
  "XAG/USD": "XAG",
  "EUR/USD": "EUR",
  "GBP/USD": "GBP",
} as const;

type AppMarketSymbol = keyof typeof APP_MARKET_TO_TARGET_SYMBOL;

type FlashTradePoolCluster = Cluster;

export type FlashTradeResolvedMarket = {
  appMarketSymbol: string | null;
  targetSymbol: string;
  poolConfig: PoolConfig;
  collateralSymbol: string;
  market: PublicKey;
  poolName: string;
  side: typeof Side.Long | typeof Side.Short;
};

export type FlashTradePositionSnapshot = {
  marketSymbol: string;
  collateralSymbol: string;
  sideUi: string;
  entryPriceUi: string;
  sizeAmountUi: string;
  sizeUsdUi: string;
  collateralUsdUi: string;
  pnlWithFeeUsdUi: string;
  pnlPercentageWithFee: string;
  leverageUi: string;
  liquidationPriceUi: string;
  venuePositionKey: string;
};

export type FlashTradeExecutionClient = {
  cluster: FlashTradePoolCluster;
  keypair: Keypair;
  client: FlashPerpetualsClient;
};

let cachedPoolConfigs:
  | {
      cluster: FlashTradePoolCluster;
      poolConfigs: PoolConfig[];
    }
  | null = null;

function getDefaultCluster(): FlashTradePoolCluster {
  const configured = process.env.FLASH_V2_CLUSTER?.trim();
  if (configured === "devnet" || configured === "mainnet-beta") {
    return configured;
  }

  const rpcUrl =
    process.env.FLASH_V2_SOLANA_RPC?.trim() ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ??
    "https://api.devnet.solana.com";
  return rpcUrl.includes("devnet") ? "devnet" : "mainnet-beta";
}

export function getFlashTradeCluster() {
  return getDefaultCluster();
}

export function getFlashTradeApiUrl() {
  return (
    process.env.FLASHTRADE_API_URL?.trim() ??
    "https://flashapi.trade"
  );
}

export function getFlashTradeSolanaRpcUrl() {
  return (
    process.env.FLASH_V2_SOLANA_RPC?.trim() ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ??
    "https://api.devnet.solana.com"
  );
}

export function getFlashTradeErRpcUrl(cluster = getDefaultCluster()) {
  return (
    process.env.FLASH_V2_ER_RPC?.trim() ??
    (cluster === "devnet"
      ? "https://devnet-as.magicblock.app"
      : "https://flash.magicblock.xyz")
  );
}

function getPoolNames(cluster: FlashTradePoolCluster) {
  return cluster === "devnet" ? DEVNET_POOL_NAMES : MAINNET_POOL_NAMES;
}

export function getFlashTradePoolConfigs(cluster = getDefaultCluster()) {
  if (cachedPoolConfigs?.cluster === cluster) {
    return cachedPoolConfigs.poolConfigs;
  }

  const poolConfigs = getPoolNames(cluster).map((poolName) =>
    PoolConfig.fromIdsByName(poolName, cluster),
  );
  cachedPoolConfigs = { cluster, poolConfigs };
  return poolConfigs;
}

function toAppMarketSymbol(targetSymbol: string) {
  const entry = Object.entries(APP_MARKET_TO_TARGET_SYMBOL).find(
    ([, value]) => value === targetSymbol,
  );
  return entry?.[0] ?? null;
}

export function listSupportedFlashTradeMarkets(cluster = getDefaultCluster()) {
  const seen = new Map<
    string,
    {
      appMarketSymbol: string | null;
      targetSymbol: string;
      poolName: string;
      longSupported: boolean;
      shortSupported: boolean;
    }
  >();

  for (const poolConfig of getFlashTradePoolConfigs(cluster)) {
    for (const token of poolConfig.tokens) {
      if (token.symbol === "USDC") continue;

      const supportsLong = poolConfig.markets.some((market) => {
        if (!market.targetMint.equals(token.mintKey)) return false;
        return isVariant(market.side, "long");
      });
      const supportsShort = poolConfig.markets.some((market) => {
        if (!market.targetMint.equals(token.mintKey)) return false;
        return isVariant(market.side, "short");
      });

      if (!supportsLong && !supportsShort) continue;

      const existing = seen.get(token.symbol);
      if (existing) {
        existing.longSupported ||= supportsLong;
        existing.shortSupported ||= supportsShort;
        continue;
      }

      seen.set(token.symbol, {
        appMarketSymbol: toAppMarketSymbol(token.symbol),
        targetSymbol: token.symbol,
        poolName: poolConfig.poolName,
        longSupported: supportsLong,
        shortSupported: supportsShort,
      });
    }
  }

  return [...seen.values()];
}

function getPreferredManualTestTarget(cluster: FlashTradePoolCluster) {
  const supported = listSupportedFlashTradeMarkets(cluster);
  const preferredTargets = ["XAU", "XAG", "EUR", "GBP", "SOL", "BTC", "ETH"];
  return (
    preferredTargets.find((target) =>
      supported.some((market) => market.targetSymbol === target),
    ) ?? supported[0]?.targetSymbol ?? null
  );
}

function resolveSide(direction: "long" | "short") {
  return direction === "long" ? Side.Long : Side.Short;
}

function resolveMarketFromPool(args: {
  poolConfig: PoolConfig;
  targetSymbol: string;
  side: typeof Side.Long | typeof Side.Short;
}) {
  const targetToken = args.poolConfig.tokens.find(
    (token) => token.symbol === args.targetSymbol,
  );
  if (!targetToken) return null;

  const targetCustody = args.poolConfig.custodies.find((custody) =>
    custody.mintKey.equals(targetToken.mintKey),
  );
  if (!targetCustody) return null;

  const market = args.poolConfig.markets.find(
    (candidate) =>
      candidate.targetCustody.equals(targetCustody.custodyAccount) &&
      isVariant(candidate.side, "long") === isVariant(args.side, "long"),
  );
  if (!market) return null;

  const collateralCustody = args.poolConfig.custodies.find((custody) =>
    custody.custodyAccount.equals(market.collateralCustody),
  );
  if (!collateralCustody) return null;

  return { market, collateralSymbol: collateralCustody.symbol };
}

export function resolveFlashTradeMarket(args: {
  appMarketSymbol?: string;
  targetSymbol?: string;
  direction: "long" | "short";
  allowManualFallback?: boolean;
  cluster?: FlashTradePoolCluster;
}) {
  const cluster = args.cluster ?? getDefaultCluster();
  const targetSymbol =
    args.targetSymbol ??
    (args.appMarketSymbol &&
    args.appMarketSymbol in APP_MARKET_TO_TARGET_SYMBOL
      ? APP_MARKET_TO_TARGET_SYMBOL[args.appMarketSymbol as AppMarketSymbol]
      : null) ??
    (args.allowManualFallback ? getPreferredManualTestTarget(cluster) : null);

  if (!targetSymbol) {
    throw new Error(
      `No FlashTrade v2 target symbol could be resolved for ${args.appMarketSymbol ?? "this request"}.`,
    );
  }

  const side = resolveSide(args.direction);
  for (const poolConfig of getFlashTradePoolConfigs(cluster)) {
    const resolved = resolveMarketFromPool({ poolConfig, targetSymbol, side });
    if (!resolved) continue;

    return {
      appMarketSymbol: toAppMarketSymbol(targetSymbol),
      targetSymbol,
      poolConfig,
      collateralSymbol: resolved.collateralSymbol,
      market: resolved.market.marketAccount,
      poolName: poolConfig.poolName,
      side,
    } satisfies FlashTradeResolvedMarket;
  }

  throw new Error(
    `${targetSymbol} does not have a ${args.direction} market on FlashTrade ${cluster}.`,
  );
}

export function createFlashTradeExecutionClient(
  seedBytes: Uint8Array,
  rpcUrl?: string,
) {
  const cluster = getDefaultCluster();
  const rpc = rpcUrl ?? getFlashTradeSolanaRpcUrl();
  const erRpcUrl = getFlashTradeErRpcUrl(cluster);
  // @ts-expect-error — fromSeed exists at runtime (v1.98+) but TS fails to resolve the type due to duplicate @solana/web3.js in flash-sdk-v2's node_modules
  const keypair = Keypair.fromSeed(seedBytes);
  const connection = new Connection(rpc, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(keypair), {
    commitment: "confirmed",
  });

  const client = new FlashPerpetualsClient(
    provider,
    undefined,
    cluster === "devnet" ? PROGRAM_ID.devnet : PROGRAM_ID["mainnet-beta"],
    {
      prioritizationFee: 5_000,
      txConfirmationCommitment: "confirmed",
    },
    erRpcUrl,
  );

  return { cluster, keypair, client } satisfies FlashTradeExecutionClient;
}

async function sendIfNeeded(
  client: FlashPerpetualsClient,
  instructions: Awaited<ReturnType<FlashPerpetualsClient["initializeBasket"]>>,
) {
  if (instructions.instructions.length === 0) return null;
  return await client.sendAndConfirmTransaction(instructions.instructions, {
    additionalSigners: instructions.additionalSigners,
    skipPreflight: true,
  });
}

export async function ensureFlashTradeSetup(
  executionClient: FlashTradeExecutionClient,
  resolvedMarket: FlashTradeResolvedMarket,
  /** Override the collateral mint for trade-vault init (e.g. USDC). */
  collateralMintOverride?: PublicKey,
) {
  const { client } = executionClient;
  const lockToken =
    resolvedMarket.poolConfig.getTokenFromSymbol(resolvedMarket.collateralSymbol);
  const lockTokenProgramId = lockToken.isToken2022
    ? TOKEN_2022_PROGRAM_ID
    : undefined;
  const fundMint = collateralMintOverride ?? lockToken.mintKey;
  const fundTokenProgramId = collateralMintOverride ? undefined : lockTokenProgramId;

  let tvSig: string | null = null;
  try {
    tvSig = await sendIfNeeded(
      client,
      await client.initTradeVault(fundMint, fundTokenProgramId),
    );
  } catch (e) {
    console.warn("    ⚠ tradeVault init skipped (needs FlashTrade admin):",
      e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60));
  }

  const setupSignatures = {
    depositLedgerSignature: await sendIfNeeded(
      client,
      await client.initializeUserDepositLedger(),
    ),
    basketSignature: await sendIfNeeded(client, await client.initializeBasket()),
    tradeVaultSignature: tvSig,
    delegateSignature: await sendIfNeeded(
      client,
      await client.delegateBasket(client.wallet),
    ),
  };

  return { ...setupSignatures, collateralMint: fundMint, tokenProgramId: fundTokenProgramId };
}

export async function depositToFlashTradeLedger(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
  amount: BN;
  /** Override the collateral token mint (default: resolvedMarket.collateralSymbol).
   *  Use this when the depositor holds a different token (e.g. USDC) than the
   *  market's lock/swap collateral. */
  collateralMint?: PublicKey;
}) {
  const collateralToken = args.collateralMint
    ? { mintKey: args.collateralMint, isToken2022: false }
    : args.resolvedMarket.poolConfig.getTokenFromSymbol(
        args.resolvedMarket.collateralSymbol,
      );
  const tokenProgramId = (collateralToken as { isToken2022?: boolean }).isToken2022
    ? TOKEN_2022_PROGRAM_ID
    : undefined;
  const instructionResult = await args.executionClient.client.depositDirect(
    collateralToken.mintKey,
    args.amount,
    tokenProgramId,
  );
  return await args.executionClient.client.sendAndConfirmTransaction(
    instructionResult.instructions,
    {
      additionalSigners: instructionResult.additionalSigners,
      skipPreflight: true,
    },
  );
}

async function getOraclePriceForSymbol(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
  isEntry: boolean;
  slippageBps: BN;
}) {
  const custody = args.resolvedMarket.poolConfig.custodies.find((candidate) =>
    candidate.mintKey.equals(
      args.resolvedMarket.poolConfig.getTokenFromSymbol(
        args.resolvedMarket.targetSymbol,
      ).mintKey,
    ),
  );

  if (!custody) {
    throw new Error(
      `Custody for ${args.resolvedMarket.targetSymbol} was not found in ${args.resolvedMarket.poolName}.`,
    );
  }

  const program =
    args.executionClient.client.erProgram ?? args.executionClient.client.program;
  const oracle = await (program.account as Record<string, unknown> & {
    customOracle: { fetch: (address: PublicKey) => Promise<unknown> };
  }).customOracle.fetch(custody.intOracleAccount) as {
    price: BN;
    expo: number;
  };

  return args.executionClient.client.getPriceAfterSlippage(
    args.isEntry,
    args.slippageBps,
    { price: oracle.price, exponent: new BN(oracle.expo) },
    args.resolvedMarket.side,
  );
}

function leverageMultiplierToBps(leverage: number) {
  return new BN(Math.max(1, Math.round(leverage * 10_000)));
}

function formatBnWithDecimals(value: BN, decimals: number) {
  const sign = value.isNeg() ? "-" : "";
  const digits = value.abs().toString(10);
  if (decimals <= 0) {
    return `${sign}${digits}${"0".repeat(Math.max(0, decimals * -1))}`;
  }

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction.length > 0
    ? `${sign}${whole}.${fraction}`
    : `${sign}${whole}`;
}

function formatOraclePrice(price: { price: BN; exponent: number }) {
  if (price.exponent >= 0) {
    return `${price.price.toString()}${"0".repeat(price.exponent)}`;
  }
  return formatBnWithDecimals(price.price, Math.abs(price.exponent));
}

export async function openFlashTradePosition(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
  collateralAmount: BN;
  leverage: number;
  slippagePercentage: string;
  /** Override the funding/swap token (default: resolvedMarket.collateralSymbol). */
  collateralSymbolOverride?: string;
}) {
  const fundSymbol = args.collateralSymbolOverride ?? args.resolvedMarket.collateralSymbol;
  const slippageBps = new BN(
    Math.max(1, Math.round(Number(args.slippagePercentage) * 100)),
  );
  const leverageBps = leverageMultiplierToBps(args.leverage);
  const price = await getOraclePriceForSymbol({
    executionClient: args.executionClient,
    resolvedMarket: args.resolvedMarket,
    isEntry: true,
    slippageBps,
  });
  const quote = await args.executionClient.client.views.getOpenPositionQuoteEr(
    args.resolvedMarket.poolConfig,
    {
      market: args.resolvedMarket.market,
      targetSymbol: args.resolvedMarket.targetSymbol,
      collateralSymbol: fundSymbol,
      receivingSymbol: fundSymbol,
      amountIn: args.collateralAmount,
      leverage: leverageBps,
      owner: args.executionClient.keypair.publicKey,
    },
  ) as {
    sizeAmount?: BN;
    entryPrice?: ContractOraclePrice;
    liquidationPrice?: ContractOraclePrice;
    leverage?: BN;
  };

  if (!(quote.sizeAmount instanceof BN) || quote.sizeAmount.lte(new BN(0))) {
    throw new Error(
      "FlashTrade v2 quote did not produce a valid size amount for this execution.",
    );
  }

  const instructionResult = await args.executionClient.client.openPosition(
    args.resolvedMarket.targetSymbol,
    args.resolvedMarket.collateralSymbol, // lockSymbol (XAUT)
    fundSymbol,                           // collateralSymbol (USDC)
    args.resolvedMarket.side,
    args.resolvedMarket.poolConfig,
    price,
    args.collateralAmount,
    quote.sizeAmount,
  );

  const openResult =
    await args.executionClient.client.sendAndConfirmErTransaction(
      instructionResult.instructions,
      [args.executionClient.keypair],
    );

  return { signature: openResult.signature, quote, sizeAmount: quote.sizeAmount };
}

function findBasketPosition(args: {
  basket: Awaited<
    ReturnType<NonNullable<FlashPerpetualsClient["erAccounts"]>["fetchBasket"]>
  >;
  market: PublicKey;
}) {
  return args.basket.positions.find(
    (positionMeta) =>
      positionMeta.market.equals(args.market) && positionMeta.position.isActive,
  );
}

export async function readFlashTradePositionSnapshot(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
}) {
  const accountFetcher =
    args.executionClient.client.erAccounts ?? args.executionClient.client.accounts;
  const basket = await accountFetcher.fetchBasket(
    args.executionClient.keypair.publicKey,
  );
  const positionMeta = findBasketPosition({
    basket,
    market: args.resolvedMarket.market,
  });

  if (!positionMeta) return null;

  const positionData = await args.executionClient.client.views.getPositionDataEr(
    args.resolvedMarket.poolConfig,
    {
      owner: args.executionClient.keypair.publicKey,
      market: args.resolvedMarket.market,
      targetSymbol: args.resolvedMarket.targetSymbol,
      collateralSymbol: args.resolvedMarket.collateralSymbol,
    },
  ) as unknown as {
    entryOraclePrice: { price: BN; exponent: number };
    sizeAmount: BN;
    sizeUsd: BN;
    collateralUsd: BN;
    pnlWithFeeUsd: BN;
    pnlPercentageWithFee: BN;
    leverage: BN;
    liquidationPrice: { price: BN; exponent: number };
  };

  return {
    marketSymbol: args.resolvedMarket.targetSymbol,
    collateralSymbol: args.resolvedMarket.collateralSymbol,
    sideUi: isVariant(args.resolvedMarket.side, "long") ? "Long" : "Short",
    entryPriceUi: formatOraclePrice(positionData.entryOraclePrice),
    sizeAmountUi: formatBnWithDecimals(positionData.sizeAmount, positionMeta.position.sizeDecimals),
    sizeUsdUi: formatBnWithDecimals(positionData.sizeUsd, 6),
    collateralUsdUi: formatBnWithDecimals(positionData.collateralUsd, 6),
    pnlWithFeeUsdUi: formatBnWithDecimals(positionData.pnlWithFeeUsd, 6),
    pnlPercentageWithFee: formatBnWithDecimals(positionData.pnlPercentageWithFee, 4),
    leverageUi: formatBnWithDecimals(positionData.leverage, 4),
    liquidationPriceUi: formatOraclePrice(positionData.liquidationPrice),
    venuePositionKey: args.resolvedMarket.market.toBase58(),
  } satisfies FlashTradePositionSnapshot;
}

export async function waitForFlashTradePositionSnapshot(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readFlashTradePositionSnapshot(args);
    if (snapshot) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return null;
}

export async function closeFlashTradePositionV2(args: {
  executionClient: FlashTradeExecutionClient;
  resolvedMarket: FlashTradeResolvedMarket;
}) {
  const price = await getOraclePriceForSymbol({
    executionClient: args.executionClient,
    resolvedMarket: args.resolvedMarket,
    isEntry: false,
    slippageBps: new BN(50),
  });
  const instructionResult = await args.executionClient.client.closePosition(
    args.resolvedMarket.targetSymbol,
    args.resolvedMarket.collateralSymbol,
    args.resolvedMarket.side,
    args.resolvedMarket.poolConfig,
    price,
  );
  const closeResult =
    await args.executionClient.client.sendAndConfirmErTransaction(
      instructionResult.instructions,
      [args.executionClient.keypair],
    );
  return { signature: closeResult.signature };
}
