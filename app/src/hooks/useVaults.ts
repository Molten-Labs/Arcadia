import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { fetchAllVaults, fetchAllManagers } from "@/lib/solana/accounts";
import type { VaultConfigData, VaultStateData, ManagerProfileData } from "@/lib/solana/accounts";
import type { PublicKey, Connection } from "@solana/web3.js";

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
  juniorHealth: number;
  currentNav: number;
  highWaterMark: number;
  feeBps: number;
  maxSlippageBps: number;
  createdAt: number;
  graduatedAt: number;
  paperTradeCount: number;
  minQualifyingTrades: number;
  rolling24hLossBps: number;
  rolling7dLossBps: number;
  tradingEnabled: boolean;
  instantExit: boolean;
  vaultIndex: number;
}

function lamportsToUsd(lamports: bigint): number {
  return Number(lamports) / 1e9;
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
  const junior = lamportsToUsd(s.juniorCapital);
  const senior = lamportsToUsd(s.seniorCapital);
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
    juniorHealth: health,
    currentNav: lamportsToUsd(s.currentNav),
    highWaterMark: lamportsToUsd(s.highWaterMark),
    feeBps: v.config.managerFeeBps,
    maxSlippageBps: v.config.maxSlippageBps,
    createdAt: Number(v.config.createdAt),
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

  return useQuery({
    queryKey: ["vaults"],
    queryFn: async () => {
      if (!connection) throw new Error("No connection");
      const raw = await fetchAllVaults(connection);
      return raw.map(toVaultView).filter((v): v is VaultView => v !== null);
    },
    enabled: !!connection,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export interface ManagerView {
  pubkey: string;
  owner: string;
  totalVaults: number;
  activeVaults: number;
  totalJuniorDeposited: number;
  createdAt: number;
}

export function useManagers() {
  const { connection } = useWallet();

  return useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      if (!connection) throw new Error("No connection");
      const raw = await fetchAllManagers(connection);
      return raw.map((m) => ({
        pubkey: m.pubkey.toBase58(),
        owner: m.data.owner.toBase58(),
        totalVaults: m.data.totalVaults,
        activeVaults: m.data.activeVaults,
        totalJuniorDeposited: lamportsToUsd(m.data.totalJuniorDeposited),
        createdAt: m.data.createdAt,
      }));
    },
    enabled: !!connection,
    staleTime: 30_000,
  });
}

export function useVault(id: string | undefined) {
  const { data: vaults } = useVaults();

  return useQuery({
    queryKey: ["vault", id],
    queryFn: () => {
      const vault = vaults?.find((v) => v.id === id);
      if (!vault) throw new Error("Vault not found");
      return vault;
    },
    enabled: !!id && !!vaults,
  });
}
