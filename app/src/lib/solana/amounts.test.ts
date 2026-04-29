import { describe, expect, it } from "vitest";

import {
  LAMPORTS_PER_SOL_BIGINT,
  parseSolToLamports,
  parseUsdcToUnits,
  USDC_DECIMALS_BIGINT,
} from "./amounts";

describe("Solana amount parsing", () => {
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

  it("keeps USDC principal values in bigint precision", () => {
    expect(parseUsdcToUnits("123456789.123456")).toBe(123_456_789_123_456n);
  });
});
