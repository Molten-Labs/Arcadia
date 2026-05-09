import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT } from "@/lib/solana/constants";

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

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function useUsdcBalance() {
  const { connection, publicKey } = useWallet();

  return useQuery({
    queryKey: ["usdc-balance", publicKey?.toBase58(), USDC_MINT.toBase58()],
    queryFn: async () => {
      if (!connection || !publicKey) throw new Error("Not connected");
      const ata = getAssociatedTokenAddress(publicKey, USDC_MINT);
      try {
        const balance = await connection.getTokenAccountBalance(ata);
        return Number(balance.value.uiAmount ?? 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("could not find account") || message.includes("Invalid param")) {
          return 0;
        }
        throw error;
      }
    },
    enabled: !!connection && !!publicKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
