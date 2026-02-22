import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AppSettings } from "@shared/schema";

export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Omit<AppSettings, "id">>) => {
      await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin Console | Timeline Studio</title>
      </Helmet>
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/")}
            data-testid="button-admin-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold">Admin Console</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Feature Toggles
          </h2>
          <p className="text-sm text-muted-foreground">
            Enable or disable optional features across the application.
          </p>
        </div>

        {isLoading ? (
          <Card className="p-5">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium" data-testid="text-risk-register-label">Risk Register</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable the risk register feature on all timelines. When enabled, each timeline will have a Risk Register tab for tracking project risks, their probability, impact, and mitigation strategies.
                  </p>
                </div>
                <Switch
                  checked={settings?.riskRegisterEnabled ?? false}
                  onCheckedChange={(checked) =>
                    updateMutation.mutate({ riskRegisterEnabled: checked })
                  }
                  disabled={updateMutation.isPending}
                  data-testid="switch-risk-register"
                />
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
