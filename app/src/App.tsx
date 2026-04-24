import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";
import Index from "./pages/Index.tsx";
import Vaults from "./pages/Vaults.tsx";
import VaultDetail from "./pages/VaultDetail.tsx";
import Traders from "./pages/Traders.tsx";
import TraderProfile from "./pages/TraderProfile.tsx";
import Portfolio from "./pages/Portfolio.tsx";
import Alerts from "./pages/Alerts.tsx";
import Settings from "./pages/Settings.tsx";
import ManagerDashboard from "./pages/ManagerDashboard.tsx";
import ManagerVault from "./pages/ManagerVault.tsx";
import CreateVault from "./pages/CreateVault.tsx";
import Trade from "./pages/Trade.tsx";
import HowItWorks from "./pages/HowItWorks.tsx";
import Docs from "./pages/Docs.tsx";
import FAQ from "./pages/FAQ.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <WalletProvider>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/vaults" element={<Vaults />} />
                        <Route path="/vault/:id" element={<VaultDetail />} />
                        <Route path="/traders" element={<Traders />} />
                        <Route
                            path="/trader/:wallet"
                            element={<TraderProfile />}
                        />
                        <Route path="/portfolio" element={<Portfolio />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/manager" element={<ManagerDashboard />} />
                        <Route
                            path="/manager/create"
                            element={<CreateVault />}
                        />
                        <Route
                            path="/manager/vault/:id"
                            element={<ManagerVault />}
                        />
                        <Route path="/trade" element={<Trade />} />
                        <Route path="/how-it-works" element={<HowItWorks />} />
                        <Route path="/docs" element={<Docs />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
            </TooltipProvider>
        </WalletProvider>
    </QueryClientProvider>
);

export default App;
