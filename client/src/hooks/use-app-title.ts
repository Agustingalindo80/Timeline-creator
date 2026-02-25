import { useBranding } from "@/components/branding-provider";

export function useAppTitle(pageTitle?: string): string {
  const { branding } = useBranding();
  const appName = branding?.appName || "Project High Level Planning";
  if (!pageTitle) return appName;
  return `${pageTitle} | ${appName}`;
}
