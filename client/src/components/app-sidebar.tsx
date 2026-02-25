import { LayoutDashboard, FolderKanban, Settings, Building2, Users, UserCheck, CalendarRange } from "lucide-react";
import { Link, useLocation } from "wouter";
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBranding } from "@/components/branding-provider";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Team Members", url: "/team-members", icon: UserCheck },
  { title: "Allocations", url: "/allocations", icon: CalendarRange },
  { title: "Settings", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { branding } = useBranding();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const appName = branding?.appName || "Project High Level Planning";

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={appName}
              className="h-8 w-8 rounded object-contain shrink-0"
              data-testid="img-sidebar-logo"
            />
          )}
          <h2 className="text-sm font-semibold tracking-tight text-sidebar-foreground" data-testid="text-app-name">
            {appName}
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
