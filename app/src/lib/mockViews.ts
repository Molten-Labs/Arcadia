import { mockStore } from "./mockStore";
import type { PositionView } from "@/hooks/usePositions";
import type { ManagerView, VaultView } from "@/hooks/useVaults";

const toLamports = (value: number) => BigInt(Math.round(value * 1e6));
const toUnix = (date: string | undefined) => date ? Math.floor(new Date(date).getTime() / 1000) : 0;

const liveJitter = (seed: number, amplitude: number): number => {
  const t = Date.now() / 1000;
  return Math.sin(t * 0.22 + seed * 1.7) * amplitude;
};

export function mockVaultViews(): VaultView[] {
  return mockStore.vaults.map((vault, index) => {
    const jHealth = Math.max(1, Math.min(100,
      Math.round((vault.juniorHealth + liveJitter(index, 1.8)) * 10) / 10
    ));
    const jTvl = Math.round(vault.tvl * (1 + liveJitter(index + 5, 0.003)));
    const currentNav = jTvl;
    const highWaterMark = vault.hwm;
    const paperWindowSecs = (vault.paperDaysRequired ?? 30) * 86400;
    const paperTradeCount = vault.trades.length || Math.max(0, Math.min(10, vault.paperDaysElapsed ?? 0));
    const sparkline = vault.navHistory.slice(-30).map(h => h.nav);

    return {
      id: vault.id,
      name: vault.name,
      configPubkey: vault.id,
      statePubkey: `${vault.id}-state`,
      treasuryPubkey: `${vault.id}-treasury`,
      managerPubkey: vault.traderWallet,
      status: vault.status,
      tvl: jTvl,
      juniorCapital: Math.round(vault.juniorCapital * (1 + liveJitter(index + 2, 0.002))),
      seniorCapital: vault.seniorCapital,
      originalJuniorDepositLamports: toLamports(vault.juniorCapital / Math.max(vault.juniorHealth / 100, 0.01)),
      juniorCapitalLamports: toLamports(vault.juniorCapital),
      seniorCapitalLamports: toLamports(vault.seniorCapital),
      juniorSharesOutstanding: vault.juniorCapital,
      seniorSharesOutstanding: vault.seniorCapital,
      juniorSharesOutstandingRaw: toLamports(vault.juniorCapital),
      seniorSharesOutstandingRaw: toLamports(vault.seniorCapital),
      juniorHealth: jHealth,
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
      sparkline,
      return30d: vault.return30d + liveJitter(index + 8, 0.15),
      return7d: vault.return7d + liveJitter(index + 12, 0.08),
      returnAll: vault.returnAll,
      strategyTags: vault.strategyTags,
      reserveCapital: vault.reserveCapital,
      reserveAllocationBps: vault.reserveAllocationBps,
    };
  });
}

export function mockManagerViews(): ManagerView[] {
  return mockStore.vaults
    .filter((v, i, arr) => arr.findIndex(x => x.traderWallet === v.traderWallet) === i)
    .map((vault) => {
      const traderVaults = mockStore.vaults.filter(v => v.traderWallet === vault.traderWallet);
      return {
        pubkey: `${vault.traderWallet}-profile`,
        owner: vault.traderWallet,
        totalVaults: traderVaults.length,
        activeVaults: traderVaults.filter(v => v.status === "active").length,
        totalJuniorDeposited: traderVaults.reduce((s, v) => s + v.juniorCapital, 0),
        createdAt: toUnix(vault.createdAt),
      };
    });
}

export function mockPositionViews(vaultViews = mockVaultViews()): PositionView[] {
  return mockStore.positions.map((position, index) => {
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
