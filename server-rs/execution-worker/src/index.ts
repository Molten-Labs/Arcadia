import express from "express";
import cors from "cors";
import bs58 from "bs58";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = parseInt(process.env.SIDECAR_PORT || "3001", 10);

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
      await import("../../app/lib/flashtrade/v2.js");

    const client = createFlashTradeExecutionClient(seed);
    const owner = client.keypair.publicKey.toBase58();
    const resolved = resolveFlashTradeMarket({ targetSymbol: market, direction, allowManualFallback: true });

    // One-time setup (deposit ledger, basket, delegate) — idempotent
    const { ensureFlashTradeSetup } = await import("../../app/lib/flashtrade/v2.js");
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

    res.json({
      success: true,
      owner,
      signature: openResult.signature,
      sizeAmount: openResult.sizeAmount.toString(),
      depositSignature: depositSig,
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
    const { seedBase58, market } = req.body;
    if (!seedBase58 || !market) {
      return res.status(400).json({ error: "missing required fields: seedBase58, market" });
    }

    const seed = bs58.decode(seedBase58);
    const { createFlashTradeExecutionClient, resolveFlashTradeMarket, closeFlashTradePositionV2 } =
      await import("../../app/lib/flashtrade/v2.js");

    const client = createFlashTradeExecutionClient(seed);
    const resolved = resolveFlashTradeMarket({ targetSymbol: market, direction: "long", allowManualFallback: true });

    const closeResult = await closeFlashTradePositionV2({
      executionClient: client,
      resolvedMarket: resolved,
    });

    res.json({
      success: true,
      signature: closeResult.signature,
    });
  } catch (err: any) {
    console.error("/trade/close error:", err);
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
