import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_IDENTITY, CLUSTER, RPC_URL } from './constants';

export type Role = 'investor' | 'trader';

interface WalletCtx {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  role: Role;
  setRole: (r: Role) => void;
  connection: Connection;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSendTransaction: (tx: Transaction) => Promise<string>;
  isDemoWallet: boolean;
}

const WalletContext = createContext<WalletCtx | null>(null);

export function useWallet(): WalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

function genDemoPubkey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let s = '';
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [role, setRoleState] = useState<Role>('investor');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isDemoWallet, setIsDemoWallet] = useState(false);

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), []);

  useEffect(() => {
    (async () => {
      const storedKey = await AsyncStorage.getItem('wallet_pubkey');
      const storedRole = await AsyncStorage.getItem('wallet_role') as Role | null;
      const storedToken = await AsyncStorage.getItem('wallet_auth_token');
      const storedDemo = await AsyncStorage.getItem('wallet_is_demo');
      if (storedKey) { setPublicKey(storedKey); setConnected(true); }
      if (storedRole) setRoleState(storedRole);
      if (storedToken) setAuthToken(storedToken);
      if (storedDemo === '1') setIsDemoWallet(true);
    })();
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    AsyncStorage.setItem('wallet_role', r);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
      await transact(async (wallet: any) => {
        const { accounts, auth_token } = await wallet.authorize({
          cluster: CLUSTER,
          identity: APP_IDENTITY,
        });
        if (accounts?.length > 0) {
          const raw = accounts[0].address;
          const pubkey = new PublicKey(Buffer.from(raw)).toBase58();
          setPublicKey(pubkey);
          setConnected(true);
          setAuthToken(auth_token);
          setIsDemoWallet(false);
          await AsyncStorage.multiSet([
            ['wallet_pubkey', pubkey],
            ['wallet_auth_token', auth_token],
            ['wallet_is_demo', '0'],
          ]);
        }
      });
    } catch (err: any) {
      const demo = genDemoPubkey();
      setPublicKey(demo);
      setConnected(true);
      setIsDemoWallet(true);
      await AsyncStorage.multiSet([
        ['wallet_pubkey', demo],
        ['wallet_is_demo', '1'],
      ]);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setPublicKey(null);
    setAuthToken(null);
    setIsDemoWallet(false);
    AsyncStorage.multiRemove(['wallet_pubkey', 'wallet_auth_token', 'wallet_is_demo']);
  }, []);

  const signAndSendTransaction = useCallback(async (tx: Transaction): Promise<string> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');
    if (isDemoWallet) throw new Error('demo');

    const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    return await transact(async (wallet: any) => {
      let token = authToken;
      try {
        const r = await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
        token = r.auth_token;
        setAuthToken(token);
        await AsyncStorage.setItem('wallet_auth_token', token!);
      } catch { }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(publicKey);

      const serialized = tx.serialize({ requireAllSignatures: false });
      const [sig] = await wallet.signAndSendTransactions({
        transactions: [serialized],
      });

      await connection.confirmTransaction(
        { signature: Buffer.from(sig).toString('base64'), blockhash, lastValidBlockHeight },
        'confirmed',
      );
      return Buffer.from(sig).toString('base64');
    });
  }, [connected, publicKey, authToken, isDemoWallet, connection]);

  const value = useMemo<WalletCtx>(() => ({
    connected, connecting, publicKey, role, setRole,
    connection, connect, disconnect, signAndSendTransaction, isDemoWallet,
  }), [connected, connecting, publicKey, role, setRole, connection, connect, disconnect, signAndSendTransaction, isDemoWallet]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
