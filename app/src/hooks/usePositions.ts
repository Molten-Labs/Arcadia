import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { PROGRAM_ID } from "@/lib/solana/constants";
import { decodeInvestorPosition } from "@/lib/solana/accounts";
import type { InvestorPositionData } from "@/lib/solana/accounts";
import type { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useVaults, type VaultView } from "./useVaults";

const INVESTOR_POSITION_DISC = 4;

export interface PositionView {
  pubkey: string;
  vaultConfigPubkey: string;
  vault: VaultView | null;
  investorPubkey: string;
  depositedAt: number;
  seniorShares: number;
  totalDeposited: number;
  alertThresholdBps: number;
  currentValue: number;
}

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

function estimateCurrentValue(
  pos: InvestorPositionData,
  vault: VaultView | null
): number {
  if (!vault || vault.seniorCapital === 0) return lamportsToSol(pos.totalDeposited);
  const deposited = lamportsToSol(pos.totalDeposited);
  const navRatio = vault.currentNav > 0 ? vault.tvl / vault.currentNav : 1;
  return deposited * navRatio;
}

export function usePositions() {
  const { connection, publicKey } = useWallet();
  const { data: vaults } = useVaults();

  return useQuery({
    queryKey: ["positions", publicKey?.toBase58()],
    queryFn: async () => {
      if (!connection || !publicKey) throw new Error("Not connected");
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([INVESTOR_POSITION_DISC])) } },
          { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
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
          totalDeposited: lamportsToSol(data.totalDeposited),
          alertThresholdBps: data.alertThresholdBps,
          currentValue: estimateCurrentValue(data, vault),
        } satisfies PositionView;
      });
    },
    enabled: !!connection && !!publicKey && !!vaults,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
