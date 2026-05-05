import React, { createContext, useContext, useState, useCallback } from 'react';

export type Role = 'investor' | 'trader';

interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  role: Role;
  connect: () => void;
  disconnect: () => void;
  setRole: (role: Role) => void;
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

function genMockPubkey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let s = '';
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('investor');

  const connect = useCallback(() => {
    setPublicKey(genMockPubkey());
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setConnected(false);
  }, []);

  return (
    <WalletContext.Provider value={{ connected, publicKey, role, connect, disconnect, setRole }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
