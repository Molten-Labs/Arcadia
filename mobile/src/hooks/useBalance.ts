import { useQuery } from '@tanstack/react-query';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '../lib/wallet';
import { getAssociatedTokenAddress } from '../lib/pdas';
import { USDC_MINT } from '../lib/constants';

export interface Balance {
  sol: number;
  usdc: number;
  usdcRaw: bigint;
}

export function useBalance() {
  const { publicKey, connection, isDemoWallet } = useWallet();

  return useQuery<Balance>({
    queryKey: ['balance', publicKey],
    queryFn: async (): Promise<Balance> => {
      if (!publicKey) return { sol: 0, usdc: 0, usdcRaw: 0n };

      if (isDemoWallet) {
        return { sol: 1.245, usdc: 5000, usdcRaw: 5_000_000_000n };
      }

      const pk = new PublicKey(publicKey);

      const [solBalance, tokenAccounts] = await Promise.all([
        connection.getBalance(pk),
        connection.getParsedTokenAccountsByOwner(pk, { mint: USDC_MINT }),
      ]);

      const sol = solBalance / LAMPORTS_PER_SOL;

      let usdc = 0;
      let usdcRaw = 0n;
      if (tokenAccounts.value.length > 0) {
        const info = tokenAccounts.value[0].account.data.parsed.info;
        usdc = parseFloat(info.tokenAmount.uiAmount ?? '0');
        usdcRaw = BigInt(info.tokenAmount.amount ?? '0');
      }

      return { sol, usdc, usdcRaw };
    },
    enabled: !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
