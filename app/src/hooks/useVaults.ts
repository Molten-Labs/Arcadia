import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { fetchAllVaults, fetchAllManagers } from "@/lib/solana/accounts";
import { fetchKilnApi, getKilnApiUrl, isArcadiaDevnetProductMode, type ApiItems } from "@/lib/api";
import { useDataMode } from "@/hooks/useDataMode";
import { mockManagerViews, mockVaultViews } from "@/lib/mockViews";
import type { VaultConfigData, VaultStateData } from "@/lib/solana/accounts";
import type { PublicKey } from "@solana/web3.js";

export interface OnChainVault {
  configPubkey: PublicKey;
  config: VaultConfigData;
  state: VaultStateData | null;
}

export interface VaultView {
  id: string;
  name: string;
  configPubkey: string;
  statePubkey: string;
  treasuryPubkey: string;
  managerPubkey: string;
  status: "paper" | "active" | "cooldown" | "frozen" | "closed";
  tvl: number;
  juniorCapital: number;
  seniorCapital: number;
  originalJuniorDepositLamports: bigint;
  juniorCapitalLamports: bigint;
  seniorCapitalLamports: bigint;
  juniorSharesOutstanding: number;
  seniorSharesOutstanding: number;
  juniorSharesOutstandingRaw: bigint;
  seniorSharesOutstandingRaw: bigint;
  juniorHealth: number;
  currentNav: number;
  currentNavLamports: bigint;
  highWaterMark: number;
  highWaterMarkLamports: bigint;
  feeBps: number;
  maxSlippageBps: number;
  createdAt: number;
  paperWindowSecs: number;
  graduatedAt: number;
  paperTradeCount: number;
  minQualifyingTrades: number;
  rolling24hLossBps: number;
  rolling7dLossBps: number;
  tradingEnabled: boolean;
  instantExit: boolean;
  vaultIndex: number;
  // ── enriched display fields (populated in mock mode & API) ──
  sparkline?: number[];
  return30d?: number;
  return7d?: number;
  returnAll?: number;
  strategyTags?: string[];
  liquidUsdc?: number;
  wsolExposureValue?: number;
  reserveStatus?: "ok" | "watch" | "violation" | string;
  executionEnv?: string | null;
  lastMarketUpdate?: number;
  reserveCapital?: number;       // accumulated self-funded reserve pool
  reserveAllocationBps?: number; // % of trader fees routed to reserve
}

type ApiVaultView = Partial<VaultView> & {
  configPubkey: string;
  managerProfilePubkey?: string;
};

const USDC_DECIMALS = 1e6;

function tokenUnitsToUsdc(units: bigint): number {
  return Number(units) / USDC_DECIMALS;
}

function deriveStatus(state: VaultStateData): VaultView["status"] {
  if (state.isPaperMode) return "paper";
  if (state.juniorCapital === 0n && state.isGraduated) return "frozen";
  if (state.isPaused) return "cooldown";
  if (state.isGraduated) return "active";
  return "paper";
}

function deriveHealth(state: VaultStateData): number {
  if (state.originalJuniorDeposit === 0n) return 0;
  const ratio = Number(state.juniorCapital) / Number(state.originalJuniorDeposit);
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

export function toVaultView(v: OnChainVault): VaultView | null {
  if (!v.state) return null;
  const s = v.state;
  const junior = tokenUnitsToUsdc(s.juniorCapital);
  const senior = tokenUnitsToUsdc(s.seniorCapital);
  const status = deriveStatus(s);
  const health = deriveHealth(s);

  return {
    id: v.configPubkey.toBase58(),
    name: v.config.name || `Vault #${v.config.vaultIndex}`,
    configPubkey: v.configPubkey.toBase58(),
    statePubkey: v.config.vaultState.toBase58(),
    treasuryPubkey: v.config.treasury.toBase58(),
    managerPubkey: v.config.manager.toBase58(),
    status,
    tvl: junior + senior,
    juniorCapital: junior,
    seniorCapital: senior,
    originalJuniorDepositLamports: s.originalJuniorDeposit,
    juniorCapitalLamports: s.juniorCapital,
    seniorCapitalLamports: s.seniorCapital,
    juniorSharesOutstanding: Number(s.juniorSharesOutstanding),
    seniorSharesOutstanding: Number(s.seniorSharesOutstanding),
    juniorSharesOutstandingRaw: s.juniorSharesOutstanding,
    seniorSharesOutstandingRaw: s.seniorSharesOutstanding,
    juniorHealth: health,
    currentNav: tokenUnitsToUsdc(s.currentNav),
    currentNavLamports: s.currentNav,
    highWaterMark: tokenUnitsToUsdc(s.highWaterMark),
    highWaterMarkLamports: s.highWaterMark,
    feeBps: v.config.managerFeeBps,
    maxSlippageBps: v.config.maxSlippageBps,
    createdAt: Number(v.config.createdAt),
    paperWindowSecs: Number(v.config.paperWindowSecs),
    graduatedAt: Number(s.graduatedAt),
    paperTradeCount: s.paperTradeCount,
    minQualifyingTrades: s.minQualifyingTrades,
    rolling24hLossBps: s.rolling24hLossBps,
    rolling7dLossBps: s.rolling7dLossBps,
    tradingEnabled: s.tradingEnabled,
    instantExit: health < 20,
    vaultIndex: v.config.vaultIndex,
  };
}

export function useVaults() {
  const { connection } = useWallet();
  const { mode, isMock } = useDataMode();
  const apiUrl = getKilnApiUrl();

  return useQuery({
    queryKey: ["vaults", mode, apiUrl || "rpc"],
    queryFn: async () => {
      if (isMock) return mockVaultViews();

      // Try API first if configured
      if (apiUrl) {
        try {
          const api = await fetchKilnApi<ApiItems<ApiVaultView>>("/vaults");
          if (api && (api.items.length > 0 || !connection || !isArcadiaDevnetProductMode())) {
            return api.items.map(normalizeVaultView);
          }
        } catch (error) {
          console.warn("Arcadia API unavailable; falling back to direct RPC vault reads.", error);
          if (!connection) throw error;
        }
      }

      if (!connection) throw new Error("No connection available and Arcadia API not configured");
      const raw = await fetchAllVaults(connection);
      return raw.map(toVaultView).filter((v): v is VaultView => v !== null);
    },
    enabled: isMock || !!apiUrl || !!connection,
    staleTime: isMock ? 5_000 : 30_000,
    refetchInterval: isMock ? 8_000 : 60_000,
  });
}

export interface ManagerView {
  pubkey: string;
  owner: string;
  totalVaults: number;
  activeVaults: number;
  totalJuniorDeposited: number;
  createdAt: number;
  reputationScore?: number;
  pnl30d?: number;
  maxDrawdown?: number;
  capitalHandled?: number;
  claimedFees?: number;
  frozenVaultCount?: number;
}

export function useManagers() {
  const { connection } = useWallet();
  const { mode, isMock } = useDataMode();

  return useQuery({
    queryKey: ["managers", mode, getKilnApiUrl() || "rpc"],
    queryFn: async () => {
      if (isMock) return mockManagerViews();

      // Try API first if configured
      if (getKilnApiUrl()) {
        try {
          const api = await fetchKilnApi<ApiItems<ManagerView>>("/managers");
          if (api && (api.items.length > 0 || !connection || !isArcadiaDevnetProductMode())) {
            return api.items;
          }
        } catch (error) {
          console.warn("Arcadia API unavailable; falling back to direct RPC manager reads.", error);
          if (!connection) throw error;
        }
      }

      if (!connection) throw new Error("No connection available and Arcadia API not configured");
      const raw = await fetchAllManagers(connection);
      return raw.map((m) => ({
        pubkey: m.pubkey.toBase58(),
        owner: m.data.owner.toBase58(),
        totalVaults: m.data.totalVaults,
        activeVaults: m.data.activeVaults,
        totalJuniorDeposited: tokenUnitsToUsdc(m.data.totalJuniorDeposited),
        createdAt: m.data.createdAt,
        reputationScore: 0,
        pnl30d: 0,
        maxDrawdown: 0,
        capitalHandled: 0,
        claimedFees: 0,
        frozenVaultCount: 0,
      }));
    },
    enabled: isMock || !!getKilnApiUrl() || !!connection,
    staleTime: 30_000,
  });
}

export function useVault(id: string | undefined) {
  const { data: vaults, isLoading: vaultsLoading, isFetching: vaultsFetching } = useVaults();

  const query = useQuery({
    queryKey: ["vault", id],
    queryFn: () => {
      const vault = vaults?.find((v) => v.id === id);
      if (!vault) throw new Error("Vault not found");
      return vault;
    },
    enabled: !!id && !!vaults,
  });

  return {
    ...query,
    isLoading: vaultsLoading || query.isLoading,
    isFetching: vaultsFetching || query.isFetching,
  };
}

export function normalizeVaultView(v: ApiVaultView): VaultView {
  const juniorCapital = Number(v.juniorCapital ?? 0);
  const seniorCapital = Number(v.seniorCapital ?? 0);
  const currentNav = Number(v.currentNav ?? juniorCapital + seniorCapital);
  const juniorSharesOutstanding = Number(v.juniorSharesOutstanding ?? 0);
  const seniorSharesOutstanding = Number(v.seniorSharesOutstanding ?? 0);

  return {
    id: v.id || v.configPubkey,
    name: v.name || `Vault ${v.configPubkey.slice(0, 4)}`,
    configPubkey: v.configPubkey,
    statePubkey: v.statePubkey || "",
    treasuryPubkey: v.treasuryPubkey || "",
    managerPubkey: v.managerPubkey || "",
    status: v.status || "paper",
    tvl: Number(v.tvl ?? juniorCapital + seniorCapital),
    juniorCapital,
    seniorCapital,
    originalJuniorDepositLamports: v.originalJuniorDepositLamports ?? BigInt(Math.round(juniorCapital * USDC_DECIMALS)),
    juniorCapitalLamports: v.juniorCapitalLamports ?? BigInt(Math.round(juniorCapital * USDC_DECIMALS)),
    seniorCapitalLamports: v.seniorCapitalLamports ?? BigInt(Math.round(seniorCapital * USDC_DECIMALS)),
    juniorSharesOutstanding,
    seniorSharesOutstanding,
    juniorSharesOutstandingRaw: v.juniorSharesOutstandingRaw ?? BigInt(Math.round(juniorSharesOutstanding * USDC_DECIMALS)),
    seniorSharesOutstandingRaw: v.seniorSharesOutstandingRaw ?? BigInt(Math.round(seniorSharesOutstanding * USDC_DECIMALS)),
    juniorHealth: Number(v.juniorHealth ?? 0),
    currentNav,
    currentNavLamports: v.currentNavLamports ?? BigInt(Math.round(currentNav * USDC_DECIMALS)),
    highWaterMark: Number(v.highWaterMark ?? 0),
    highWaterMarkLamports: v.highWaterMarkLamports ?? BigInt(Math.round(Number(v.highWaterMark ?? 0) * USDC_DECIMALS)),
    feeBps: Number(v.feeBps ?? 0),
    maxSlippageBps: Number(v.maxSlippageBps ?? 0),
    createdAt: Number(v.createdAt ?? 0),
    paperWindowSecs: Number(v.paperWindowSecs ?? 0),
    graduatedAt: Number(v.graduatedAt ?? 0),
    paperTradeCount: Number(v.paperTradeCount ?? 0),
    minQualifyingTrades: Number(v.minQualifyingTrades ?? 0),
    rolling24hLossBps: Number(v.rolling24hLossBps ?? 0),
    rolling7dLossBps: Number(v.rolling7dLossBps ?? 0),
    tradingEnabled: v.tradingEnabled ?? true,
    instantExit: v.instantExit ?? Number(v.juniorHealth ?? 0) < 20,
    vaultIndex: Number(v.vaultIndex ?? 0),
    liquidUsdc: Number(v.liquidUsdc ?? currentNav),
    wsolExposureValue: Number(v.wsolExposureValue ?? 0),
    reserveStatus: v.reserveStatus ?? "ok",
    executionEnv: v.executionEnv ?? null,
    lastMarketUpdate: Number(v.lastMarketUpdate ?? 0),
    reserveCapital: Number(v.reserveCapital ?? 0),
    reserveAllocationBps: Number(v.reserveAllocationBps ?? 0),
  };
}
