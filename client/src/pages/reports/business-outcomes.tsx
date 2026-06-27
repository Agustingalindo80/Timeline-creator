import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ReportLayout } from "@/components/reports/report-layout";
import { DropdownFilter, ProjectFilter } from "@/components/reports/report-filters";
import { ReportStatCard, ReportBarChart } from "@/components/reports/report-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle2, AlertTriangle, TrendingUp, ArrowUpDown } from "lucide-react";

interface OutcomeItem {
  id: string;
  title: string;
  status: string;
  strategicObjective: string | null;
  successMetric: string | null;
  baseline: string | null;
  target: string | null;
  currentValue: string | null;
  targetDate: string | null;
  clientName: string | null;
  ownerName: string | null;
  linkedType: string | null;
  linkedName: string | null;
}

interface OutcomesReport {
  items: OutcomeItem[];
  summary: {
    total: number;
    byStatus: { draft: number; active: number; achieved: number; at_risk: number; cancelled: number };
    achievementRate: number;
    atRiskCount: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  active: { label: "Active", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  achieved: { label: "Achieved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  at_risk: { label: "At Risk", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "achieved", label: "Achieved" },
  { value: "at_risk", label: "At Risk" },
  { value: "cancelled", label: "Cancelled" },
];

const LINKED_TYPE_LABEL: Record<string, string> = {
  project: "Project",
  opportunity: "Opportunity",
  client: "Company",
};

type SortField = "title" | "status" | "linkedName" | "ownerName" | "targetDate";
type SortDirection = "asc" | "desc";

export default function BusinessOutcomesReport() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (projectFilter !== "all") queryParams.set("projectId", projectFilter);
  const queryString = queryParams.toString();

  const { data: report, isLoading } = useQuery<OutcomesReport>({
    queryKey: ["/api/reports/business-outcomes", queryString],
    queryFn: async () => {
      const url = `/api/reports/business-outcomes${queryString ? `?${queryString}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: projects } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/timelines"],
  });

  const projectOptions = useMemo(() => {
    if (!projects) return [];
    return projects.map((p) => ({ id: p.id, name: p.title }));
  }, [projects]);

  const items = report?.items ?? [];
  const summary = report?.summary;

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = (a.title || "").localeCompare(b.title || "");
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "linkedName":
          cmp = (a.linkedName || "").localeCompare(b.linkedName || "");
          break;
        case "ownerName":
          cmp = (a.ownerName || "").localeCompare(b.ownerName || "");
          break;
        case "targetDate":
          cmp = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const statusChartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Draft", value: summary.byStatus.draft },
      { name: "Active", value: summary.byStatus.active },
      { name: "Achieved", value: summary.byStatus.achieved },
      { name: "At Risk", value: summary.byStatus.at_risk },
      { name: "Cancelled", value: summary.byStatus.cancelled },
    ];
  }, [summary]);

  const csvColumns = [
    { key: "title", label: "Outcome" },
    { key: "status", label: "Status" },
    { key: "linkedType", label: "Linked To Type" },
    { key: "linkedName", label: "Linked To" },
    { key: "ownerName", label: "Owner" },
    { key: "strategicObjective", label: "Strategic Objective" },
    { key: "successMetric", label: "Success Metric" },
    { key: "baseline", label: "Baseline" },
    { key: "target", label: "Target" },
    { key: "currentValue", label: "Current Value" },
    { key: "targetDate", label: "Target Date" },
  ];

  const csvData = useMemo(() => {
    return sortedItems.map((item) => ({
      title: item.title,
      status: STATUS_CONFIG[item.status]?.label || item.status,
      linkedType: item.linkedType ? LINKED_TYPE_LABEL[item.linkedType] || item.linkedType : "",
      linkedName: item.linkedName || "",
      ownerName: item.ownerName || "",
      strategicObjective: item.strategicObjective || "",
      successMetric: item.successMetric || "",
      baseline: item.baseline || "",
      target: item.target || "",
      currentValue: item.currentValue || "",
      targetDate: item.targetDate || "",
    }));
  }, [sortedItems]);

  const SortableHeader = ({ field, children }: { field: SortField; children: string }) => (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        className="no-default-hover-elevate no-default-active-elevate -ml-2 gap-1"
        onClick={() => handleSort(field)}
        data-testid={`button-sort-${field}`}
      >
        {children}
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
      </Button>
    </TableHead>
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ReportLayout
      title="Business Outcomes"
      description="Value-realisation progress across strategic outcomes, with status breakdown and achievement rate"
      csvData={csvData}
      csvColumns={csvColumns}
      csvFilename="business-outcomes"
      filters={
        <>
          <DropdownFilter
            label="Status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            testId="select-filter-status"
          />
          <ProjectFilter
            value={projectFilter}
            onValueChange={setProjectFilter}
            projects={projectOptions}
          />
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ReportStatCard
            title="Total Outcomes"
            value={isLoading ? "-" : summary?.total ?? 0}
            icon={<Target className="w-5 h-5 text-primary" />}
            testId="stat-total-outcomes"
          />
          <ReportStatCard
            title="Achieved"
            value={isLoading ? "-" : summary?.byStatus.achieved ?? 0}
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            testId="stat-achieved-outcomes"
          />
          <ReportStatCard
            title="Achievement Rate"
            value={isLoading ? "-" : `${summary?.achievementRate ?? 0}%`}
            icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
            testId="stat-achievement-rate"
          />
          <ReportStatCard
            title="At Risk"
            value={isLoading ? "-" : summary?.atRiskCount ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            testId="stat-at-risk-outcomes"
          />
        </div>

        <Card data-testid="card-status-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Outcomes by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ReportBarChart data={statusChartData} />
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="outcomes-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-testid="outcomes-empty"
          >
            No business outcomes found matching the selected filters.
          </div>
        ) : (
          <div className="border rounded-md" data-testid="outcomes-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="title">Outcome</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  <SortableHeader field="linkedName">Linked To</SortableHeader>
                  <TableHead>Metric</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Current</TableHead>
                  <SortableHeader field="ownerName">Owner</SortableHeader>
                  <SortableHeader field="targetDate">Target Date</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => {
                  const statusConf = STATUS_CONFIG[item.status] || {
                    label: item.status,
                    color: "bg-muted text-muted-foreground",
                  };
                  return (
                    <TableRow
                      key={item.id}
                      className="table-row-hover"
                      data-testid={`row-outcome-${item.id}`}
                    >
                      <TableCell
                        className="font-medium max-w-[220px] truncate"
                        data-testid={`text-title-${item.id}`}
                      >
                        {item.title}
                      </TableCell>
                      <TableCell data-testid={`badge-status-${item.id}`}>
                        <Badge variant="outline" className={`${statusConf.color} border-0 text-xs`}>
                          {statusConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate"
                        data-testid={`text-linked-${item.id}`}
                      >
                        {item.linkedName ? (
                          <span>
                            <span className="text-muted-foreground text-xs">
                              {item.linkedType ? `${LINKED_TYPE_LABEL[item.linkedType] || item.linkedType}: ` : ""}
                            </span>
                            {item.linkedName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate"
                        data-testid={`text-metric-${item.id}`}
                      >
                        {item.successMetric || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-target-${item.id}`}>
                        {item.target || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-current-${item.id}`}>
                        {item.currentValue || "-"}
                      </TableCell>
                      <TableCell
                        className="max-w-[140px] truncate"
                        data-testid={`text-owner-${item.id}`}
                      >
                        {item.ownerName || "-"}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap"
                        data-testid={`text-target-date-${item.id}`}
                      >
                        {formatDate(item.targetDate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground" data-testid="text-outcomes-count">
          {sortedItems.length} outcome{sortedItems.length !== 1 ? "s" : ""} shown
        </div>
      </div>
    </ReportLayout>
  );
}
