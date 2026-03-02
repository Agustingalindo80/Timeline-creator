import { Switch, Route, Redirect, Link, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingProvider } from "@/components/branding-provider";
import { HelmetProvider } from "react-helmet-async";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import Dashboard from "@/pages/dashboard";
import Home from "@/pages/home";
import CreateTimeline from "@/pages/create-timeline";
import TimelineDetail from "@/pages/timeline-detail";
import Admin from "@/pages/admin";
import AdminSecurity from "@/pages/admin-security";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import ContactsList from "@/pages/contacts";
import TeamMembersList from "@/pages/team-members";
import TeamMemberDetail from "@/pages/team-member-detail";
import AllocationsPage from "@/pages/allocations";
import TimesheetsPage from "@/pages/timesheets";
import AboutPage from "@/pages/about";
import ChatPage from "@/pages/chat";
import OpportunitiesPage from "@/pages/opportunities";
import OpportunityDetail from "@/pages/opportunity-detail";
import GlobalAdminPage from "@/pages/global-admin";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ requiredModule, children }: { requiredModule: string; children: ReactNode }) {
  const { data, isLoading } = useQuery<{ modules: string[]; isGlobalAccess: boolean; teamMemberId: string | null }>({
    queryKey: ["/api/rbac/my-modules"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.modules?.includes(requiredModule)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4" data-testid="access-denied">
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-col items-center gap-2">
            <ShieldX className="w-12 h-12 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-center">
              You do not have permission to access this section. Contact your administrator if you believe this is an error.
            </p>
            <Link href="/">
              <Button data-testid="link-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/global-admin/check"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4" data-testid="access-denied-superadmin">
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-col items-center gap-2">
            <ShieldX className="w-12 h-12 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-center">
              This section is restricted to super administrators only.
            </p>
            <Link href="/">
              <Button data-testid="link-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects">{() => <ProtectedRoute requiredModule="module.projects"><Home /></ProtectedRoute>}</Route>
      <Route path="/create">{() => <ProtectedRoute requiredModule="module.projects"><CreateTimeline /></ProtectedRoute>}</Route>
      <Route path="/timeline/:id">{() => <ProtectedRoute requiredModule="module.projects"><TimelineDetail /></ProtectedRoute>}</Route>
      <Route path="/clients">{() => <ProtectedRoute requiredModule="module.clients"><Clients /></ProtectedRoute>}</Route>
      <Route path="/clients/:id">{() => <ProtectedRoute requiredModule="module.clients"><ClientDetail /></ProtectedRoute>}</Route>
      <Route path="/contacts">{() => <ProtectedRoute requiredModule="module.contacts"><ContactsList /></ProtectedRoute>}</Route>
      <Route path="/team-members/:id">{() => <ProtectedRoute requiredModule="module.team_members"><TeamMemberDetail /></ProtectedRoute>}</Route>
      <Route path="/team-members">{() => <ProtectedRoute requiredModule="module.team_members"><TeamMembersList /></ProtectedRoute>}</Route>
      <Route path="/allocations">{() => <ProtectedRoute requiredModule="module.allocations"><AllocationsPage /></ProtectedRoute>}</Route>
      <Route path="/timesheets">{() => <ProtectedRoute requiredModule="module.timesheets"><TimesheetsPage /></ProtectedRoute>}</Route>
      <Route path="/opportunities">{() => <ProtectedRoute requiredModule="module.opportunities"><OpportunitiesPage /></ProtectedRoute>}</Route>
      <Route path="/opportunities/:id">{() => <ProtectedRoute requiredModule="module.opportunities"><OpportunityDetail /></ProtectedRoute>}</Route>
      <Route path="/about" component={AboutPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/admin/security">{() => <ProtectedRoute requiredModule="module.admin"><AdminSecurity /></ProtectedRoute>}</Route>
      <Route path="/admin/settings">{() => <ProtectedRoute requiredModule="module.admin"><Admin /></ProtectedRoute>}</Route>
      <Route path="/admin"><Redirect to="/admin/settings" /></Route>
      <Route path="/global-admin">{() => <SuperAdminRoute><GlobalAdminPage /></SuperAdminRoute>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function getBasePath() {
  const match = window.location.pathname.match(/^\/t\/([a-z0-9-]+)(\/|$)/);
  return match ? `/t/${match[1]}` : "";
}

function AuthenticatedApp() {
  const basePath = getBasePath();

  return (
    <Router base={basePath}>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center p-2 border-b shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </header>
            <main className="flex-1 overflow-auto">
              <AppRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </Router>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrandingProvider>
            <TooltipProvider>
              <AppContent />
              <Toaster />
            </TooltipProvider>
          </BrandingProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
