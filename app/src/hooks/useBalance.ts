import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function useBalance() {
  const { connection, publicKey } = useWallet();

  return useQuery({
    queryKey: ["balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!connection || !publicKey) throw new Error("Not connected");
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!connection && !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
