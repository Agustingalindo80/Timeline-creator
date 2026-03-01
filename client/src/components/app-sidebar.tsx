import { LayoutDashboard, FolderKanban, Settings, Building2, Users, UserCheck, CalendarRange, Clock, LogOut, Info, Bot, Target } from "lucide-react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBranding } from "@/components/branding-provider";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import type { AppSettings } from "@shared/schema";

const coreNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "FlightPath Coach", url: "/chat", icon: Bot },
];

const opportunitiesNavItem = { title: "Opportunities", url: "/opportunities", icon: Target };

const workNavItems = [
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Contacts", url: "/contacts", icon: Users },
];

const resourceNavItems = [
  { title: "Team Members", url: "/team-members", icon: UserCheck },
  { title: "Allocations", url: "/allocations", icon: CalendarRange },
  { title: "Timesheets", url: "/timesheets", icon: Clock },
];

const systemNavItems = [
  { title: "About", url: "/about", icon: Info },
  { title: "Settings", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { branding } = useBranding();
  const { user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { hasPermission } = usePermissions();

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const opportunitiesEnabled = settings?.opportunitiesEnabled !== false;

  const filteredSystemNavItems = systemNavItems.filter((item) => {
    if (item.title === "Settings") {
      return hasPermission("org.settings.manage");
    }
    return true;
  });

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const appName = branding?.appName || "FlightPath";

  const renderNavGroup = (label: string, items: typeof coreNavItems) => (
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

  const coreItems = [
    ...coreNavItems,
    ...(opportunitiesEnabled ? [opportunitiesNavItem] : []),
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
        {renderNavGroup("Workspace", workNavItems)}
        {renderNavGroup("Resources", resourceNavItems)}
        {filteredSystemNavItems.length > 0 && renderNavGroup("System", filteredSystemNavItems)}
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
