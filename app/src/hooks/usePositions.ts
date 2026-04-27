import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { PROGRAM_ID } from "@/lib/solana/constants";
import { decodeInvestorPosition } from "@/lib/solana/accounts";
import { fetchKilnApi, getKilnApiUrl, type ApiItems } from "@/lib/api";
import { useDataMode } from "@/hooks/useDataMode";
import { mockPositionViews } from "@/lib/mockViews";
import type { InvestorPositionData } from "@/lib/solana/accounts";
import bs58 from "bs58";
import { normalizeVaultView, useVaults, type VaultView } from "./useVaults";

const INVESTOR_POSITION_DISC = 4;

export interface PositionView {
  pubkey: string;
  vaultConfigPubkey: string;
  vault: VaultView | null;
  investorPubkey: string;
  depositedAt: number;
  seniorShares: number;
  seniorSharesRaw: bigint;
  totalDeposited: number;
  totalDepositedLamports: bigint;
  alertThresholdBps: number;
  currentValue: number;
}

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

export function calculatePositionValue(
  seniorSharesRaw: bigint,
  totalDepositedLamports: bigint,
  vault: VaultView | null
): number {
  if (!vault || vault.seniorSharesOutstandingRaw === 0n) return lamportsToSol(totalDepositedLamports);
  const valueLamports =
    (seniorSharesRaw * vault.seniorCapitalLamports) / vault.seniorSharesOutstandingRaw;
  return lamportsToSol(valueLamports);
}

function estimateCurrentValue(pos: InvestorPositionData, vault: VaultView | null): number {
  return calculatePositionValue(pos.seniorShares, pos.totalDeposited, vault);
}

function normalizeApiPosition(pos: PositionView): PositionView {
  const vault = pos.vault ? normalizeVaultView(pos.vault) : null;
  const seniorShares = Number(pos.seniorShares);
  const totalDeposited = Number(pos.totalDeposited);
  const seniorSharesRaw = pos.seniorSharesRaw ?? BigInt(Math.round(seniorShares));
  const totalDepositedLamports =
    pos.totalDepositedLamports ?? BigInt(Math.round(totalDeposited * 1e9));

  return {
    ...pos,
    vault,
    depositedAt: Number(pos.depositedAt),
    seniorShares,
    seniorSharesRaw,
    totalDeposited,
    totalDepositedLamports,
    alertThresholdBps: Number(pos.alertThresholdBps),
    currentValue: calculatePositionValue(seniorSharesRaw, totalDepositedLamports, vault),
  };
}

export function usePositions() {
  const { connection, publicKey } = useWallet();
  const { data: vaults } = useVaults();
  const { mode, isMock } = useDataMode();

  return useQuery({
    queryKey: ["positions", mode, publicKey?.toBase58() || "mock", getKilnApiUrl() || "rpc"],
    queryFn: async () => {
      if (isMock) return mockPositionViews(vaults);

      if (!publicKey) throw new Error("Not connected");
      const wallet = publicKey.toBase58();

      try {
        const api = await fetchKilnApi<ApiItems<PositionView>>(`/positions/${wallet}`);
        if (api) return api.items.map(normalizeApiPosition);
      } catch (error) {
        if (!connection || !vaults) throw error;
        console.warn("Kiln API unavailable; falling back to direct RPC position reads.", error);
      }

      if (!connection || !vaults) throw new Error("No connection or Kiln API configured");
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([INVESTOR_POSITION_DISC])) } },
          { memcmp: { offset: 8, bytes: wallet } },
        ],
      });

      return accounts.map((a) => {
        const data = decodeInvestorPosition(Buffer.from(a.account.data));
        const vaultId = data.vaultConfig.toBase58();
        const vault = vaults?.find((v) => v.configPubkey === vaultId) ?? null;

        return {
          pubkey: a.pubkey.toBase58(),
          vaultConfigPubkey: vaultId,
          vault,
          investorPubkey: data.investor.toBase58(),
          depositedAt: Number(data.depositedAt),
          seniorShares: Number(data.seniorShares),
          seniorSharesRaw: data.seniorShares,
          totalDeposited: lamportsToSol(data.totalDeposited),
          totalDepositedLamports: data.totalDeposited,
          alertThresholdBps: data.alertThresholdBps,
          currentValue: estimateCurrentValue(data, vault),
        } satisfies PositionView;
      });
    },
    enabled: isMock || (!!publicKey && (!!getKilnApiUrl() || (!!connection && !!vaults))),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
