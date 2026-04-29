import { describe, expect, it } from "vitest";

import {
  calculateSharesToBurn,
  LAMPORTS_PER_SOL_BIGINT,
  parseSolToLamports,
  parseUsdcToUnits,
  USDC_DECIMALS_BIGINT,
} from "./shares";

describe("Solana share math", () => {
  it("parses SOL amounts into exact lamports", () => {
    expect(parseSolToLamports("1")).toBe(LAMPORTS_PER_SOL_BIGINT);
    expect(parseSolToLamports("0.000000001")).toBe(1n);
    expect(parseSolToLamports(".5")).toBe(500_000_000n);
    expect(parseSolToLamports("abc")).toBeNull();
  });

  it("parses USDC amounts into exact token units", () => {
    expect(parseUsdcToUnits("1")).toBe(USDC_DECIMALS_BIGINT);
    expect(parseUsdcToUnits("0.000001")).toBe(1n);
    expect(parseUsdcToUnits(".5")).toBe(500_000n);
    expect(parseUsdcToUnits("abc")).toBeNull();
  });

  it("burns shares 1:1 for the initial share price", () => {
    expect(
      calculateSharesToBurn(
        1n * LAMPORTS_PER_SOL_BIGINT,
        1n * LAMPORTS_PER_SOL_BIGINT,
        1n * LAMPORTS_PER_SOL_BIGINT,
      ),
    ).toBe(1n * LAMPORTS_PER_SOL_BIGINT);
  });

  it("converts amounts when share price is above or below 1 SOL", () => {
    expect(
      calculateSharesToBurn(
        1n * LAMPORTS_PER_SOL_BIGINT,
        2n * LAMPORTS_PER_SOL_BIGINT,
        1n * LAMPORTS_PER_SOL_BIGINT,
      ),
    ).toBe(500_000_000n);

    expect(
      calculateSharesToBurn(
        1n * LAMPORTS_PER_SOL_BIGINT,
        1n * LAMPORTS_PER_SOL_BIGINT,
        2n * LAMPORTS_PER_SOL_BIGINT,
      ),
    ).toBe(2n * LAMPORTS_PER_SOL_BIGINT);
  });

  it("returns zero when a tiny amount cannot burn a whole share", () => {
    expect(calculateSharesToBurn(1n, 1_000_000_000_000n, 1n)).toBe(0n);
  });

  it("keeps large share supplies in bigint precision", () => {
    const amount = 123_456_789n;
    const capital = 987_654_321_987_654_321n;
    const shares = 123_456_789_123_456_789n;

    expect(calculateSharesToBurn(amount, capital, shares)).toBe(
      (amount * shares) / capital,
    );
  });
});
