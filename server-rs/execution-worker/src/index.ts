import express from "express";
import cors from "cors";
import bs58 from "bs58";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = parseInt(process.env.SIDECAR_PORT || "3001", 10);

// ── Auth ───────────────────────────────────────────────────────────────────────
// The sidecar only serves the supervised pipeline. If SIDECAR_TOKEN is set,
// every endpoint except /health requires `Authorization: Bearer <token>`.
const SIDECAR_TOKEN = process.env.SIDECAR_TOKEN || "";
if (SIDECAR_TOKEN) {
  app.use("/trade", (req, res, next) => {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${SIDECAR_TOKEN}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  });
}

// ── POST /trade/open ──────────────────────────────────────────────────────────
// Body: { seedBase58, market, direction, amount }
//
// 1. Reconstructs the keypair from seed
// 2. Resolves the FlashTrade market
// 3. Deposits + opens a position
// 4. Returns { signature, sizeAmount, owner }
app.post("/trade/open", async (req, res) => {
  try {
    const { seedBase58, market, direction = "long", amount } = req.body;
    if (!seedBase58 || !market || !amount) {
      return res.status(400).json({ error: "missing required fields: seedBase58, market, amount" });
    }

    const seed = bs58.decode(seedBase58);
    const { createFlashTradeExecutionClient, resolveFlashTradeMarket, depositToFlashTradeLedger, openFlashTradePosition } =
      await import("../../../app/lib/flashtrade/v2.ts");

    const client = createFlashTradeExecutionClient(seed);
    const owner = client.keypair.publicKey.toBase58();
    const resolved = resolveFlashTradeMarket({ targetSymbol: market, direction, allowManualFallback: true });

    // One-time setup (deposit ledger, basket, delegate) — idempotent
    const { ensureFlashTradeSetup } = await import("../../../app/lib/flashtrade/v2.ts");
    await ensureFlashTradeSetup(client, resolved);

    // Deposit to ledger
    const { BN } = await import("@coral-xyz/anchor");
    const depositSig = await depositToFlashTradeLedger({
      executionClient: client,
      resolvedMarket: resolved,
      amount: new BN(amount),
    });

    // Open position
    const openResult = await openFlashTradePosition({
      executionClient: client,
      resolvedMarket: resolved,
      collateralAmount: new BN(amount),
      leverage: 2,
      slippagePercentage: "0.5",
    });

    // Capture the venue position key for provenance.
    const { readFlashTradePositionSnapshot } = await import("../../../app/lib/flashtrade/v2.ts");
    const position = await readFlashTradePositionSnapshot({
      executionClient: client,
      resolvedMarket: resolved,
    });

    res.json({
      success: true,
      owner,
      signature: openResult.signature,
      sizeAmount: openResult.sizeAmount.toString(),
      depositSignature: depositSig,
      venuePositionKey: position?.venuePositionKey ?? null,
    });
  } catch (err: any) {
    console.error("/trade/open error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trade/close ─────────────────────────────────────────────────────────
// Body: { seedBase58, market }
//
// 1. Reconstructs the keypair from seed
// 2. Closes the position
// 3. Returns { signature }
app.post("/trade/close", async (req, res) => {
  try {
    const { seedBase58, market, direction = "long" } = req.body;
    if (!seedBase58 || !market) {
      return res.status(400).json({ error: "missing required fields: seedBase58, market" });
    }

    const seed = bs58.decode(seedBase58);
    const {
      createFlashTradeExecutionClient,
      resolveFlashTradeMarket,
      closeFlashTradePositionV2,
      readFlashTradePositionSnapshot,
    } = await import("../../../app/lib/flashtrade/v2.ts");

    const client = createFlashTradeExecutionClient(seed);
    const resolved = resolveFlashTradeMarket({ targetSymbol: market, direction, allowManualFallback: true });

    // Capture the live position metrics BEFORE closing so the close event
    // carries full provenance (entry/size/PnL/leverage).
    const position = await readFlashTradePositionSnapshot({
      executionClient: client,
      resolvedMarket: resolved,
    });

    const closeResult = await closeFlashTradePositionV2({
      executionClient: client,
      resolvedMarket: resolved,
    });

    res.json({
      success: true,
      signature: closeResult.signature,
      position,
    });
  } catch (err: any) {
    console.error("/trade/close error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /trade/snapshot ─────────────────────────────────────────────────────
// Body: { seedBase58, market, direction? }
//
// Reads the live on-chain FlashTrade position so the terminal can render real
// entry/size/PnL/liquidation data for the execution wallet. Returns null when
// no position is open.
app.post("/trade/snapshot", async (req, res) => {
  try {
    const { seedBase58, market, direction = "long" } = req.body;
    if (!seedBase58 || !market) {
      return res.status(400).json({ error: "missing required fields: seedBase58, market" });
    }

    const seed = bs58.decode(seedBase58);
    const {
      createFlashTradeExecutionClient,
      resolveFlashTradeMarket,
      readFlashTradePositionSnapshot,
    } = await import("../../../app/lib/flashtrade/v2.ts");

    const client = createFlashTradeExecutionClient(seed);
    const resolved = resolveFlashTradeMarket({ targetSymbol: market, direction, allowManualFallback: true });
    const snapshot = await readFlashTradePositionSnapshot({
      executionClient: client,
      resolvedMarket: resolved,
    });

    res.json({ success: true, position: snapshot });
  } catch (err: any) {
    console.error("/trade/snapshot error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`execution-worker listening on port ${PORT}`);
});
