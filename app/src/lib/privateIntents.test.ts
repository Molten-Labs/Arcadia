import { describe, expect, it } from "vitest";

import {
  mergePrivateIntentSnapshot,
  normalizePrivateIntentSnapshot,
  privateIntentRealtimeToActivity,
  privateIntentRealtimeToSnapshot,
} from "./privateIntents";

describe("private intent normalization", () => {
  it("normalizes a backend snapshot into guard state, proof steps, and redacted activity", () => {
    const snapshot = normalizePrivateIntentSnapshot({
      vaultConfigPubkey: "vault-1",
      guard: {
        status: "healthy",
        approvedCount: 2,
        reserveFloorBps: 2000,
        latencyMs: 84,
      },
      proofTimeline: [
        { id: "sealed", label: "Intent sealed", status: "completed", detail: "Committed" },
        { id: "proof", label: "Proof posted", status: "approved", detail: "Guard passed", proofHash: "abcdef1234567890" },
      ],
      redactedActivity: [
        {
          intentId: "intent-1",
          status: "approved",
          routeHash: "routehash1234567890",
          sizeBucket: "1k-5k USDC",
          guardResult: "approved",
          occurredAt: 1_700_000_000,
        },
      ],
    }, "fallback");

    expect(snapshot.vaultConfigPubkey).toBe("vault-1");
    expect(snapshot.guard.status).toBe("online");
    expect(snapshot.guard.approvedCount).toBe(2);
    expect(snapshot.timeline[1]).toMatchObject({ status: "complete", proofHash: "abcdef1234567890" });
    expect(snapshot.activity[0]).toMatchObject({
      intentId: "intent-1",
      routeCommitment: "routehash1234567890",
      amountBucket: "1k-5k USDC",
      redactedFields: ["route", "exact size", "execution slot"],
    });
  });

  it("converts realtime private-intent events into a mergeable snapshot and feed item", () => {
    const event = {
      type: "proof.event" as const,
      receivedAt: 1_700_000_100,
      item: {
        vaultConfigPubkey: "vault-1",
        intentId: "intent-2",
        status: "settled",
        guardResult: "approved",
        proofHash: "proofhash1234567890",
        routeCommitment: "routehash",
      },
    };

    const patch = privateIntentRealtimeToSnapshot(event);
    const activity = privateIntentRealtimeToActivity(event);
    const merged = mergePrivateIntentSnapshot(undefined, patch!);

    expect(activity?.detail).toMatch(/settled/i);
    expect(merged.activity).toHaveLength(1);
    expect(merged.timeline.some((step) => step.status === "active" || step.status === "complete")).toBe(true);
  });

  it("treats accepted backend intents as sealed and guard-active", () => {
    const snapshot = normalizePrivateIntentSnapshot({
      intentId: "intent-accepted",
      vaultConfigPubkey: "vault-1",
      status: "accepted",
      requestHash: "requesthash123",
    }, "vault-1");

    expect(snapshot.timeline[0]).toMatchObject({ id: "sealed", status: "complete" });
    expect(snapshot.timeline[1]).toMatchObject({ id: "er-guard", status: "active" });
  });
});
