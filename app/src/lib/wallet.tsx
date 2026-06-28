import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
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
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
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
  connect: (walletName?: string) => Promise<void>;
  connectDemoWallet: () => void;
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
  connect: async () => {},
  connectDemoWallet: () => {},
  disconnect: () => {},
  setRole: () => {},
  setNetwork: () => {},
};

const KilnWalletContext = createContext<KilnWalletState>(defaultState);

const PREFS_KEY = "kiln.wallet.prefs";

interface StoredWalletPrefs {
  role?: Role;
  network?: Network;
  walletName?: string | null;
}

function KilnWalletInner({ children }: { children: ReactNode }) {
  const {
    connected,
    publicKey,
    wallet,
    wallets,
    select,
    disconnect: solDisconnect,
  } = useSolanaWallet();
  const { connection } = useConnection();
  const [demoWalletName, setDemoWalletName] = useState<string | null>(null);
  const autoConnectAttemptRef = useRef<string | null>(null);

  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? (JSON.parse(raw) as StoredWalletPrefs) : null;
    } catch {
      return null;
    }
  }, []);

  const [role, setRole] = useState<Role>(stored?.role ?? "investor");
  const [network, setNetworkState] = useState<Network>("devnet");
  const [rememberedWalletName, setRememberedWalletName] = useState<string | null>(stored?.walletName ?? null);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ role, network, walletName: rememberedWalletName }));
  }, [rememberedWalletName, role, network]);

  const setNetwork = useCallback((next: Network) => {
    setNetworkState(next === "devnet" ? "devnet" : "devnet");
  }, []);

  useEffect(() => {
    if (connected || wallet || demoWalletName || !rememberedWalletName) return;
    const remembered = wallets.find((entry) => entry.adapter.name === rememberedWalletName);
    if (remembered) {
      select(remembered.adapter.name as WalletName);
    }
  }, [connected, demoWalletName, rememberedWalletName, select, wallet, wallets]);

  useEffect(() => {
    if (connected || demoWalletName || !wallet || !rememberedWalletName) return;
    if (wallet.adapter.name !== rememberedWalletName) return;
    if (autoConnectAttemptRef.current === rememberedWalletName) return;

    autoConnectAttemptRef.current = rememberedWalletName;
    wallet.adapter.connect().catch(() => {
      // Wallet may require a manual approval after refresh. The connect modal remains the fallback.
    });
  }, [connected, demoWalletName, rememberedWalletName, wallet]);

  useEffect(() => {
    if (wallet?.adapter.name) {
      setRememberedWalletName(wallet.adapter.name);
    }
  }, [wallet?.adapter.name]);

  const demoAddress = "Dnaz9wQvYpyh1LqL7AxnSmpuPjZLk6xrKfB3cXvjCXVj";
  const isConnected = connected || Boolean(demoWalletName);
  const address = publicKey?.toBase58() ?? (demoWalletName ? demoAddress : null);

  const connect = useCallback(
    async (name?: string) => {
      if (!name) {
        throw new Error("Choose Phantom or Solflare to connect on devnet.");
      }

      const target = wallets.find((entry) => entry.adapter.name === name);
      if (!target) {
        throw new Error(`${name} is not available in this browser.`);
      }

      const isReady =
        target.readyState === WalletReadyState.Installed ||
        target.readyState === WalletReadyState.Loadable ||
        target.readyState === WalletReadyState.NotDetected;
      if (!isReady) {
        throw new Error(`${name} is not available in this browser. Install it from ${name === "Solflare" ? "solflare.com" : "phantom.app"}, then refresh the page.`);
      }

      setDemoWalletName(null);
      setNetwork("devnet");
      setRememberedWalletName(target.adapter.name);
      autoConnectAttemptRef.current = null;
      select(target.adapter.name as WalletName);

      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await target.adapter.connect();
    },
    [select, setNetwork, wallets]
  );

  const connectDemoWallet = useCallback(() => {
    setDemoWalletName("Recording Wallet");
    setRememberedWalletName(null);
    setNetwork("devnet");
  }, [setNetwork]);

  const value: KilnWalletState = useMemo(
    () => ({
      connected: isConnected,
      address,
      publicKey: publicKey ?? null,
      role,
      network,
      walletName: wallet?.adapter.name ?? demoWalletName,
      connection,
      connect,
      connectDemoWallet,
      disconnect: () => {
        setDemoWalletName(null);
        setRememberedWalletName(null);
        autoConnectAttemptRef.current = null;
        solDisconnect();
      },
      setRole,
      setNetwork,
    }),
    [
      isConnected,
      address,
      publicKey,
      role,
      network,
      wallet,
      demoWalletName,
      connection,
      connect,
      connectDemoWallet,
      solDisconnect,
      setNetwork,
    ]
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
