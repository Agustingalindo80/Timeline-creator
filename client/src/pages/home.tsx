import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Plus, FileSpreadsheet, Trash2, FolderKanban, Search, Save, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, X, Filter } from "lucide-react";
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
import type { TimelineWithMilestones, Task, AppSettings, Client } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";

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
    if (!task.startDate || !task.endDate) continue;
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
  projectStatus?: string | null;
  clientId?: string | null;
  region?: string | null;
  approvedBudget?: string | null;
  totalRunningCost?: string | null;
  healthOverall?: string;
  scopeHealth?: string;
  budgetHealth?: string;
  teamHealth?: string;
}

type SortField = "title" | "client" | "projectType" | "engagementModel" | "projectStatus" | "region" | "approvedBudget" | "totalRunningCost" | "grossMargin" | "healthOverall" | "scopeHealth" | "budgetHealth" | "teamHealth" | "progress";
type SortDir = "asc" | "desc";

interface ColumnFilters {
  clientId?: string;
  projectType?: string;
  engagementModel?: string;
  projectStatus?: string;
  region?: string;
  healthOverall?: string;
  scopeHealth?: string;
  budgetHealth?: string;
  teamHealth?: string;
}

export default function Home() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitle = useAppTitle(t("projects.title"));
  const [searchQuery, setSearchQuery] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: timelines, isLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const healthOptions = settings?.taskHealthOptions || getDefaultFieldOptions("taskHealthOptions", settings?.locale || "en");
  const projectTypeOptions = settings?.projectTypes || getDefaultFieldOptions("projectTypes", settings?.locale || "en");
  const engagementModelOptions = settings?.engagementModels || getDefaultFieldOptions("engagementModels", settings?.locale || "en");
  const projectStatusOptions = settings?.projectStatuses || getDefaultFieldOptions("projectStatuses", settings?.locale || "en");
  const regionOptions = settings?.regions || getDefaultFieldOptions("regions", settings?.locale || "en");

  const getClientName = useCallback((clientId: string | null | undefined): string => {
    if (!clientId || !clientsList) return "";
    const c = clientsList.find((cl) => cl.id === clientId);
    return c ? c.name : "";
  }, [clientsList]);

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

  const processedTimelines = useMemo(() => {
    if (!timelines) return [];

    let result = timelines.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = getClientName(t.clientId).toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !clientName.includes(q)) return false;
      }

      if (columnFilters.clientId && (t.clientId || "") !== columnFilters.clientId) return false;
      if (columnFilters.projectType && (t.projectType || "") !== columnFilters.projectType) return false;
      if (columnFilters.engagementModel && (t.engagementModel || "") !== columnFilters.engagementModel) return false;
      if (columnFilters.projectStatus && (t.projectStatus || "not_started") !== columnFilters.projectStatus) return false;
      if (columnFilters.region && (t.region || "") !== columnFilters.region) return false;
      if (columnFilters.healthOverall && (t.healthOverall || "green") !== columnFilters.healthOverall) return false;
      if (columnFilters.scopeHealth && (t.scopeHealth || "green") !== columnFilters.scopeHealth) return false;
      if (columnFilters.budgetHealth && (t.budgetHealth || "green") !== columnFilters.budgetHealth) return false;
      if (columnFilters.teamHealth && (t.teamHealth || "green") !== columnFilters.teamHealth) return false;

      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortField) {
          case "title":
            aVal = a.title.toLowerCase();
            bVal = b.title.toLowerCase();
            break;
          case "client": {
            aVal = getClientName(a.clientId).toLowerCase();
            bVal = getClientName(b.clientId).toLowerCase();
            break;
          }
          case "projectType": {
            const aLabel = a.projectType ? (projectTypeOptions.find((o) => o.value === a.projectType)?.label || a.projectType) : "";
            const bLabel = b.projectType ? (projectTypeOptions.find((o) => o.value === b.projectType)?.label || b.projectType) : "";
            aVal = aLabel.toLowerCase();
            bVal = bLabel.toLowerCase();
            break;
          }
          case "engagementModel": {
            const aLabel = a.engagementModel ? (engagementModelOptions.find((o) => o.value === a.engagementModel)?.label || a.engagementModel) : "";
            const bLabel = b.engagementModel ? (engagementModelOptions.find((o) => o.value === b.engagementModel)?.label || b.engagementModel) : "";
            aVal = aLabel.toLowerCase();
            bVal = bLabel.toLowerCase();
            break;
          }
          case "projectStatus": {
            const aLabel2 = a.projectStatus ? (projectStatusOptions.find((o) => o.value === a.projectStatus)?.label || a.projectStatus) : "";
            const bLabel2 = b.projectStatus ? (projectStatusOptions.find((o) => o.value === b.projectStatus)?.label || b.projectStatus) : "";
            aVal = aLabel2.toLowerCase();
            bVal = bLabel2.toLowerCase();
            break;
          }
          case "region": {
            const aRegion = a.region ? (regionOptions.find((o) => o.value === a.region)?.label || a.region) : "";
            const bRegion = b.region ? (regionOptions.find((o) => o.value === b.region)?.label || b.region) : "";
            aVal = aRegion.toLowerCase();
            bVal = bRegion.toLowerCase();
            break;
          }
          case "approvedBudget":
            aVal = a.approvedBudget ? parseFloat(a.approvedBudget) : -1;
            bVal = b.approvedBudget ? parseFloat(b.approvedBudget) : -1;
            break;
          case "totalRunningCost":
            aVal = a.totalRunningCost ? parseFloat(a.totalRunningCost) : -1;
            bVal = b.totalRunningCost ? parseFloat(b.totalRunningCost) : -1;
            break;
          case "grossMargin":
            aVal = a.grossMargin ? parseFloat(a.grossMargin) : -1;
            bVal = b.grossMargin ? parseFloat(b.grossMargin) : -1;
            break;
          case "healthOverall":
          case "scopeHealth":
          case "budgetHealth":
          case "teamHealth": {
            const order: Record<string, number> = { green: 0, amber: 1, red: 2 };
            const aHealth = (a as any)[sortField] || "green";
            const bHealth = (b as any)[sortField] || "green";
            aVal = order[aHealth] ?? 99;
            bVal = order[bHealth] ?? 99;
            break;
          }
          case "progress":
            aVal = getWeightedCompletion(a.tasks) ?? -1;
            bVal = getWeightedCompletion(b.tasks) ?? -1;
            break;
        }

        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [timelines, searchQuery, columnFilters, sortField, sortDir, getClientName, projectTypeOptions, engagementModelOptions, projectStatusOptions, regionOptions]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/timelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: t("projects.projectUpdated") });
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
        if (key === "approvedBudget" || key === "totalRunningCost") {
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
      toast({ title: t("projects.projectUpdated") });
    } catch {
      toast({ title: t("clients.failedToSave"), variant: "destructive" });
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

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortField(null);
        setSortDir("asc");
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField, sortDir]);

  const setFilter = useCallback((field: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setSearchQuery("");
  }, []);

  const selectClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full appearance-none cursor-pointer";
  const inputClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full";
  const filterSelectClass = "h-6 text-[10px] border rounded px-1 py-0 bg-background w-full appearance-none cursor-pointer text-muted-foreground";

  const SortHeader = ({ field, label, align = "left" }: { field: SortField; label: string; align?: "left" | "center" }) => {
    const active = sortField === field;
    return (
      <th
        className={`table-header-cell px-3 py-2 cursor-pointer hover:text-foreground transition-colors ${align === "center" ? "text-center" : "text-left"}`}
        onClick={() => toggleSort(field)}
        data-testid={`sort-${field}`}
      >
        <div className={`inline-flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-20" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
        <meta name="description" content="Manage your projects with milestones, tasks, and health tracking." />
      </Helmet>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">{t("projects.title")}</h1>
        <div className="flex items-center gap-2">
          {hasAnyEdits && (
            <Button onClick={saveAll} size="sm" disabled={isSaving} data-testid="button-save-all">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? t("common.saving") : t("common.saveAllChanges")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/create?mode=upload")}
            data-testid="button-import-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {t("projects.importExcel")}
          </Button>
          <Button size="sm" onClick={() => navigate("/create")} data-testid="button-create-timeline">
            <Plus className="w-4 h-4 mr-2" />
            {t("projects.newProject")}
          </Button>
        </div>
      </div>

      {timelines && timelines.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("common.search") + "..."}
              className="pl-9 h-8 text-sm"
              data-testid="input-search-projects"
            />
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 shrink-0"
            data-testid="button-toggle-filters"
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            {t("common.filters")}
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {(activeFilterCount > 0 || searchQuery.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground shrink-0"
              data-testid="button-clear-filters"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {t("common.clearAll")}
            </Button>
          )}
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
      ) : !timelines || timelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-5">
            <FolderKanban className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{t("dashboard.noActiveProjects")}</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
            {t("projects.noMilestonesAdded")}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/create?mode=upload")}
              data-testid="button-empty-import"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {t("projects.importExcel")}
            </Button>
            <Button onClick={() => navigate("/create")} data-testid="button-empty-create">
              <Plus className="w-4 h-4 mr-2" />
              {t("projects.manualEntry")}
            </Button>
          </div>
        </div>
      ) : processedTimelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
          <Search className="w-8 h-8 text-muted-foreground/60 mb-3" />
          <h2 className="text-base font-semibold mb-1">{t("common.noData")}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {t("clients.noMatchingDescription")}
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
            {t("common.clearAllFilters")}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-projects">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <SortHeader field="title" label={t("reports.projectName")} />
                  <SortHeader field="client" label={t("common.client")} />
                  <SortHeader field="projectStatus" label={t("common.status")} />
                  <SortHeader field="region" label={t("common.region")} />
                  <SortHeader field="projectType" label={t("projects.projectType")} />
                  <SortHeader field="engagementModel" label={t("projects.engagement")} />
                  <SortHeader field="approvedBudget" label={t("projects.budget")} />
                  <SortHeader field="totalRunningCost" label={t("projects.runningCost")} />
                  <SortHeader field="grossMargin" label={t("projects.grossMargin")} />
                  <SortHeader field="healthOverall" label={t("projects.overall")} align="center" />
                  <SortHeader field="scopeHealth" label={t("projects.scope")} align="center" />
                  <SortHeader field="budgetHealth" label={t("projects.budget")} align="center" />
                  <SortHeader field="teamHealth" label={t("projects.team")} align="center" />
                  <SortHeader field="progress" label={t("common.status")} align="center" />
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap w-[80px]">{t("common.actions")}</th>
                </tr>
                {showFilters && (
                  <tr className="bg-muted/30 border-b">
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.clientId || ""}
                        onChange={(e) => setFilter("clientId", e.target.value)}
                        data-testid="filter-client"
                      >
                        <option value="">{t("common.all")}</option>
                        {(clientsList || []).map((cl) => (
                          <option key={cl.id} value={cl.id}>{cl.name}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.projectStatus || ""}
                        onChange={(e) => setFilter("projectStatus", e.target.value)}
                        data-testid="filter-projectStatus"
                      >
                        <option value="">{t("common.all")}</option>
                        {projectStatusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.region || ""}
                        onChange={(e) => setFilter("region", e.target.value)}
                        data-testid="filter-region"
                      >
                        <option value="">{t("common.all")}</option>
                        {regionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.projectType || ""}
                        onChange={(e) => setFilter("projectType", e.target.value)}
                        data-testid="filter-projectType"
                      >
                        <option value="">{t("common.all")}</option>
                        {projectTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.engagementModel || ""}
                        onChange={(e) => setFilter("engagementModel", e.target.value)}
                        data-testid="filter-engagementModel"
                      >
                        <option value="">{t("common.all")}</option>
                        {engagementModelOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.healthOverall || ""}
                        onChange={(e) => setFilter("healthOverall", e.target.value)}
                        data-testid="filter-healthOverall"
                      >
                        <option value="">{t("common.all")}</option>
                        {healthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.scopeHealth || ""}
                        onChange={(e) => setFilter("scopeHealth", e.target.value)}
                        data-testid="filter-scopeHealth"
                      >
                        <option value="">{t("common.all")}</option>
                        {healthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.budgetHealth || ""}
                        onChange={(e) => setFilter("budgetHealth", e.target.value)}
                        data-testid="filter-budgetHealth"
                      >
                        <option value="">{t("common.all")}</option>
                        {healthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.teamHealth || ""}
                        onChange={(e) => setFilter("teamHealth", e.target.value)}
                        data-testid="filter-teamHealth"
                      >
                        <option value="">{t("common.all")}</option>
                        {healthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                  </tr>
                )}
              </thead>
              <tbody>
                {processedTimelines.map((timeline) => {
                  const pct = getWeightedCompletion(timeline.tasks);
                  const dirty = hasEdits(timeline.id);
                  const saving = savingIds.has(timeline.id);

                  return (
                    <tr
                      key={timeline.id}
                      className={`border-b last:border-b-0 table-row-hover ${dirty ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}
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
                          value={getVal(timeline, "clientId")}
                          onChange={(e) => updateField(timeline.id, "clientId", e.target.value || null, timeline)}
                          data-testid={`select-client-${timeline.id}`}
                        >
                          <option value="">—</option>
                          {(clientsList || []).map((cl) => (
                            <option key={cl.id} value={cl.id}>{cl.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "projectStatus") || "not_started"}
                          onChange={(e) => updateField(timeline.id, "projectStatus", e.target.value || null, timeline)}
                          data-testid={`select-project-status-${timeline.id}`}
                        >
                          {projectStatusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(timeline, "region")}
                          onChange={(e) => updateField(timeline.id, "region", e.target.value || null, timeline)}
                          data-testid={`select-region-${timeline.id}`}
                        >
                          <option value="">—</option>
                          {regionOptions.map((opt) => (
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

                      <td className="px-3 py-1.5 table-financial">
                        <span className="text-xs" data-testid={`text-budget-${timeline.id}`}>
                          {(() => {
                            const budgetVal = getVal(timeline, "approvedBudget");
                            const budget = parseFloat(budgetVal) || 0;
                            return budget > 0 ? `$${budget.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : <span className="text-muted-foreground/40">—</span>;
                          })()}
                        </span>
                      </td>

                      <td className="px-3 py-1.5 table-financial">
                        <span className="text-xs" data-testid={`text-running-cost-${timeline.id}`}>
                          {(() => {
                            const costStr = getVal(timeline, "totalRunningCost");
                            const cost = parseFloat(costStr) || 0;
                            return cost > 0 ? `$${cost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : <span className="text-muted-foreground/40">—</span>;
                          })()}
                        </span>
                      </td>

                      <td className="px-3 py-1.5 table-financial">
                        {(() => {
                          const budgetStr = getVal(timeline, "approvedBudget");
                          const costStr = getVal(timeline, "totalRunningCost");
                          const budget = parseFloat(budgetStr) || 0;
                          const cost = parseFloat(costStr) || 0;
                          const gm = budget > 0 ? ((budget - cost) / budget) * 100 : null;
                          return (
                            <span
                              className={`text-xs font-medium ${
                                gm === null ? "text-muted-foreground/40" :
                                gm >= 30 ? "text-green-600 dark:text-green-400" :
                                gm >= 15 ? "text-amber-600 dark:text-amber-400" :
                                "text-red-600 dark:text-red-400"
                              }`}
                              data-testid={`text-gm-${timeline.id}`}
                            >
                              {gm !== null ? `${gm.toFixed(1)}%` : "—"}
                            </span>
                          );
                        })()}
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
                              title={t("common.save")}
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
                              title={t("common.edit")}
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
                                title={t("common.delete")}
                                data-testid={`button-delete-${timeline.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("common.delete")}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("clients.deleteDescription", { name: timeline.title })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(timeline.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("common.delete")}
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
