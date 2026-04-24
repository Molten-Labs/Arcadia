import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "investor" | "trader";

interface WalletState {
  connected: boolean;
  address: string | null;
  role: Role;
  connect: () => void;
  disconnect: () => void;
  setRole: (r: Role) => void;
}

const defaultState: WalletState = {
  connected: false,
  address: null,
  role: "investor",
  connect: () => {},
  disconnect: () => {},
  setRole: () => {},
};

const WalletContext = createContext<WalletState>(defaultState);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("investor");

  return (
    <WalletContext.Provider
      value={{
        connected,
        address,
        role,
        connect: () => {
          setConnected(true);
          setAddress("8FpA9z3kQrLmN7vBcXdYuT2hJ5wK3xQ");
        },
        disconnect: () => {
          setConnected(false);
          setAddress(null);
        },
        setRole,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);

export const shortAddr = (addr: string | null) => {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};
