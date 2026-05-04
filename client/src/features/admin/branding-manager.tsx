import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, RotateCcw, Save, Paintbrush, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { BrandingConfig } from "@shared/schema";

export function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length < 3) return "#888888";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${h.toFixed(2)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

interface ColorFieldProps {
  label: string;
  description: string;
  value: string | null;
  defaultValue: string;
  onChange: (hsl: string | null) => void;
  testId: string;
}

export function ColorField({ label, description, value, defaultValue, onChange, testId }: ColorFieldProps) {
  const hexValue = hslToHex(value || defaultValue);

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-border"
          style={{ backgroundColor: `hsl(${value || defaultValue})` }}
        />
        <input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-10 h-8 cursor-pointer border-0 p-0 bg-transparent"
          data-testid={testId}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(null)}
            data-testid={`${testId}-reset`}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BrandingManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/branding"],
  });

  const [appName, setAppName] = useState("");
  const [pendingColors, setPendingColors] = useState<Record<string, string | null>>({});
  const [hasNameChange, setHasNameChange] = useState(false);

  useEffect(() => {
    if (branding) {
      setAppName(branding.appName);
      setHasNameChange(false);
    }
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BrandingConfig>) => {
      await apiRequest("PATCH", "/api/branding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      setPendingColors({});
      setHasNameChange(false);
      toast({ title: "Branding updated" });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branding/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Logo uploaded" });
    },
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branding/favicon", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Favicon uploaded" });
    },
  });

  const handleColorChange = useCallback((key: string, value: string | null) => {
    setPendingColors((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getColorValue = (key: string): string | null => {
    if (key in pendingColors) return pendingColors[key];
    if (!branding) return null;
    const value = (branding as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  };

  const hasPendingChanges = hasNameChange || Object.keys(pendingColors).length > 0;

  const saveChanges = () => {
    const updates: Partial<BrandingConfig> = {};
    if (hasNameChange) updates.appName = appName;
    for (const [key, val] of Object.entries(pendingColors)) {
      (updates as Record<string, string | null>)[key] = val;
    }
    updateMutation.mutate(updates);
  };

  const handleResetAll = () => {
    updateMutation.mutate({
      appName: "Project High Level Planning",
      primaryColor: null,
      sidebarColor: null,
      sidebarForegroundColor: null,
      sidebarAccentColor: null,
      accentColor: null,
      logoUrl: null,
      faviconUrl: null,
    });
  };

  const handleRemoveLogo = () => {
    updateMutation.mutate({ logoUrl: null });
  };

  const handleRemoveFavicon = () => {
    updateMutation.mutate({ faviconUrl: null });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const colorFields = [
    {
      key: "primaryColor",
      label: "Primary Color",
      description: "Main accent color for buttons, links, and active states.",
      default: "342 85.11% 52.55%",
      testId: "color-primary",
    },
    {
      key: "sidebarColor",
      label: "Sidebar Background",
      description: "Background color of the sidebar navigation.",
      default: "45 25% 97%",
      testId: "color-sidebar",
    },
    {
      key: "sidebarForegroundColor",
      label: "Sidebar Text",
      description: "Text and icon color in the sidebar.",
      default: "20 14% 17%",
      testId: "color-sidebar-foreground",
    },
    {
      key: "sidebarAccentColor",
      label: "Sidebar Active Item",
      description: "Highlight color for the active navigation item.",
      default: "25 45% 80%",
      testId: "color-sidebar-accent",
    },
    {
      key: "accentColor",
      label: "Accent Color",
      description: "Secondary accent color for UI elements.",
      default: "0 0% 100%",
      testId: "color-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Paintbrush className="w-4 h-4" />
          Branding & Appearance
        </h2>
        <p className="text-sm text-muted-foreground">
          Customize the application name, logo, and color scheme to match your company branding.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Application Name</h3>
        <div className="flex gap-3">
          <Input
            value={appName}
            onChange={(e) => {
              setAppName(e.target.value);
              setHasNameChange(e.target.value !== branding?.appName);
            }}
            placeholder="Application Name"
            className="flex-1"
            data-testid="input-app-name"
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Logo</h3>
        <div className="flex items-start gap-4">
          {branding?.logoUrl ? (
            <div className="relative group">
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-16 w-16 rounded object-contain border border-border bg-white"
                data-testid="img-branding-logo"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveLogo}
                data-testid="button-remove-logo"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">
              Upload a logo image (PNG, JPG, SVG). Recommended size: 128x128px or larger.
            </p>
            <input
              type="file"
              ref={logoInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogoMutation.mutate(file);
              }}
              data-testid="input-logo-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadLogoMutation.isPending}
              data-testid="button-upload-logo"
            >
              <Upload className="w-3 h-3 mr-1" />
              {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Favicon</h3>
        <div className="flex items-start gap-4">
          {branding?.faviconUrl ? (
            <div className="relative group">
              <img
                src={branding.faviconUrl}
                alt="Favicon"
                className="h-8 w-8 rounded object-contain border border-border bg-white"
                data-testid="img-branding-favicon"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveFavicon}
                data-testid="button-remove-favicon"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="h-8 w-8 rounded border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">
              Upload a favicon (ICO, PNG). Recommended size: 32x32px.
            </p>
            <input
              type="file"
              ref={faviconInputRef}
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFaviconMutation.mutate(file);
              }}
              data-testid="input-favicon-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => faviconInputRef.current?.click()}
              disabled={uploadFaviconMutation.isPending}
              data-testid="button-upload-favicon"
            >
              <Upload className="w-3 h-3 mr-1" />
              {uploadFaviconMutation.isPending ? "Uploading..." : "Upload Favicon"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Colors</h3>
        <div className="space-y-4">
          {colorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              description={field.description}
              value={getColorValue(field.key)}
              defaultValue={field.default}
              onChange={(val) => handleColorChange(field.key, val)}
              testId={field.testId}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Preview</h3>
        <div className="flex gap-4">
          <div
            className="w-48 rounded-lg border border-border overflow-hidden"
            style={{
              backgroundColor: `hsl(${getColorValue("sidebarColor") || "45 25% 97%"})`,
              color: `hsl(${getColorValue("sidebarForegroundColor") || "20 14% 17%"})`,
            }}
          >
            <div className="px-3 py-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                {branding?.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
                )}
                <span className="text-xs font-semibold truncate">{appName || "App Name"}</span>
              </div>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              <div
                className="px-2 py-1.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `hsl(${getColorValue("sidebarAccentColor") || "25 45% 80%"})`,
                }}
              >
                Dashboard
              </div>
              <div className="px-2 py-1.5 rounded text-xs opacity-70">
                Projects
              </div>
              <div className="px-2 py-1.5 rounded text-xs opacity-70">
                Settings
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: `hsl(${getColorValue("primaryColor") || "342 85.11% 52.55%"})` }}
              >
                Primary Button
              </div>
              <div
                className="px-3 py-1.5 rounded text-xs font-medium border"
                style={{
                  backgroundColor: `hsl(${getColorValue("accentColor") || "0 0% 100%"})`,
                  borderColor: `hsl(${getColorValue("accentColor") || "0 0% 100%"} / 0.3)`,
                }}
              >
                Accent Element
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This preview shows how your branding colors will appear across the application.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={saveChanges}
          disabled={!hasPendingChanges || updateMutation.isPending}
          data-testid="button-save-branding"
        >
          <Save className="w-4 h-4 mr-1" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" data-testid="button-reset-branding">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Branding</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all branding settings to their defaults, including the app name, logo, favicon, and all colors.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAll}>Reset All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
