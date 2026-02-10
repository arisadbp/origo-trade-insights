import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import MarketIntelligence from "./pages/MarketIntelligence";
import MyCompany from "./pages/MyCompany";
import OrdersShipments from "./pages/OrdersShipments";
import InvoicesPayments from "./pages/InvoicesPayments";
import UploadCenter from "./pages/UploadCenter";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/market-intelligence" replace />} />
            <Route path="/market-intelligence" element={<MarketIntelligence />} />
            <Route path="/my-company" element={<MyCompany />} />
            <Route path="/my-company/orders" element={<OrdersShipments />} />
            <Route path="/my-company/invoices" element={<InvoicesPayments />} />
            <Route path="/my-company/performance" element={<MyCompany />} />
            <Route path="/upload" element={<UploadCenter />} />
            <Route path="/admin" element={<MyCompany />} />
            <Route path="/admin/users" element={<MyCompany />} />
            <Route path="/admin/data" element={<MyCompany />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
