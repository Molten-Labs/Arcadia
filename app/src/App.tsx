import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index.tsx"));
const Vaults = lazy(() => import("./pages/Vaults.tsx"));
const VaultDetail = lazy(() => import("./pages/VaultDetail.tsx"));
const Traders = lazy(() => import("./pages/Traders.tsx"));
const TraderProfile = lazy(() => import("./pages/TraderProfile.tsx"));
const Portfolio = lazy(() => import("./pages/Portfolio.tsx"));
const Alerts = lazy(() => import("./pages/Alerts.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard.tsx"));
const ManagerVault = lazy(() => import("./pages/ManagerVault.tsx"));
const CreateVault = lazy(() => import("./pages/CreateVault.tsx"));
const Trade = lazy(() => import("./pages/Trade.tsx"));
const HowItWorks = lazy(() => import("./pages/HowItWorks.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
    <div className="min-h-screen bg-background">
        <div className="container py-16">
            <div className="surface rounded-lg p-8 text-center text-sm text-muted-foreground">
                Loading route…
            </div>
        </div>
    </div>
);

const App = () => (
    <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <WalletProvider>
                <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                        <Suspense fallback={<RouteFallback />}>
                            <Routes>
                                <Route path="/" element={<Index />} />
                                <Route path="/vaults" element={<Vaults />} />
                                <Route
                                    path="/vault/:id"
                                    element={<VaultDetail />}
                                />
                                <Route path="/traders" element={<Traders />} />
                                <Route
                                    path="/trader/:wallet"
                                    element={<TraderProfile />}
                                />
                                <Route
                                    path="/portfolio"
                                    element={
                                        <ProtectedRoute allowedRoles={["investor"]} requireConnection={false}>
                                            <Portfolio />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/alerts"
                                    element={
                                        <ProtectedRoute>
                                            <Alerts />
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
                                        <ProtectedRoute allowedRoles={["trader"]} requireConnection={false}>
                                            <ManagerDashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/manager/create"
                                    element={
                                        <ProtectedRoute allowedRoles={["trader"]} requireConnection={false}>
                                            <CreateVault />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/manager/vault/:id"
                                    element={
                                        <ProtectedRoute allowedRoles={["trader"]} requireConnection={false}>
                                            <ManagerVault />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/trade"
                                    element={
                                        <ProtectedRoute allowedRoles={["trader"]} requireConnection={false}>
                                            <Trade />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/how-it-works"
                                    element={<HowItWorks />}
                                />
                                <Route path="/docs" element={<Docs />} />
                                <Route path="/faq" element={<FAQ />} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </BrowserRouter>
                </TooltipProvider>
            </WalletProvider>
        </QueryClientProvider>
    </AppErrorBoundary>
);

export default App;
