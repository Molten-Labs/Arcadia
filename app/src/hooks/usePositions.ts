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
  seniorPrincipalRemaining: number;
  seniorPrincipalRemainingRaw: bigint;
  seniorShares?: number;
  seniorSharesRaw?: bigint;
  totalDeposited: number;
  totalDepositedLamports: bigint;
  alertThresholdBps: number;
  currentValue: number;
  currentValueRaw: bigint;
}

const USDC_DECIMALS = 1e6;

function tokenUnitsToUsdc(units: bigint): number {
  return Number(units) / USDC_DECIMALS;
}

export function calculatePositionValue(
  seniorPrincipalRemainingRaw: bigint,
  totalDepositedLamports: bigint,
  vault: VaultView | null
): number {
  if (!vault || vault.seniorSharesOutstandingRaw === 0n) return tokenUnitsToUsdc(totalDepositedLamports);
  return tokenUnitsToUsdc(calculatePositionValueRaw(seniorPrincipalRemainingRaw, totalDepositedLamports, vault));
}

export function calculatePositionValueRaw(
  seniorPrincipalRemainingRaw: bigint,
  totalDepositedLamports: bigint,
  vault: VaultView | null
): bigint {
  if (!vault || vault.seniorSharesOutstandingRaw === 0n) return totalDepositedLamports;
  return (seniorPrincipalRemainingRaw * vault.seniorCapitalLamports) / vault.seniorSharesOutstandingRaw;
}

function estimateCurrentValue(pos: InvestorPositionData, vault: VaultView | null): number {
  return calculatePositionValue(pos.seniorShares, pos.totalDeposited, vault);
}

export function normalizeApiPosition(pos: PositionView): PositionView {
  const vault = pos.vault ? normalizeVaultView(pos.vault) : null;
  const seniorPrincipalRemaining = Number(pos.seniorPrincipalRemaining ?? pos.seniorShares ?? 0);
  const totalDeposited = Number(pos.totalDeposited);
  const seniorPrincipalRemainingRaw =
    pos.seniorPrincipalRemainingRaw ??
    pos.seniorSharesRaw ??
    (pos.seniorShares !== undefined
      ? BigInt(Math.round(pos.seniorShares))
      : BigInt(Math.round(seniorPrincipalRemaining * USDC_DECIMALS)));
  const totalDepositedLamports =
    pos.totalDepositedLamports ?? BigInt(Math.round(totalDeposited * USDC_DECIMALS));
  const providedCurrentValue = Number(pos.currentValue);
  const currentValueRaw = pos.currentValueRaw ??
    (Number.isFinite(providedCurrentValue)
      ? BigInt(Math.round(providedCurrentValue * USDC_DECIMALS))
      : calculatePositionValueRaw(seniorPrincipalRemainingRaw, totalDepositedLamports, vault));

  return {
    ...pos,
    vault,
    depositedAt: Number(pos.depositedAt),
    seniorPrincipalRemaining,
    seniorPrincipalRemainingRaw,
    seniorShares: seniorPrincipalRemaining,
    seniorSharesRaw: seniorPrincipalRemainingRaw,
    totalDeposited,
    totalDepositedLamports,
    alertThresholdBps: Number(pos.alertThresholdBps),
    currentValue: tokenUnitsToUsdc(currentValueRaw),
    currentValueRaw,
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
        console.warn("Arcadia API unavailable; falling back to direct RPC position reads.", error);
      }

      if (!connection || !vaults) throw new Error("No connection or Arcadia API configured");
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
          seniorPrincipalRemaining: tokenUnitsToUsdc(data.seniorShares),
          seniorPrincipalRemainingRaw: data.seniorShares,
          seniorShares: tokenUnitsToUsdc(data.seniorShares),
          seniorSharesRaw: data.seniorShares,
          totalDeposited: tokenUnitsToUsdc(data.totalDeposited),
          totalDepositedLamports: data.totalDeposited,
          alertThresholdBps: data.alertThresholdBps,
          currentValue: estimateCurrentValue(data, vault),
          currentValueRaw: calculatePositionValueRaw(data.seniorShares, data.totalDeposited, vault),
        } satisfies PositionView;
      });
    },
    enabled: isMock || (!!publicKey && (!!getKilnApiUrl() || (!!connection && !!vaults))),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
