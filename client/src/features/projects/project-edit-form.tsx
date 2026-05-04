import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemePicker } from "@/components/theme-picker";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import type { TimelineWithMilestones, FieldOption, Client } from "@shared/schema";

interface ProjectEditFormProps {
  timeline: TimelineWithMilestones;
  id: string;
  projectTypes: FieldOption[];
  engagementModels: FieldOption[];
  projectStatuses: FieldOption[];
  regionOptions: FieldOption[];
  clientsList: Client[] | undefined;
  taskHealthOptions: FieldOption[];
  editTitle: string;
  editDescription: string;
  editColor: string;
  setEditTitle: (v: string) => void;
  setEditDescription: (v: string) => void;
  setEditColor: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ProjectEditForm({
  timeline,
  id,
  projectTypes,
  engagementModels,
  projectStatuses,
  regionOptions,
  clientsList,
  editTitle,
  editDescription,
  editColor,
  setEditTitle,
  setEditDescription,
  setEditColor,
  onSave,
  onCancel,
  isSaving,
}: ProjectEditFormProps) {
  const { t } = useTranslation();

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-xl font-bold"
              data-testid="input-edit-title"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-edit-description"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Project Type</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={timeline.projectType || ""}
              onChange={async (e) => {
                await apiRequest("PATCH", `/api/timelines/${id}`, { projectType: e.target.value || null });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
              }}
              data-testid="select-project-type"
            >
              <option value="">Not set</option>
              {projectTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Engagement</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={timeline.engagementModel || ""}
              onChange={async (e) => {
                await apiRequest("PATCH", `/api/timelines/${id}`, { engagementModel: e.target.value || null });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
              }}
              data-testid="select-engagement-model"
            >
              <option value="">Not set</option>
              {engagementModels.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("common.client")}</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={timeline.clientId || ""}
              onChange={async (e) => {
                await apiRequest("PATCH", `/api/timelines/${id}`, { clientId: e.target.value || null });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
              }}
              data-testid="select-client"
            >
              <option value="">Not set</option>
              {(clientsList || []).map((cl) => (
                <option key={cl.id} value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={timeline.projectStatus || "not_started"}
              onChange={async (e) => {
                await apiRequest("PATCH", `/api/timelines/${id}`, { projectStatus: e.target.value });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
              }}
              data-testid="select-project-status"
            >
              {projectStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Region</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={timeline.region || ""}
              onChange={async (e) => {
                await apiRequest("PATCH", `/api/timelines/${id}`, { region: e.target.value || null });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
              }}
              data-testid="select-region"
            >
              <option value="">Not set</option>
              {regionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              defaultValue={timeline.startDate ?? ""}
              key={`start-${timeline.startDate}`}
              onBlur={async (e) => {
                const val = e.target.value || null;
                if (val !== (timeline.startDate ?? null)) {
                  await apiRequest("PATCH", `/api/timelines/${id}`, { startDate: val });
                  queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                  queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                }
              }}
              data-testid="input-project-start-date"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              defaultValue={timeline.endDate ?? ""}
              key={`end-${timeline.endDate}`}
              onBlur={async (e) => {
                const val = e.target.value || null;
                if (val !== (timeline.endDate ?? null)) {
                  await apiRequest("PATCH", `/api/timelines/${id}`, { endDate: val });
                  queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                  queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                }
              }}
              data-testid="input-project-end-date"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Theme</label>
            <ThemePicker value={editColor} onChange={setEditColor} compact />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          onClick={onCancel}
          data-testid="button-cancel-edit"
        >
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={!editTitle.trim() || isSaving}
          data-testid="button-save-edit"
        >
          <Save className="w-4 h-4 mr-1" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
