import { describe, expect, it } from "vitest";

import { eventToActivity, type RealtimeEvent } from "./realtime";

describe("Arcadia realtime events", () => {
  it("turns confirmed investor withdrawals into visible activity feed rows", () => {
    const event: RealtimeEvent = {
      type: "withdrawal.event",
      receivedAt: 1_778_000_000,
      item: {
        vaultConfigPubkey: "vault-demo",
        actorRole: "investor",
        actor: "investor-wallet",
        action: "withdrew",
        amount: 5_000,
        capitalLayer: "senior",
        status: "confirmed",
        detail: "Investor withdrew liquid USDC after the vault secured payout.",
        occurredAt: 1_778_000_000,
      },
    };

    expect(eventToActivity(event)).toMatchObject({
      kind: "capital",
      label: "Investor withdrew",
      amount: 5_000,
      tone: "neutral",
      detail: "Investor withdrew liquid USDC after the vault secured payout.",
    });
  });

  it("marks blocked trader withdrawals as warning activity", () => {
    const event: RealtimeEvent = {
      type: "withdrawal.event",
      receivedAt: 1_778_000_001,
      item: {
        vaultConfigPubkey: "vault-demo",
        actorRole: "trader",
        actor: "trader-wallet",
        action: "withdrawal blocked",
        amount: 2_000,
        capitalLayer: "junior",
        status: "blocked",
        detail: "Trader withdrawal blocked while the vault is frozen.",
        occurredAt: 1_778_000_001,
      },
    };

    expect(eventToActivity(event)).toMatchObject({
      kind: "capital",
      label: "Trader withdrawal blocked",
      amount: 2_000,
      tone: "warning",
    });
  });

  it("shows frozen risk events as danger state with investor impact", () => {
    const event: RealtimeEvent = {
      type: "risk.event",
      receivedAt: 1_778_000_002,
      item: {
        vaultConfigPubkey: "vault-demo",
        state: "frozen",
        previousState: "caution",
        juniorBufferRemaining: 0,
        juniorBufferUsedPct: 100,
        investorCapitalImpacted: 2_000,
        tradingEnabled: false,
        reason: "Junior buffer depleted; investor exits are prioritized.",
        occurredAt: 1_778_000_002,
      },
    };

    expect(eventToActivity(event)).toMatchObject({
      kind: "risk",
      label: "Risk state: frozen",
      amount: 2_000,
      tone: "danger",
    });
  });

  it("turns live Jupiter quotes into visible market activity", () => {
    const event: RealtimeEvent = {
      type: "market.quote",
      receivedAt: 1_778_000_003,
      item: {
        vaultConfigPubkey: "vault-demo",
        route: "USDC -> SOL",
        inputAmount: 30_000,
        inputSymbol: "USDC",
        expectedOutput: 210.4,
        outputSymbol: "SOL",
        priceImpactPct: 0.03,
        routeLabels: ["Meteora", "Orca"],
        quoteSource: "Jupiter mainnet",
        executionEnv: "Surfpool local simulation",
        fetchedAt: 1_778_000_003,
      },
    };

    expect(eventToActivity(event)).toMatchObject({
      kind: "trade",
      label: "Live Jupiter quote",
      amount: 30_000,
      tone: "success",
    });
  });

  it("turns completed demo story steps into visible activity", () => {
    const event: RealtimeEvent = {
      type: "demo.step",
      receivedAt: 1_778_000_004,
      item: {
        id: "loss-buffer",
        label: "Loss absorbed",
        stage: "completed",
        summary: "Trader buffer absorbs the drawdown first.",
        actor: "protocol",
        metric: "Investor impact 0",
        occurredAt: 1_778_000_004,
      },
    };

    expect(eventToActivity(event)).toMatchObject({
      kind: "status",
      label: "Loss absorbed",
      tone: "success",
      detail: "Trader buffer absorbs the drawdown first.",
    });
  });
});
