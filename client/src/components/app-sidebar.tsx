import { LayoutDashboard, FolderKanban, Settings, Building2, Users, UserCheck, CalendarRange, Clock, LogOut, Info, Bot, Target, Shield, ChevronRight, Globe, ChevronsUpDown, FlaskConical } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBranding } from "@/components/branding-provider";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useGovernanceLabel } from "@/hooks/use-governance-label";
import type { AppSettings } from "@shared/schema";

type MyModulesResponse = {
  modules: string[];
  isGlobalAccess: boolean;
  teamMemberId: string | null;
};

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
};

type CurrentTenantResponse = {
  tenantId: string;
  tenant: TenantInfo | null;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { branding } = useBranding();
  const { user, isAuthenticated } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: myModules } = useQuery<MyModulesResponse>({
    queryKey: ["/api/rbac/my-modules"],
    enabled: isAuthenticated,
  });

  const { data: superAdminCheck } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/global-admin/check"],
    enabled: isAuthenticated,
  });

  const { data: myTenants } = useQuery<TenantInfo[]>({
    queryKey: ["/api/tenant/my-tenants"],
    enabled: isAuthenticated,
  });

  const { data: currentTenant } = useQuery<CurrentTenantResponse>({
    queryKey: ["/api/tenant/current"],
    enabled: isAuthenticated,
  });

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("POST", "/api/tenant/switch", { tenantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const isSuperAdmin = superAdminCheck?.isSuperAdmin || false;
  const showTenantPicker = (myTenants?.length ?? 0) > 1;

  // TODO: Lock down Super Admin tenant switching before commercial launch
  const naturalTenantIds = new Set(myTenants?.map(t => t.id) ?? []);
  const isTestingTenant = isSuperAdmin && currentTenant?.tenantId &&
    !naturalTenantIds.has(currentTenant.tenantId);

  const modules = new Set(myModules?.modules ?? []);
  const hasModule = (mod: string) => modules.has(`module.${mod}`);

  const opportunitiesEnabled = settings?.opportunitiesEnabled !== false;

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const { coachLabel } = useGovernanceLabel();
  const appName = branding?.appName || "Project High Level Planning";

  const helpItems = [
    { title: coachLabel, url: "/chat", icon: Bot, visible: hasModule("coach") },
  ].filter(i => i.visible);

  const workItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: true },
    { title: "Companies", url: "/clients", icon: Building2, visible: hasModule("clients") },
    { title: "Contacts", url: "/contacts", icon: Users, visible: hasModule("contacts") },
    { title: "Opportunities", url: "/opportunities", icon: Target, visible: hasModule("opportunities") && opportunitiesEnabled },
    { title: "Projects", url: "/projects", icon: FolderKanban, visible: hasModule("projects") },
  ].filter(i => i.visible);

  const operationsItems = [
    { title: "Team Members", url: "/team-members", icon: UserCheck, visible: hasModule("team_members") },
    { title: "Allocations", url: "/allocations", icon: CalendarRange, visible: hasModule("allocations") },
    { title: "Timesheets", url: "/timesheets", icon: Clock, visible: hasModule("timesheets") },
  ].filter(i => i.visible);

  const showAdmin = hasModule("admin");

  const renderNavGroup = (label: string, items: { title: string; url: string; icon: any }[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup className="py-1">
        <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  className="h-8 px-3 gap-2.5 text-[13px] font-medium rounded-md"
                  data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Link href={item.url}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const adminItems = [
    { title: "Settings", url: "/admin/settings", icon: Settings },
    { title: "Security", url: "/admin/security", icon: Shield },
    { title: "About", url: "/about", icon: Info },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={appName}
              className="h-6 w-6 rounded object-contain shrink-0"
              data-testid="img-sidebar-logo"
            />
          ) : (
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary-foreground">
                {appName[0]}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate" data-testid="text-app-name">
              {appName}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {showTenantPicker && !isCollapsed && (
          <div className="px-3 pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-[12px] font-medium rounded-md border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-foreground"
                  data-testid="tenant-switcher"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{currentTenant?.tenant?.name || "Default"}</span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                {myTenants?.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => switchTenantMutation.mutate(t.id)}
                    className={t.id === currentTenant?.tenantId ? "bg-accent" : ""}
                    data-testid={`tenant-option-${t.slug}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{t.plan}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {isTestingTenant && !isCollapsed && (
          <div className="px-3 pb-1">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400"
              data-testid="badge-testing-mode"
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>TESTING MODE</span>
            </div>
          </div>
        )}

        {renderNavGroup("Workspace", workItems)}
        {renderNavGroup("Help & Support", helpItems)}
        {renderNavGroup("Operations", operationsItems)}

        {showAdmin && (
          <SidebarGroup className="py-1">
            <Collapsible defaultOpen={location.startsWith("/admin") || location === "/about"}>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                <CollapsibleTrigger className="flex items-center gap-1 w-full" data-testid="nav-admin-toggle">
                  Administration
                  <ChevronRight className="w-3 h-3 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          className="h-8 px-3 gap-2.5 text-[13px] font-medium rounded-md"
                          data-testid={`nav-admin-${item.title.toLowerCase()}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Super Admin
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/global-admin")}
                    className="h-8 px-3 gap-2.5 text-[13px] font-medium rounded-md"
                    data-testid="nav-global-admin"
                  >
                    <Link href="/global-admin">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span className="truncate">Global Administration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <Separator className="mb-2 opacity-50" />
        {user && (
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="h-7 w-7 shrink-0">
              {user.profileImageUrl ? (
                <AvatarImage src={user.profileImageUrl} alt={user.firstName || "User"} data-testid="img-user-avatar" />
              ) : null}
              <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary" data-testid="text-user-initial">
                {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate" data-testid="text-user-name">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"}
                </p>
              </div>
            )}
            {!isCollapsed && (
              <div className="flex items-center gap-0.5">
                <ThemeToggle />
                <a
                  href="/api/logout"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground/70 transition-colors"
                  title="Log out"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
