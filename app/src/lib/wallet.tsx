import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";

export type Role = "investor" | "trader";
export type Network = "mainnet" | "devnet";

interface WalletState {
    connected: boolean;
    address: string | null;
    role: Role;
    network: Network;
    walletName: string | null;
    connect: (walletName?: string) => Promise<void>;
    disconnect: () => void;
    setRole: (r: Role) => void;
    setNetwork: (n: Network) => void;
}

const defaultState: WalletState = {
    connected: false,
    address: null,
    role: "investor",
    network: "mainnet",
    walletName: null,
    connect: async () => {},
    disconnect: () => {},
    setRole: () => {},
    setNetwork: () => {},
};

const WalletContext = createContext<WalletState>(defaultState);

const WALLET_SESSION_KEY = "kiln.demoWallet.session";

type StoredWalletSession = Pick<
    WalletState,
    "connected" | "address" | "role" | "network" | "walletName"
>;

const demoWalletAddresses: Record<string, string> = {
    Phantom: "8FpA9z3kQrLmN7vBcXdYuT2hJ5wK3xQ",
    Solflare: "6nLk2pR8sVbQ4yMzFhD9xAcE7tWjP1",
    Backpack: "4bYx7cTqN3vR9mLpH2sK8eDzUaWfG5",
    "Demo Wallet": "9DemoVaULt7Session3Kiln8Wallet2",
};

const getStoredSession = (): StoredWalletSession | null => {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.localStorage.getItem(WALLET_SESSION_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<StoredWalletSession>;
        if (!parsed.connected || !parsed.address) return null;

        return {
            connected: true,
            address: parsed.address,
            role: parsed.role === "trader" ? "trader" : "investor",
            network: parsed.network === "devnet" ? "devnet" : "mainnet",
            walletName: parsed.walletName ?? "Demo Wallet",
        };
    } catch {
        window.localStorage.removeItem(WALLET_SESSION_KEY);
        return null;
    }
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const storedSession = getStoredSession();
    const [connected, setConnected] = useState(
        storedSession?.connected ?? false,
    );
    const [address, setAddress] = useState<string | null>(
        storedSession?.address ?? null,
    );
    const [role, setRole] = useState<Role>(storedSession?.role ?? "investor");
    const [network, setNetwork] = useState<Network>(
        storedSession?.network ?? "mainnet",
    );
    const [walletName, setWalletName] = useState<string | null>(
        storedSession?.walletName ?? null,
    );

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!connected || !address) {
            window.localStorage.removeItem(WALLET_SESSION_KEY);
            return;
        }

        window.localStorage.setItem(
            WALLET_SESSION_KEY,
            JSON.stringify({
                connected,
                address,
                role,
                network,
                walletName,
            } satisfies StoredWalletSession),
        );
    }, [connected, address, role, network, walletName]);

    return (
        <WalletContext.Provider
            value={{
                connected,
                address,
                role,
                network,
                walletName,
                connect: async (name = "Demo Wallet") => {
                    // Deterministic demo connection: no random failures, stable address per wallet.
                    await new Promise((r) => setTimeout(r, 450));
                    setConnected(true);
                    setAddress(
                        demoWalletAddresses[name] ??
                            demoWalletAddresses["Demo Wallet"],
                    );
                    setWalletName(name);
                },
                disconnect: () => {
                    setConnected(false);
                    setAddress(null);
                    setWalletName(null);
                    if (typeof window !== "undefined") {
                        window.localStorage.removeItem(WALLET_SESSION_KEY);
                    }
                },
                setRole,
                setNetwork,
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
