import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import { ReactNode } from "react";

import DashboardPage    from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import AlertsPage       from "@/pages/alerts";
import CasesPage        from "@/pages/cases";
import CustomersPage    from "@/pages/customers";
import ReportsPage      from "@/pages/reports";
import FundFlowPage     from "@/pages/fund-flow";
import LoginPage        from "@/pages/login";
import AdminUsersPage   from "@/pages/admin-users";
import NotFound         from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 5 * 60 * 1000 } },
});

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isLoading, session } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (adminOnly && session?.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login"><GuestRoute><LoginPage /></GuestRoute></Route>
      <Route path="/"><ProtectedRoute><DashboardPage /></ProtectedRoute></Route>
      <Route path="/transactions"><ProtectedRoute><TransactionsPage /></ProtectedRoute></Route>
      <Route path="/fund-flow"><ProtectedRoute><FundFlowPage /></ProtectedRoute></Route>
      <Route path="/alerts"><ProtectedRoute><AlertsPage /></ProtectedRoute></Route>
      <Route path="/cases"><ProtectedRoute><CasesPage /></ProtectedRoute></Route>
      <Route path="/customers"><ProtectedRoute><CustomersPage /></ProtectedRoute></Route>
      <Route path="/reports"><ProtectedRoute><ReportsPage /></ProtectedRoute></Route>
      <Route path="/admin/users"><ProtectedRoute adminOnly><AdminUsersPage /></ProtectedRoute></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
