import { useCallback } from 'react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '../lib/wallet';
import {
  ExecuteJupiterSwapParams,
  buildClaimFeesIx,
  buildCreateVaultIx,
  buildDepositJuniorIx,
  buildDepositSeniorIx,
  buildExecuteGuardedSwapIx,
  buildExecuteJupiterSwapIx,
  buildGraduateVaultIx,
  buildInitManagerIx,
  buildUpdateNavIx,
  buildWithdrawJuniorIx,
  buildWithdrawSeniorIx,
} from '../lib/transactions';

export function useArcadiaTransactions() {
  const { connected, publicKey, connection, sendArcadiaTransaction, isDemoWallet } = useWallet();
  const queryClient = useQueryClient();

  const send = useCallback(
    async (ixs: TransactionInstruction[], label: string): Promise<{ sig: string; demo: boolean }> => {
      if (!connected || !publicKey) throw new Error('Wallet not connected');

      if (isDemoWallet) {
        await new Promise(r => setTimeout(r, 1200));
        queryClient.invalidateQueries({ queryKey: ['vaults'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        return { sig: 'DEMO_' + Math.random().toString(36).slice(2, 14).toUpperCase(), demo: true };
      }

      const tx = new Transaction().add(...ixs);
      tx.feePayer = new PublicKey(publicKey);
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendArcadiaTransaction(tx, label);
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      return { sig, demo: false };
    },
    [connected, publicKey, connection, sendArcadiaTransaction, isDemoWallet, queryClient],
  );

  const requireWallet = useCallback(() => {
    if (!publicKey) throw new Error('No wallet');
    return new PublicKey(publicKey);
  }, [publicKey]);

  const initManager = useCallback(async () => {
    const pk = requireWallet();
    return send([buildInitManagerIx(pk)], 'Init Manager');
  }, [requireWallet, send]);

  const createVault = useCallback(async (params: {
    name: string; feeBps: number; maxSlippageBps: number;
    paperWindowSecs: number; minQualifyingTrades?: number; vaultIndex?: number;
  }) => {
    const pk = requireWallet();
    return send([buildCreateVaultIx(pk, params)], 'Create Vault');
  }, [requireWallet, send]);

  const depositJunior = useCallback(async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
    return send([buildDepositJuniorIx(requireWallet(), vaultConfigPubkey, usdcUnits)], 'Deposit Junior');
  }, [requireWallet, send]);

  const depositSenior = useCallback(async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
    return send([buildDepositSeniorIx(requireWallet(), vaultConfigPubkey, usdcUnits)], 'Deposit Senior');
  }, [requireWallet, send]);

  const withdrawSenior = useCallback(async (vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint) => {
    return send([buildWithdrawSeniorIx(requireWallet(), vaultConfigPubkey, amountUsdcUnits)], 'Withdraw Senior');
  }, [requireWallet, send]);

  const withdrawJunior = useCallback(async (vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint) => {
    return send([buildWithdrawJuniorIx(requireWallet(), vaultConfigPubkey, amountUsdcUnits)], 'Withdraw Junior');
  }, [requireWallet, send]);

  const updateNav = useCallback(async (vaultConfigPubkey: PublicKey) => {
    return send([buildUpdateNavIx(requireWallet(), vaultConfigPubkey)], 'Update NAV');
  }, [requireWallet, send]);

  const graduateVault = useCallback(async (vaultConfigPubkey: PublicKey, managerPubkey: PublicKey) => {
    return send([buildGraduateVaultIx(requireWallet(), vaultConfigPubkey, managerPubkey)], 'Graduate Vault');
  }, [requireWallet, send]);

  const claimFees = useCallback(async (vaultConfigPubkey: PublicKey) => {
    return send([buildClaimFeesIx(requireWallet(), vaultConfigPubkey)], 'Claim Fees');
  }, [requireWallet, send]);

  const executeGuardedSwap = useCallback(async (
    vaultConfigPubkey: PublicKey,
    inAmount: bigint,
    minimumAmountOut: bigint,
  ) => {
    return send([buildExecuteGuardedSwapIx(requireWallet(), vaultConfigPubkey, inAmount, minimumAmountOut)], 'Guarded Swap');
  }, [requireWallet, send]);

  const executeJupiterSwap = useCallback(async (vaultConfigPubkey: PublicKey, params: ExecuteJupiterSwapParams) => {
    return send([buildExecuteJupiterSwapIx(requireWallet(), vaultConfigPubkey, params)], 'Jupiter Swap');
  }, [requireWallet, send]);

  return {
    initManager,
    createVault,
    depositJunior,
    depositSenior,
    withdrawSenior,
    withdrawJunior,
    updateNav,
    graduateVault,
    claimFees,
    executeGuardedSwap,
    executeJupiterSwap,
  };
}
