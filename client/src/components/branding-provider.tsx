import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BrandingConfig } from "@shared/schema";

interface BrandingContextValue {
  branding: BrandingConfig | null;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isLoading: true,
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: branding, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/branding"],
  });

  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;

    if (branding.primaryColor) {
      root.style.setProperty("--primary", branding.primaryColor);
    } else {
      root.style.removeProperty("--primary");
    }

    if (branding.sidebarColor) {
      root.style.setProperty("--sidebar", branding.sidebarColor);
    } else {
      root.style.removeProperty("--sidebar");
    }

    if (branding.sidebarForegroundColor) {
      root.style.setProperty("--sidebar-foreground", branding.sidebarForegroundColor);
    } else {
      root.style.removeProperty("--sidebar-foreground");
    }

    if (branding.sidebarAccentColor) {
      root.style.setProperty("--sidebar-accent", branding.sidebarAccentColor);
    } else {
      root.style.removeProperty("--sidebar-accent");
    }

    if (branding.accentColor) {
      root.style.setProperty("--accent", branding.accentColor);
    } else {
      root.style.removeProperty("--accent");
    }

    if (branding.appName) {
      document.title = branding.appName;
    }

    if (branding.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    }

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--sidebar");
      root.style.removeProperty("--sidebar-foreground");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--accent");
    };
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding: branding ?? null, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
}
