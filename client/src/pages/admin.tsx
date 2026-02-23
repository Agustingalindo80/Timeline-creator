import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Shield, List, Plus, X, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AppSettings, FieldOption } from "@shared/schema";
import {
  DEFAULT_TASK_STATUSES,
  DEFAULT_TASK_HEALTH,
  DEFAULT_TASK_ITEM_TYPES,
  DEFAULT_RISK_PROBABILITIES,
  DEFAULT_RISK_IMPACTS,
  DEFAULT_RISK_STATUSES,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_ENGAGEMENT_MODELS,
} from "@shared/schema";

interface FieldOptionEditorProps {
  title: string;
  description: string;
  options: FieldOption[];
  defaults: FieldOption[];
  settingsKey: string;
  onSave: (key: string, options: FieldOption[]) => void;
  isPending: boolean;
  testIdPrefix: string;
}

function FieldOptionEditor({
  title,
  description,
  options,
  defaults,
  settingsKey,
  onSave,
  isPending,
  testIdPrefix,
}: FieldOptionEditorProps) {
  const [items, setItems] = useState<FieldOption[]>(options);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setItems(options);
    }
  }, [options, isEditing]);

  const hasChanges = JSON.stringify(items) !== JSON.stringify(options);

  const addOption = () => {
    const val = newValue.trim();
    const lbl = newLabel.trim();
    if (!val || !lbl) return;
    if (items.some((i) => i.value === val)) return;
    setItems([...items, { value: val, label: lbl }]);
    setNewValue("");
    setNewLabel("");
  };

  const removeOption = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], label };
    setItems(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
  };

  const resetToDefaults = () => {
    setItems([...defaults]);
  };

  const handleSave = () => {
    onSave(settingsKey, items);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setItems(options);
    setIsEditing(false);
    setNewValue("");
    setNewLabel("");
  };

  return (
    <Card className="p-5" data-testid={`card-${testIdPrefix}`}>
      <div className="flex items-center justify-between gap-4 mb-1">
        <div>
          <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-title`}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {!isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            data-testid={`button-edit-${testIdPrefix}`}
          >
            Edit
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {items.map((opt) => (
            <span
              key={opt.value}
              className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
              data-testid={`badge-${testIdPrefix}-${opt.value}`}
            >
              {opt.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            {items.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-2" data-testid={`row-${testIdPrefix}-${opt.value}`}>
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    data-testid={`button-move-up-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    data-testid={`button-move-down-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                </div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded min-w-[80px]">{opt.value}</code>
                <Input
                  value={opt.label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  className="h-8 text-sm flex-1"
                  data-testid={`input-label-${testIdPrefix}-${opt.value}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeOption(idx)}
                  disabled={items.length <= 1}
                  data-testid={`button-remove-${testIdPrefix}-${opt.value}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="value_key"
              className="h-8 text-sm w-32"
              data-testid={`input-new-value-${testIdPrefix}`}
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Display Label"
              className="h-8 text-sm flex-1"
              data-testid={`input-new-label-${testIdPrefix}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={addOption}
              disabled={!newValue.trim() || !newLabel.trim()}
              data-testid={`button-add-${testIdPrefix}`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetToDefaults}
              className="text-xs"
              data-testid={`button-reset-${testIdPrefix}`}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to defaults
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                data-testid={`button-cancel-${testIdPrefix}`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || items.length === 0}
                data-testid={`button-save-${testIdPrefix}`}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface FieldConfig {
  title: string;
  description: string;
  key: string;
  defaults: FieldOption[];
  current: FieldOption[];
  testId: string;
}

interface TabConfig {
  value: string;
  label: string;
  fields: FieldConfig[];
}

export default function Admin() {
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

  const handleFieldSave = (key: string, options: FieldOption[]) => {
    updateMutation.mutate({ [key]: options } as any);
  };

  const tabs: TabConfig[] = [
    {
      value: "global",
      label: "Global",
      fields: [
        {
          title: "Health",
          description: "Health indicator options shared across projects and tasks (traffic light colors).",
          key: "taskHealthOptions",
          defaults: DEFAULT_TASK_HEALTH,
          current: settings?.taskHealthOptions || DEFAULT_TASK_HEALTH,
          testId: "task-health",
        },
      ],
    },
    {
      value: "projects",
      label: "Projects",
      fields: [
        {
          title: "Project Type",
          description: "Type classifications for projects (e.g., Billable, Non-Billable).",
          key: "projectTypes",
          defaults: DEFAULT_PROJECT_TYPES,
          current: settings?.projectTypes || DEFAULT_PROJECT_TYPES,
          testId: "project-types",
        },
        {
          title: "Engagement Model",
          description: "Engagement model options for projects (e.g., Fixed Bid, T&M, Managed Capacity).",
          key: "engagementModels",
          defaults: DEFAULT_ENGAGEMENT_MODELS,
          current: settings?.engagementModels || DEFAULT_ENGAGEMENT_MODELS,
          testId: "engagement-models",
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
          defaults: DEFAULT_TASK_STATUSES,
          current: settings?.taskStatuses || DEFAULT_TASK_STATUSES,
          testId: "task-statuses",
        },
        {
          title: "Task Item Type",
          description: "Type categories for tasks (e.g., Workstream, Phase).",
          key: "taskItemTypes",
          defaults: DEFAULT_TASK_ITEM_TYPES,
          current: settings?.taskItemTypes || DEFAULT_TASK_ITEM_TYPES,
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
          defaults: DEFAULT_RISK_PROBABILITIES,
          current: settings?.riskProbabilities || DEFAULT_RISK_PROBABILITIES,
          testId: "risk-probabilities",
        },
        {
          title: "Risk Impact",
          description: "Impact levels for risks in the risk register.",
          key: "riskImpacts",
          defaults: DEFAULT_RISK_IMPACTS,
          current: settings?.riskImpacts || DEFAULT_RISK_IMPACTS,
          testId: "risk-impacts",
        },
        {
          title: "Risk Status",
          description: "Status options for risks in the risk register.",
          key: "riskStatuses",
          defaults: DEFAULT_RISK_STATUSES,
          current: settings?.riskStatuses || DEFAULT_RISK_STATUSES,
          testId: "risk-statuses",
        },
      ],
    },
  ];

  return (
    <div className="p-6">
      <Helmet>
        <title>Settings | Project High Level Planning</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="max-w-3xl">
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
          <>
            <div className="space-y-4 mb-10">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium" data-testid="text-risk-register-label">Risk Register</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable the risk register feature on all projects. When enabled, each project will have a Risk Register tab for tracking project risks, their probability, impact, and mitigation strategies.
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

            <div className="mb-6">
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <List className="w-4 h-4" />
                Field Options
              </h2>
              <p className="text-sm text-muted-foreground">
                Customize the dropdown options available across the application. Fields are organized by the record type they belong to.
              </p>
            </div>

            <Tabs defaultValue="global" data-testid="tabs-field-options">
              <TabsList className="mb-4" data-testid="tabs-list-field-options">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabs.map((tab) => (
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
          </>
        )}
      </div>
    </div>
  );
}
