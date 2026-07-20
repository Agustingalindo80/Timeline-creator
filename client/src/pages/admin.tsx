import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Shield, List, Compass, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import type { AppSettings, FieldOption } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { FieldOptionEditor, type TabConfig } from "@/features/admin/field-option-editor";
import { TeamMembersManager } from "@/features/admin/team-members-manager";
import { RateCardsManager } from "@/features/admin/rate-cards-manager";
import { BrandingManager } from "@/features/admin/branding-manager";
import { FlightPathManager } from "@/features/admin/flight-path-manager";
import { ApiTokensManager } from "@/features/admin/api-tokens-manager";

export default function Admin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const appTitle = useAppTitle("Settings");

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

  const handleFieldSave = (key: string, options: FieldOption[]) => {
    updateMutation.mutate({ [key]: options } as Partial<Omit<AppSettings, "id">>);
  };

  const fieldTabs: TabConfig[] = [
    {
      value: "global",
      label: "Global",
      fields: [
        {
          title: "Health",
          description: "Health indicator options shared across projects and tasks (traffic light colors).",
          key: "taskHealthOptions",
          defaults: getDefaultFieldOptions("taskHealthOptions", settings?.locale || "en"),
          current: settings?.taskHealthOptions || getDefaultFieldOptions("taskHealthOptions", settings?.locale || "en"),
          testId: "task-health",
        },
        {
          title: "Roles",
          description: "Role options for team members and rate cards (Salesforce implementation roles).",
          key: "teamMemberRoles",
          defaults: getDefaultFieldOptions("teamMemberRoles", settings?.locale || "en"),
          current: settings?.teamMemberRoles || getDefaultFieldOptions("teamMemberRoles", settings?.locale || "en"),
          testId: "team-member-roles",
        },
        {
          title: "Regions",
          description: "Region options for rate cards and projects.",
          key: "regions",
          defaults: getDefaultFieldOptions("regions", settings?.locale || "en"),
          current: settings?.regions || getDefaultFieldOptions("regions", settings?.locale || "en"),
          testId: "regions",
        },
      ],
    },
    {
      value: "projects",
      label: "Projects",
      fields: [
        {
          title: "Project Status",
          description: "Status options for projects (e.g., Not Started, In Progress, Completed).",
          key: "projectStatuses",
          defaults: getDefaultFieldOptions("projectStatuses", settings?.locale || "en"),
          current: settings?.projectStatuses || getDefaultFieldOptions("projectStatuses", settings?.locale || "en"),
          testId: "project-statuses",
        },
        {
          title: "Project Type",
          description: "Type classifications for projects (e.g., Billable, Non-Billable).",
          key: "projectTypes",
          defaults: getDefaultFieldOptions("projectTypes", settings?.locale || "en"),
          current: settings?.projectTypes || getDefaultFieldOptions("projectTypes", settings?.locale || "en"),
          testId: "project-types",
        },
        {
          title: "Engagement Model",
          description: "Engagement model options for projects (e.g., Fixed Bid, T&M, Managed Capacity).",
          key: "engagementModels",
          defaults: getDefaultFieldOptions("engagementModels", settings?.locale || "en"),
          current: settings?.engagementModels || getDefaultFieldOptions("engagementModels", settings?.locale || "en"),
          testId: "engagement-models",
        },
        {
          title: "Date Formats",
          description: "Available date format options for projects. Each project selects one format at creation.",
          key: "dateFormats",
          defaults: getDefaultFieldOptions("dateFormats", settings?.locale || "en"),
          current: settings?.dateFormats || getDefaultFieldOptions("dateFormats", settings?.locale || "en"),
          testId: "date-formats",
        },
      ],
    },
    {
      value: "clients_settings",
      label: t("nav.companies"),
      fields: [
        {
          title: t("clients.industry"),
          description: "Industry options for companies (e.g., Technology, Healthcare, Finance).",
          key: "industries",
          defaults: getDefaultFieldOptions("industries", settings?.locale || "en"),
          current: settings?.industries || getDefaultFieldOptions("industries", settings?.locale || "en"),
          testId: "industries",
        },
      ],
    },
    {
      value: "contacts",
      label: "Contacts",
      fields: [
        {
          title: "Contact Role",
          description: "Role options for contacts (e.g., Executive Sponsor, Project Manager).",
          key: "contactRoles",
          defaults: getDefaultFieldOptions("contactRoles", settings?.locale || "en"),
          current: settings?.contactRoles || getDefaultFieldOptions("contactRoles", settings?.locale || "en"),
          testId: "contact-roles",
        },
      ],
    },
    {
      value: "tasks",
      label: "Tasks",
      fields: [
        {
          title: "Task Status",
          description: "Status options for tasks (e.g., Not Started, In Progress, Complete).",
          key: "taskStatuses",
          defaults: getDefaultFieldOptions("taskStatuses", settings?.locale || "en"),
          current: settings?.taskStatuses || getDefaultFieldOptions("taskStatuses", settings?.locale || "en"),
          testId: "task-statuses",
        },
        {
          title: "Task Item Type",
          description: "Type categories for tasks (e.g., Workstream, Phase).",
          key: "taskItemTypes",
          defaults: getDefaultFieldOptions("taskItemTypes", settings?.locale || "en"),
          current: settings?.taskItemTypes || getDefaultFieldOptions("taskItemTypes", settings?.locale || "en"),
          testId: "task-item-types",
        },
      ],
    },
    {
      value: "risks",
      label: "Risks",
      fields: [
        {
          title: "Risk Probability",
          description: "Probability levels for risks in the risk register.",
          key: "riskProbabilities",
          defaults: getDefaultFieldOptions("riskProbabilities", settings?.locale || "en"),
          current: settings?.riskProbabilities || getDefaultFieldOptions("riskProbabilities", settings?.locale || "en"),
          testId: "risk-probabilities",
        },
        {
          title: "Risk Impact",
          description: "Impact levels for risks in the risk register.",
          key: "riskImpacts",
          defaults: getDefaultFieldOptions("riskImpacts", settings?.locale || "en"),
          current: settings?.riskImpacts || getDefaultFieldOptions("riskImpacts", settings?.locale || "en"),
          testId: "risk-impacts",
        },
        {
          title: "Risk Status",
          description: "Status options for risks in the risk register.",
          key: "riskStatuses",
          defaults: getDefaultFieldOptions("riskStatuses", settings?.locale || "en"),
          current: settings?.riskStatuses || getDefaultFieldOptions("riskStatuses", settings?.locale || "en"),
          testId: "risk-statuses",
        },
      ],
    },
  ];

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="max-w-3xl">
        <Tabs defaultValue="general" data-testid="tabs-settings-main">
          <TabsList className="mb-6" data-testid="tabs-list-settings-main">
            <TabsTrigger value="general" data-testid="tab-settings-general">General</TabsTrigger>
            <TabsTrigger value="branding" data-testid="tab-settings-branding">Branding</TabsTrigger>
            <TabsTrigger value="team_members" data-testid="tab-settings-team-members">Team Members</TabsTrigger>
            <TabsTrigger value="rate_cards" data-testid="tab-settings-rate-cards">Rate Cards</TabsTrigger>
            <TabsTrigger value="field_options" data-testid="tab-settings-field-options">Field Options</TabsTrigger>
            <TabsTrigger value="flightpath" data-testid="tab-settings-flightpath">Operating Model</TabsTrigger>
            <TabsTrigger value="api_tokens" data-testid="tab-settings-api-tokens">{t("settings.apiTokensTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
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
                      <h3 className="text-sm font-medium" data-testid="text-opportunities-label">Opportunities</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enable the Opportunities module for pre-sales tracking. When enabled, users can create opportunities with Stage 0 governance, build estimates, and convert won opportunities to delivery projects. When disabled, projects use a simplified Stage 0 checklist.
                      </p>
                    </div>
                    <Switch
                      checked={settings?.opportunitiesEnabled ?? true}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ opportunitiesEnabled: checked })
                      }
                      disabled={updateMutation.isPending}
                      data-testid="switch-opportunities"
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium" data-testid="text-min-margin-label">{t("settings.minMarginForWon")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.minMarginForWonHelp")}
                    </p>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        placeholder="0"
                        defaultValue={settings?.minMarginForWon ? String(parseFloat(settings.minMarginForWon)) : ""}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const val = raw === "" ? null : raw;
                          const current = settings?.minMarginForWon ? String(parseFloat(settings.minMarginForWon)) : null;
                          if (val !== current) {
                            updateMutation.mutate({ minMarginForWon: val });
                          }
                        }}
                        data-testid="input-min-margin-won"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </Card>

                <div className="mt-6 mb-4">
                  <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    Governance Terminology
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Customize the governance framework label used throughout the application.
                  </p>
                </div>

                <Card className="p-5">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="governance-label" className="text-sm font-medium">Governance Model Label</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                        Override the default "Operating Model" label. Leave blank to use the default.
                      </p>
                      <div className="flex gap-2 max-w-md">
                        <Input
                          id="governance-label"
                          placeholder="Operating Model"
                          defaultValue={settings?.governanceModelLabel || ""}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (settings?.governanceModelLabel || null)) {
                              updateMutation.mutate({ governanceModelLabel: val });
                            }
                          }}
                          data-testid="input-governance-label"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="mt-6 mb-4">
                  <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t("settings.languageLabel")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.languageReadOnly")}
                  </p>
                </div>

                <Card className="p-5">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">{t("settings.language")}</Label>
                      <p className="text-sm mt-1" data-testid="text-locale-display">
                        {settings?.locale === "es" ? "Español" : settings?.locale === "pt" ? "Português" : "English"}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="branding">
            <BrandingManager />
          </TabsContent>

          <TabsContent value="team_members">
            <TeamMembersManager />
          </TabsContent>

          <TabsContent value="rate_cards">
            <RateCardsManager />
          </TabsContent>

          <TabsContent value="field_options">
            <div className="mb-6">
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <List className="w-4 h-4" />
                Field Options
              </h2>
              <p className="text-sm text-muted-foreground">
                Customize the dropdown options available across the application. Fields are organized by the record type they belong to.
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Tabs defaultValue="global" data-testid="tabs-field-options">
                <TabsList className="mb-4" data-testid="tabs-list-field-options">
                  {fieldTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {fieldTabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} data-testid={`tab-content-${tab.value}`}>
                    <div className="space-y-4">
                      {tab.fields.map((config) => (
                        <FieldOptionEditor
                          key={config.key}
                          title={config.title}
                          description={config.description}
                          options={config.current}
                          defaults={config.defaults}
                          settingsKey={config.key}
                          onSave={handleFieldSave}
                          isPending={updateMutation.isPending}
                          testIdPrefix={config.testId}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="flightpath">
            <FlightPathManager />
          </TabsContent>

          <TabsContent value="api_tokens">
            <ApiTokensManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
