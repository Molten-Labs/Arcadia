import { investorPositions, traders, vaults } from "./mockData";
import type { PositionView } from "@/hooks/usePositions";
import type { ManagerView, VaultView } from "@/hooks/useVaults";

const toLamports = (value: number) => BigInt(Math.round(value * 1e6));
const toUnix = (date: string | undefined) => date ? Math.floor(new Date(date).getTime() / 1000) : 0;

export function mockVaultViews(): VaultView[] {
  return vaults.map((vault, index) => {
    const currentNav = vault.tvl;
    const highWaterMark = vault.hwm;
    const paperWindowSecs = (vault.paperDaysRequired ?? 30) * 86400;
    const paperTradeCount = vault.trades.length || Math.max(0, Math.min(10, vault.paperDaysElapsed ?? 0));

    return {
      id: vault.id,
      name: vault.name,
      configPubkey: vault.id,
      statePubkey: `${vault.id}-state`,
      treasuryPubkey: `${vault.id}-treasury`,
      managerPubkey: vault.traderWallet,
      status: vault.status,
      tvl: vault.tvl,
      juniorCapital: vault.juniorCapital,
      seniorCapital: vault.seniorCapital,
      originalJuniorDepositLamports: toLamports(vault.juniorCapital / Math.max(vault.juniorHealth / 100, 0.01)),
      juniorCapitalLamports: toLamports(vault.juniorCapital),
      seniorCapitalLamports: toLamports(vault.seniorCapital),
      juniorSharesOutstanding: vault.juniorCapital,
      seniorSharesOutstanding: vault.seniorCapital,
      juniorSharesOutstandingRaw: toLamports(vault.juniorCapital),
      seniorSharesOutstandingRaw: toLamports(vault.seniorCapital),
      juniorHealth: vault.juniorHealth,
      currentNav,
      currentNavLamports: toLamports(currentNav),
      highWaterMark,
      highWaterMarkLamports: toLamports(highWaterMark),
      feeBps: vault.feeModel.startsWith("15%") ? 1500 : 2000,
      maxSlippageBps: 50,
      createdAt: toUnix(vault.createdAt),
      paperWindowSecs,
      graduatedAt: toUnix(vault.graduatedAt),
      paperTradeCount,
      minQualifyingTrades: 10,
      rolling24hLossBps: Math.max(0, Math.round(Math.abs(Math.min(vault.return7d, 0)) * 100)),
      rolling7dLossBps: Math.max(0, Math.round(Math.abs(Math.min(vault.maxDrawdown, 0)) * 100)),
      tradingEnabled: vault.status !== "frozen" && vault.status !== "cooldown",
      instantExit: vault.instantExit,
      vaultIndex: index,
    };
  });
}

export function mockManagerViews(): ManagerView[] {
  return traders.map((trader) => ({
    pubkey: `${trader.wallet}-profile`,
    owner: trader.wallet,
    totalVaults: trader.activeVaults + trader.graduatedVaults,
    activeVaults: trader.activeVaults,
    totalJuniorDeposited: Math.round((trader.totalAUM * trader.avgJuniorRatio) / 100),
    createdAt: toUnix(trader.joinedAt),
  }));
}

export function mockPositionViews(vaultViews = mockVaultViews()): PositionView[] {
  return investorPositions.map((position, index) => {
    const vault = vaultViews.find((item) => item.id === position.vaultId) ?? null;
    const totalDepositedLamports = toLamports(position.deposited);
    const seniorPrincipalRemainingRaw = toLamports(position.deposited);

    return {
      pubkey: `mock-position-${index + 1}`,
      vaultConfigPubkey: position.vaultId,
      vault,
      investorPubkey: "mock-investor",
      depositedAt: toUnix(position.depositedAt),
      seniorPrincipalRemaining: position.deposited,
      seniorPrincipalRemainingRaw,
      totalDeposited: position.deposited,
      totalDepositedLamports,
      alertThresholdBps: position.alertThreshold * 100,
      currentValue: position.currentValue,
      currentValueRaw: toLamports(position.currentValue),
    };
  });
}
