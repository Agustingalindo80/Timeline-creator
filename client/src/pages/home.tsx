import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, FileSpreadsheet, Trash2, FolderKanban, Search, Save, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { TimelineWithMilestones, Task, AppSettings } from "@shared/schema";
import { DEFAULT_TASK_HEALTH, DEFAULT_PROJECT_TYPES, DEFAULT_ENGAGEMENT_MODELS, DEFAULT_CLIENTS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function dateToMonths(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) return parseInt(isoMatch[1]) * 12 + (parseInt(isoMatch[2]) - 1);
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 0;
}

function getWeightedCompletion(tasks: Task[]): number | null {
  if (tasks.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const task of tasks) {
    const start = dateToMonths(task.startDate);
    const end = dateToMonths(task.endDate);
    const duration = Math.max(end - start, 1);
    totalWeight += duration;
    weightedSum += duration * (task.percentComplete ?? 0);
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

const HEALTH_COLORS: Record<string, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

interface RowEdits {
  projectType?: string | null;
  engagementModel?: string | null;
  client?: string | null;
  approvedBudget?: string | null;
  grossMargin?: string | null;
  healthOverall?: string;
  scopeHealth?: string;
  budgetHealth?: string;
  teamHealth?: string;
}

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const { data: timelines, isLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const healthOptions = settings?.taskHealthOptions || DEFAULT_TASK_HEALTH;
  const projectTypeOptions = settings?.projectTypes || DEFAULT_PROJECT_TYPES;
  const engagementModelOptions = settings?.engagementModels || DEFAULT_ENGAGEMENT_MODELS;
  const clientOptions = settings?.clients || DEFAULT_CLIENTS;

  const filteredTimelines = timelines?.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const clientLabel = t.client ? (clientOptions.find((o) => o.value === t.client)?.label || t.client).toLowerCase() : "";
    return t.title.toLowerCase().includes(q) || clientLabel.includes(q);
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/timelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Project deleted" });
    },
  });

  const getOriginal = useCallback((timeline: TimelineWithMilestones, field: keyof RowEdits): string => {
    const raw = (timeline as any)[field];
    return raw != null ? String(raw) : "";
  }, []);

  const updateField = useCallback((id: string, field: keyof RowEdits, value: string | null, timeline: TimelineWithMilestones) => {
    const original = getOriginal(timeline, field);
    const newVal = value ?? "";
    setEdits((prev) => {
      const existing = { ...prev[id] };
      if (newVal === original) {
        delete existing[field];
        if (Object.keys(existing).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: existing };
      }
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  }, [getOriginal]);

  const getVal = useCallback((timeline: TimelineWithMilestones, field: keyof RowEdits): string => {
    const edit = edits[timeline.id];
    if (edit && field in edit) return (edit[field] as string) ?? "";
    return getOriginal(timeline, field);
  }, [edits, getOriginal]);

  const hasEdits = useCallback((id: string) => {
    return edits[id] && Object.keys(edits[id]).length > 0;
  }, [edits]);

  const hasAnyEdits = Object.keys(edits).some((id) => hasEdits(id));
  const isSaving = savingIds.size > 0;

  const saveRow = useCallback(async (id: string) => {
    const rowEdits = edits[id];
    if (!rowEdits || Object.keys(rowEdits).length === 0) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const payload: Record<string, any> = {};
      for (const [key, val] of Object.entries(rowEdits)) {
        if (key === "approvedBudget" || key === "grossMargin") {
          payload[key] = val && val !== "" ? parseFloat(val as string) : null;
        } else {
          payload[key] = val && val !== "" ? val : null;
        }
      }
      await apiRequest("PATCH", `/api/timelines/${id}`, payload);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Project updated" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [edits, toast]);

  const saveAll = useCallback(async () => {
    const ids = Object.keys(edits).filter((id) => hasEdits(id));
    for (const id of ids) {
      await saveRow(id);
    }
  }, [edits, hasEdits, saveRow]);

  const selectClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full appearance-none cursor-pointer";
  const inputClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full";

  return (
    <div className="p-6">
      <Helmet>
        <title>Projects | Project High Level Planning</title>
        <meta name="description" content="Manage your projects with milestones, tasks, and health tracking." />
      </Helmet>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Projects</h1>
        <div className="flex items-center gap-2">
          {hasAnyEdits && (
            <Button onClick={saveAll} size="sm" disabled={isSaving} data-testid="button-save-all">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save All Changes"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/create?mode=upload")}
            data-testid="button-import-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button size="sm" onClick={() => navigate("/create")} data-testid="button-create-timeline">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {timelines && timelines.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name or client..."
            className="pl-9 h-8 text-sm"
            data-testid="input-search-projects"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : !filteredTimelines || filteredTimelines.length === 0 ? (
        searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
            <Search className="w-10 h-10 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No matching projects</h2>
            <p className="text-sm text-muted-foreground">
              No projects match "{searchQuery}". Try a different search term.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <FolderKanban className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first project by adding milestones manually or importing from an Excel spreadsheet.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/create?mode=upload")}
                data-testid="button-empty-import"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
              <Button onClick={() => navigate("/create")} data-testid="button-empty-create">
                <Plus className="w-4 h-4 mr-2" />
                Create Manually
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-projects">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[180px]">Project Name</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[110px]">Client</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[110px]">Project Type</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[120px]">Engagement Model</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[100px]">Budget</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[80px]">Margin</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Overall</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Scope</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Budget</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Team</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Progress</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimelines.map((timeline) => {
                  const pct = getWeightedCompletion(timeline.tasks);
                  const dirty = hasEdits(timeline.id);
                  const saving = savingIds.has(timeline.id);

                  return (
                    <tr
                      key={timeline.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${dirty ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}
                      data-testid={`row-timeline-${timeline.id}`}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: timeline.color }}
                          />
                          <Link
                            href={`/timeline/${timeline.id}`}
                            className="font-medium text-xs hover:underline truncate max-w-[160px] block"
                            data-testid={`link-project-${timeline.id}`}
                          >
                            {timeline.title}
                          </Link>
                          <span className="text-muted-foreground/60 shrink-0" title={`${timeline.milestones.length}m / ${timeline.tasks.length}t`}>
                            {timeline.milestones.length}m {timeline.tasks.length > 0 && `· ${timeline.tasks.length}t`}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "client")}
                          onChange={(e) => updateField(timeline.id, "client", e.target.value || null, timeline)}
                          data-testid={`select-client-${timeline.id}`}
                        >
                          <option value="">—</option>
                          {clientOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "projectType")}
                          onChange={(e) => updateField(timeline.id, "projectType", e.target.value || null, timeline)}
                          data-testid={`select-project-type-${timeline.id}`}
                        >
                          <option value="">—</option>
                          {projectTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "engagementModel")}
                          onChange={(e) => updateField(timeline.id, "engagementModel", e.target.value || null, timeline)}
                          data-testid={`select-engagement-model-${timeline.id}`}
                        >
                          <option value="">—</option>
                          {engagementModelOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <span className="text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={inputClass}
                            value={getVal(timeline, "approvedBudget")}
                            onChange={(e) => updateField(timeline.id, "approvedBudget", e.target.value || null, timeline)}
                            placeholder="—"
                            data-testid={`input-budget-${timeline.id}`}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className={inputClass}
                            value={getVal(timeline, "grossMargin")}
                            onChange={(e) => updateField(timeline.id, "grossMargin", e.target.value || null, timeline)}
                            placeholder="—"
                            data-testid={`input-margin-${timeline.id}`}
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "healthOverall")}
                          onChange={(e) => updateField(timeline.id, "healthOverall", e.target.value, timeline)}
                          data-testid={`select-health-overall-${timeline.id}`}
                        >
                          {healthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "scopeHealth")}
                          onChange={(e) => updateField(timeline.id, "scopeHealth", e.target.value, timeline)}
                          data-testid={`select-health-scope-${timeline.id}`}
                        >
                          {healthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "budgetHealth")}
                          onChange={(e) => updateField(timeline.id, "budgetHealth", e.target.value, timeline)}
                          data-testid={`select-health-budget-${timeline.id}`}
                        >
                          {healthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "teamHealth")}
                          onChange={(e) => updateField(timeline.id, "teamHealth", e.target.value, timeline)}
                          data-testid={`select-health-team-${timeline.id}`}
                        >
                          {healthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        {pct !== null ? (
                          <div className="flex items-center gap-1.5" data-testid={`completion-${timeline.id}`}>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary min-w-[40px]">
                              <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium w-7 text-right">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-center block">—</span>
                        )}
                      </td>

                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          {dirty && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => saveRow(timeline.id)}
                              disabled={saving}
                              title="Save changes"
                              data-testid={`button-save-${timeline.id}`}
                            >
                              <Save className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          )}
                          <Link href={`/timeline/${timeline.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Open project"
                              data-testid={`button-open-${timeline.id}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                title="Delete project"
                                data-testid={`button-delete-${timeline.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{timeline.title}" and all its milestones.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(timeline.id)}
                                  data-testid="button-confirm-delete"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
