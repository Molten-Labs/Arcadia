import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";
import { ThemeProvider } from "@/lib/theme";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleSwitchHint } from "./components/RoleSwitchHint";
import { RealtimeProvider } from "./hooks/useRealtime";
import { DemoRunner } from "./components/DemoRunner";

// Index loads eagerly so the landing page is instant — no loading screen
import Index from "./pages/Index";

const Vaults         = lazy(() => import("./pages/Vaults.tsx"));
const VaultDetail    = lazy(() => import("./pages/VaultDetail.tsx"));
const Traders        = lazy(() => import("./pages/Traders.tsx"));
const TraderProfile  = lazy(() => import("./pages/TraderProfile.tsx"));
const Portfolio      = lazy(() => import("./pages/Portfolio.tsx"));
const Settings       = lazy(() => import("./pages/Settings.tsx"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard.tsx"));
const ManagerVault   = lazy(() => import("./pages/ManagerVault.tsx"));
const CreateVault    = lazy(() => import("./pages/CreateVault.tsx"));
const Trade          = lazy(() => import("./pages/Trade.tsx"));
const HowItWorks     = lazy(() => import("./pages/HowItWorks.tsx"));
const Docs           = lazy(() => import("./pages/Docs.tsx"));
const FAQ            = lazy(() => import("./pages/FAQ.tsx"));
const DemoControl    = lazy(() => import("./pages/DemoControl.tsx"));
const NotFound       = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

// Invisible fallback — no flash of "Loading route..." text
const RouteFallback = () => (
    <div className="min-h-screen bg-background" />
);

const App = () => (
    <AppErrorBoundary>
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <WalletProvider>
                    <RealtimeProvider>
                        <TooltipProvider>
                            <Toaster />
                            <Sonner />
                            <BrowserRouter>
                                <RoleSwitchHint />
                                <DemoRunner />
                                <Suspense fallback={<RouteFallback />}>
                                    <Routes>
                                    <Route path="/" element={<Index />} />
                                    <Route path="/vaults" element={<Vaults />} />
                                    <Route path="/vault/:id" element={<VaultDetail />} />
                                    <Route path="/traders" element={<Traders />} />
                                    <Route path="/trader/:wallet" element={<TraderProfile />} />
                                    <Route
                                        path="/portfolio"
                                        element={
                                            <ProtectedRoute allowedRoles={["investor"]} requireConnection={false} mode="redirect">
                                                <Portfolio />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/settings"
                                        element={
                                            <ProtectedRoute>
                                                <Settings />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/manager"
                                        element={
                                            <ProtectedRoute allowedRoles={["trader"]} requireConnection={false} mode="redirect">
                                                <ManagerDashboard />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/manager/create"
                                        element={
                                            <ProtectedRoute allowedRoles={["trader"]} requireConnection={false} mode="redirect">
                                                <CreateVault />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/manager/vault/:id"
                                        element={
                                            <ProtectedRoute allowedRoles={["trader"]} requireConnection={false} mode="redirect">
                                                <ManagerVault />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/trade"
                                        element={
                                            <ProtectedRoute allowedRoles={["trader"]} requireConnection={false} mode="redirect">
                                                <Trade />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route path="/how-it-works" element={<HowItWorks />} />
                                    <Route path="/docs" element={<Docs />} />
                                    <Route path="/faq" element={<FAQ />} />
                                    <Route path="/demo-control" element={<DemoControl />} />
                                    <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </Suspense>
                            </BrowserRouter>
                        </TooltipProvider>
                    </RealtimeProvider>
                </WalletProvider>
            </QueryClientProvider>
        </ThemeProvider>
    </AppErrorBoundary>
);

export default App;
