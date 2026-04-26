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
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "./solana/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export type Role = "investor" | "trader";
export type Network = "mainnet" | "devnet";

interface KilnWalletState {
  connected: boolean;
  address: string | null;
  publicKey: PublicKey | null;
  role: Role;
  network: Network;
  walletName: string | null;
  connection: Connection | null;
  connect: () => void;
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
  const { connected, publicKey, wallet, disconnect: solDisconnect, select } = useSolanaWallet();
  const { connection } = useConnection();

  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [role, setRole] = useState<Role>(stored?.role ?? "investor");
  const [network, setNetwork] = useState<Network>(stored?.network ?? "devnet");

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ role, network }));
  }, [role, network]);

  const address = publicKey?.toBase58() ?? null;

  const value: KilnWalletState = useMemo(
    () => ({
      connected,
      address,
      publicKey: publicKey ?? null,
      role,
      network,
      walletName: wallet?.adapter.name ?? null,
      connection,
      connect: () => {
        /* Wallet modal handles this via WalletMultiButton */
      },
      disconnect: () => {
        solDisconnect();
      },
      setRole,
      setNetwork,
    }),
    [connected, address, publicKey, role, network, wallet, connection, solDisconnect]
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
