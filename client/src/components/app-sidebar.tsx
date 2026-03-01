import { LayoutDashboard, FolderKanban, Settings, Building2, Users, UserCheck, CalendarRange, Clock, LogOut, Info, Bot, Target, Shield, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { useBranding } from "@/components/branding-provider";
import { useAuth } from "@/hooks/use-auth";
import type { AppSettings } from "@shared/schema";

type MyModulesResponse = {
  modules: string[];
  isGlobalAccess: boolean;
  teamMemberId: string | null;
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

  const modules = new Set(myModules?.modules ?? []);
  const hasModule = (mod: string) => modules.has(`module.${mod}`);

  const opportunitiesEnabled = settings?.opportunitiesEnabled !== false;

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const appName = branding?.appName || "FlightPath";

  const coreItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: true },
    { title: "FlightPath Coach", url: "/chat", icon: Bot, visible: hasModule("coach") },
    { title: "Opportunities", url: "/opportunities", icon: Target, visible: hasModule("opportunities") && opportunitiesEnabled },
  ].filter(i => i.visible);

  const workItems = [
    { title: "Projects", url: "/projects", icon: FolderKanban, visible: hasModule("projects") },
    { title: "Clients", url: "/clients", icon: Building2, visible: hasModule("clients") },
    { title: "Contacts", url: "/contacts", icon: Users, visible: hasModule("contacts") },
  ].filter(i => i.visible);

  const resourceItems = [
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
        {renderNavGroup("Core", coreItems)}
        {renderNavGroup("Workspace", workItems)}
        {renderNavGroup("Resources", resourceItems)}

        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/about")}
                  className="h-8 px-3 gap-2.5 text-[13px] font-medium rounded-md"
                  data-testid="nav-about"
                >
                  <Link href="/about">
                    <Info className="w-4 h-4 shrink-0" />
                    <span className="truncate">About</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin && (
          <SidebarGroup className="py-1">
            <Collapsible defaultOpen={location.startsWith("/admin")}>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                <CollapsibleTrigger className="flex items-center gap-1 w-full" data-testid="nav-admin-toggle">
                  Admin
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
