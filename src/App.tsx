import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AdminDataProvider } from "./contexts/AdminDataContext";
import { AuthProvider, useAuth, type AccountType } from "./contexts/AuthContext";
import InvoicesPayments from "./pages/InvoicesPayments";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import MarketIntelligence from "./pages/MarketIntelligence";
import MarketIntelligenceCompanyProfile from "./pages/MarketIntelligenceCompanyProfile";
import MyCompany from "./pages/MyCompany";
import NotFound from "./pages/NotFound";
import OrdersShipments from "./pages/OrdersShipments";
import UploadCenter from "./pages/UploadCenter";
import BackOfficeLogin from "./pages/BackOfficeLogin";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDataManagement from "./pages/admin/AdminDataManagement";
import AdminUsers from "./pages/admin/AdminUsers";

const queryClient = new QueryClient();

function HomeRedirect() {
  const { isAuthenticated, accountType } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (accountType === "backoffice") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/market-intelligence" replace />;
}

function PublicOnly({ children }: { children: ReactElement }) {
  const { isAuthenticated, accountType } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  return accountType === "backoffice"
    ? <Navigate to="/admin" replace />
    : <Navigate to="/market-intelligence" replace />;
}

function ProtectedLayout({ allowedAccountType }: { allowedAccountType: AccountType }) {
  const { isAuthenticated, accountType } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={allowedAccountType === "backoffice" ? "/backoffice/login" : "/login"} replace />;
  }

  if (accountType !== allowedAccountType) {
    return <Navigate to={accountType === "backoffice" ? "/admin" : "/market-intelligence"} replace />;
  }

  return <AppLayout />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminDataProvider>
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route
                path="/login"
                element={(
                  <PublicOnly>
                    <Login />
                  </PublicOnly>
                )}
              />
              <Route
                path="/backoffice/login"
                element={(
                  <PublicOnly>
                    <BackOfficeLogin />
                  </PublicOnly>
                )}
              />

              <Route element={<ProtectedLayout allowedAccountType="customer" />}>
                <Route path="/market-intelligence" element={<MarketIntelligence />} />
                <Route path="/market-intelligence/company/:companyId" element={<MarketIntelligenceCompanyProfile />} />
                <Route path="/my-company" element={<Navigate to="/my-company/performance" replace />} />
                <Route path="/my-company/orders" element={<OrdersShipments />} />
                <Route path="/my-company/invoices" element={<InvoicesPayments />} />
                <Route path="/my-company/inventory" element={<Inventory />} />
                <Route path="/my-company/performance" element={<MyCompany />} />
                <Route path="/upload" element={<UploadCenter />} />
              </Route>

              <Route element={<ProtectedLayout allowedAccountType="backoffice" />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/customers" element={<AdminCustomers />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/data" element={<AdminDataManagement />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AdminDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
