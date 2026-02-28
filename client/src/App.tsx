import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingProvider } from "@/components/branding-provider";
import { HelmetProvider } from "react-helmet-async";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Home from "@/pages/home";
import CreateTimeline from "@/pages/create-timeline";
import TimelineDetail from "@/pages/timeline-detail";
import Admin from "@/pages/admin";
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
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Home} />
      <Route path="/create" component={CreateTimeline} />
      <Route path="/timeline/:id" component={TimelineDetail} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/contacts" component={ContactsList} />
      <Route path="/team-members/:id" component={TeamMemberDetail} />
      <Route path="/team-members" component={TeamMembersList} />
      <Route path="/allocations" component={AllocationsPage} />
      <Route path="/timesheets" component={TimesheetsPage} />
      <Route path="/opportunities" component={OpportunitiesPage} />
      <Route path="/opportunities/:id" component={OpportunityDetail} />
      <Route path="/about" component={AboutPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function AuthenticatedApp() {
  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
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
