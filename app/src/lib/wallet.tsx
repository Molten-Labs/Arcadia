import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { WalletName } from "@solana/wallet-adapter-base";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "./solana/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export type Role = "investor" | "trader";
export type Network = "devnet";

interface KilnWalletState {
  connected: boolean;
  address: string | null;
  publicKey: PublicKey | null;
  role: Role;
  network: Network;
  walletName: string | null;
  connection: Connection | null;
  connect: (walletName?: string) => void;
  disconnect: () => void;
  setRole: (r: Role) => void;
  setNetwork: (n: Network) => void;
}

const defaultState: KilnWalletState = {
  connected: false,
  address: null,
  publicKey: null,
  role: "investor",
  network: "devnet",
  walletName: null,
  connection: null,
  connect: () => {},
  disconnect: () => {},
  setRole: () => {},
  setNetwork: () => {},
};

const KilnWalletContext = createContext<KilnWalletState>(defaultState);

const PREFS_KEY = "kiln.wallet.prefs";

function KilnWalletInner({ children }: { children: ReactNode }) {
  const {
    connected,
    publicKey,
    wallet,
    disconnect: solDisconnect,
    select,
    connect: solConnect,
  } = useSolanaWallet();
  const { connection } = useConnection();
  const [demoWalletName, setDemoWalletName] = useState<string | null>(null);
  const [pendingConnect, setPendingConnect] = useState(false);

  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [role, setRole] = useState<Role>(stored?.role ?? "investor");

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ role }));
  }, [role]);

  // After select() updates the wallet state, trigger the real connect()
  useEffect(() => {
    if (pendingConnect && wallet && !connected) {
      setPendingConnect(false);
      solConnect().catch(() => {
        // User cancelled or wallet not available — silent, ConnectModal handles UI
      });
    }
  }, [pendingConnect, wallet, connected, solConnect]);

  const demoAddress = "Dnaz9wQvYpyh1LqL7AxnSmpuPjZLk6xrKfB3cXvjCXVj";
  const isConnected = connected || Boolean(demoWalletName);
  const address = publicKey?.toBase58() ?? (demoWalletName ? demoAddress : null);

  const value: KilnWalletState = useMemo(
    () => ({
      connected: isConnected,
      address,
      publicKey: publicKey ?? null,
      role,
      network: "devnet",
      walletName: wallet?.adapter.name ?? demoWalletName,
      connection,
      connect: (name?: string) => {
        if (!name || name === "Demo Wallet") {
          setDemoWalletName(name ?? "Demo Wallet");
          return;
        }
        setDemoWalletName(null);
        select(name as WalletName);
        setPendingConnect(true);
      },
      disconnect: () => {
        setDemoWalletName(null);
        solDisconnect();
      },
      setRole,
      setNetwork: () => {},
    }),
    [isConnected, address, publicKey, role, wallet, demoWalletName, connection, solDisconnect, select]
  );

  return (
    <KilnWalletContext.Provider value={value}>
      {children}
    </KilnWalletContext.Provider>
  );
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <KilnWalletInner>{children}</KilnWalletInner>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export const useWallet = () => useContext(KilnWalletContext);

export const shortAddr = (addr: string | null) => {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};

export { WalletMultiButton };
