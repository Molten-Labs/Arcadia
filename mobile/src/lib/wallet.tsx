import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_IDENTITY, CLUSTER, RPC_URL } from './constants';

export type Role = 'investor' | 'trader';

interface WalletCtx {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  authToken: string | null;
  role: Role;
  cluster: 'devnet' | 'mainnet-beta';
  walletLabel: string | null;
  pendingRequest: string | null;
  setRole: (r: Role) => void;
  connection: Connection;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendArcadiaTransaction: (tx: Transaction, label: string) => Promise<string>;
  signAndSendTransaction: (tx: Transaction) => Promise<string>;
  isDemoWallet: boolean;
  isMwaAvailable: boolean;
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

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

function normalizeWalletAddress(address: string | Uint8Array | number[]): string {
  if (typeof address === 'string') return address;
  return new PublicKey(Uint8Array.from(address)).toBase58();
}

function normalizeSignature(signature: string | Uint8Array | number[]): string {
  if (typeof signature === 'string') return signature;
  return encodeBase58(Uint8Array.from(signature));
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [role, setRoleState] = useState<Role>('investor');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isDemoWallet, setIsDemoWallet] = useState(false);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), []);
  const isMwaAvailable = Platform.OS === 'android';

  useEffect(() => {
    (async () => {
      const storedKey = await AsyncStorage.getItem('wallet_pubkey');
      const storedRole = await AsyncStorage.getItem('wallet_role') as Role | null;
      const storedToken = await AsyncStorage.getItem('wallet_auth_token');
      const storedDemo = await AsyncStorage.getItem('wallet_is_demo');
      const storedLabel = await AsyncStorage.getItem('wallet_label');
      if (storedKey) { setPublicKey(storedKey); setConnected(true); }
      if (storedRole) setRoleState(storedRole);
      if (storedToken) setAuthToken(storedToken);
      if (storedDemo === '1') setIsDemoWallet(true);
      if (storedLabel) setWalletLabel(storedLabel);
    })();
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    AsyncStorage.setItem('wallet_role', r);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setPendingRequest('Opening wallet');
    try {
      if (!isMwaAvailable) {
        const demo = genDemoPubkey();
        setPublicKey(demo);
        setConnected(true);
        setIsDemoWallet(true);
        setWalletLabel('Read-only preview');
        await AsyncStorage.multiSet([
          ['wallet_pubkey', demo],
          ['wallet_is_demo', '1'],
          ['wallet_label', 'Read-only preview'],
        ]);
        return;
      }

      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
      await transact(async (wallet: any) => {
        const { accounts, auth_token } = await wallet.authorize({
          cluster: CLUSTER,
          identity: APP_IDENTITY,
        });
        if (accounts?.length > 0) {
          const pubkey = normalizeWalletAddress(accounts[0].address);
          const label = accounts[0].label ?? 'MWA wallet';
          setPublicKey(pubkey);
          setConnected(true);
          setAuthToken(auth_token);
          setIsDemoWallet(false);
          setWalletLabel(label);
          await AsyncStorage.multiSet([
            ['wallet_pubkey', pubkey],
            ['wallet_auth_token', auth_token],
            ['wallet_is_demo', '0'],
            ['wallet_label', label],
          ]);
        }
      });
    } catch (err: any) {
      throw new Error(friendlyWalletError(err));
    } finally {
      setConnecting(false);
      setPendingRequest(null);
    }
  }, [isMwaAvailable]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setPublicKey(null);
    setAuthToken(null);
    setIsDemoWallet(false);
    setWalletLabel(null);
    AsyncStorage.multiRemove(['wallet_pubkey', 'wallet_auth_token', 'wallet_is_demo', 'wallet_label']);
  }, []);

  const signAndSendTransaction = useCallback(async (tx: Transaction): Promise<string> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');
    if (isDemoWallet || !isMwaAvailable) throw new Error('Android Mobile Wallet Adapter signing required');

    const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    setPendingRequest('Awaiting wallet approval');
    return await transact(async (wallet: any) => {
      let token = authToken;
      try {
        const r = await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
        token = r.auth_token;
        setAuthToken(token);
        if (token) await AsyncStorage.setItem('wallet_auth_token', token);
      } catch { }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(publicKey);

      const serialized = tx.serialize({ requireAllSignatures: false });
      const signatures = await wallet.signAndSendTransactions({
        transactions: [serialized],
      });
      const sig = normalizeSignature(signatures[0]);

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      return sig;
    }).finally(() => setPendingRequest(null));
  }, [connected, publicKey, authToken, isDemoWallet, isMwaAvailable, connection]);

  const sendArcadiaTransaction = useCallback(async (tx: Transaction, label: string): Promise<string> => {
    setPendingRequest(label);
    try {
      return await signAndSendTransaction(tx);
    } finally {
      setPendingRequest(null);
    }
  }, [signAndSendTransaction]);

  const value = useMemo<WalletCtx>(() => ({
    connected, connecting, publicKey, authToken, role, setRole,
    cluster: CLUSTER, walletLabel, pendingRequest,
    connection, connect, disconnect, sendArcadiaTransaction, signAndSendTransaction, isDemoWallet, isMwaAvailable,
  }), [connected, connecting, publicKey, authToken, role, setRole, walletLabel, pendingRequest, connection, connect, disconnect, sendArcadiaTransaction, signAndSendTransaction, isDemoWallet, isMwaAvailable]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

function friendlyWalletError(error: any): string {
  const message = String(error?.message ?? error ?? '');
  if (message.includes('User rejected') || message.includes('declined')) return 'Wallet request cancelled';
  if (message.includes('timeout')) return 'Wallet did not respond. Please try again.';
  if (message.includes('No wallet') || message.includes('Activity not found')) return 'Install an MWA wallet such as Phantom or Solflare.';
  return message || 'Wallet connection failed';
}
