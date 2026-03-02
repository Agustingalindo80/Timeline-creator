import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReportLayout } from "@/components/reports/report-layout";
import { DropdownFilter, ProjectFilter } from "@/components/reports/report-filters";
import { ReportStatCard } from "@/components/reports/report-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, HelpCircle, Link2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RaidItem {
  id: string;
  timelineId: string;
  projectName: string;
  title: string;
  description: string | null;
  itemType: string;
  status: string;
  probability: string;
  impact: string;
  owner: string | null;
  dueDate: string | null;
  raisedDate: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  risk: { label: "Risk", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  issue: { label: "Issue", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: AlertCircle },
  assumption: { label: "Assumption", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: HelpCircle },
  dependency: { label: "Dependency", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Link2 },
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "closed", label: "Closed" },
  { value: "accepted", label: "Accepted" },
];

const TYPE_OPTIONS = [
  { value: "risk", label: "Risk" },
  { value: "issue", label: "Issue" },
  { value: "assumption", label: "Assumption" },
  { value: "dependency", label: "Dependency" },
];

type SortField = "projectName" | "itemType" | "status" | "probability" | "impact" | "dueDate" | "raisedDate";
type SortDirection = "asc" | "desc";

const PROBABILITY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const IMPACT_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export default function RaidSummaryReport() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("raisedDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.set("itemType", typeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (projectFilter !== "all") queryParams.set("projectId", projectFilter);

  const queryString = queryParams.toString();

  const { data: raidItems, isLoading } = useQuery<RaidItem[]>({
    queryKey: ["/api/reports/raid-summary", queryString],
    queryFn: async () => {
      const url = `/api/reports/raid-summary${queryString ? `?${queryString}` : ""}`;
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

  const sortedItems = useMemo(() => {
    if (!raidItems) return [];
    const sorted = [...raidItems];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "projectName":
          cmp = (a.projectName || "").localeCompare(b.projectName || "");
          break;
        case "itemType":
          cmp = (a.itemType || "").localeCompare(b.itemType || "");
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "probability":
          cmp = (PROBABILITY_ORDER[a.probability] || 0) - (PROBABILITY_ORDER[b.probability] || 0);
          break;
        case "impact":
          cmp = (IMPACT_ORDER[a.impact] || 0) - (IMPACT_ORDER[b.impact] || 0);
          break;
        case "dueDate":
          cmp = (a.dueDate || "").localeCompare(b.dueDate || "");
          break;
        case "raisedDate":
          cmp = (a.raisedDate || "").localeCompare(b.raisedDate || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [raidItems, sortField, sortDirection]);

  const kpis = useMemo(() => {
    if (!raidItems) return { risks: 0, issues: 0, assumptions: 0, dependencies: 0 };
    const openItems = raidItems.filter((r) => r.status === "open");
    return {
      risks: openItems.filter((r) => r.itemType === "risk").length,
      issues: openItems.filter((r) => r.itemType === "issue").length,
      assumptions: openItems.filter((r) => r.itemType === "assumption").length,
      dependencies: openItems.filter((r) => r.itemType === "dependency").length,
    };
  }, [raidItems]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const csvColumns = [
    { key: "projectName", label: "Project Name" },
    { key: "itemType", label: "Type" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "probability", label: "Probability" },
    { key: "impact", label: "Impact" },
    { key: "owner", label: "Owner" },
    { key: "dueDate", label: "Due Date" },
    { key: "raisedDate", label: "Raised Date" },
  ];

  const csvData = useMemo(() => {
    return sortedItems.map((item) => ({
      projectName: item.projectName,
      itemType: TYPE_CONFIG[item.itemType]?.label || item.itemType,
      title: item.title,
      status: item.status,
      probability: item.probability,
      impact: item.impact,
      owner: item.owner || "",
      dueDate: item.dueDate || "",
      raisedDate: item.raisedDate || "",
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
      title="RAID Summary"
      description="Overview of all Risks, Assumptions, Issues, and Dependencies across projects"
      csvData={csvData}
      csvColumns={csvColumns}
      csvFilename="raid-summary"
      filters={
        <>
          <DropdownFilter
            label="Type"
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={TYPE_OPTIONS}
            placeholder="All Types"
            testId="select-filter-type"
          />
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
            title="Open Risks"
            value={isLoading ? "-" : kpis.risks}
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            testId="stat-open-risks"
          />
          <ReportStatCard
            title="Open Issues"
            value={isLoading ? "-" : kpis.issues}
            icon={<AlertCircle className="w-5 h-5 text-orange-500" />}
            testId="stat-open-issues"
          />
          <ReportStatCard
            title="Open Assumptions"
            value={isLoading ? "-" : kpis.assumptions}
            icon={<HelpCircle className="w-5 h-5 text-blue-500" />}
            testId="stat-open-assumptions"
          />
          <ReportStatCard
            title="Open Dependencies"
            value={isLoading ? "-" : kpis.dependencies}
            icon={<Link2 className="w-5 h-5 text-purple-500" />}
            testId="stat-open-dependencies"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3" data-testid="raid-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-testid="raid-empty"
          >
            No RAID items found matching the selected filters.
          </div>
        ) : (
          <div className="border rounded-md" data-testid="raid-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="projectName">Project</SortableHeader>
                  <SortableHeader field="itemType">Type</SortableHeader>
                  <TableHead>Title</TableHead>
                  <SortableHeader field="status">Status</SortableHeader>
                  <SortableHeader field="probability">Probability</SortableHeader>
                  <SortableHeader field="impact">Impact</SortableHeader>
                  <TableHead>Owner</TableHead>
                  <SortableHeader field="dueDate">Due Date</SortableHeader>
                  <SortableHeader field="raisedDate">Raised Date</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => {
                  const typeConf = TYPE_CONFIG[item.itemType] || {
                    label: item.itemType,
                    color: "bg-muted text-muted-foreground",
                    icon: HelpCircle,
                  };
                  return (
                    <TableRow
                      key={item.id}
                      className="table-row-hover"
                      data-testid={`row-raid-${item.id}`}
                    >
                      <TableCell
                        className="font-medium max-w-[180px] truncate"
                        data-testid={`text-project-${item.id}`}
                      >
                        {item.projectName}
                      </TableCell>
                      <TableCell data-testid={`badge-type-${item.id}`}>
                        <Badge
                          variant="outline"
                          className={`${typeConf.color} border-0 text-xs`}
                        >
                          {typeConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[240px] truncate"
                        data-testid={`text-title-${item.id}`}
                      >
                        {item.title}
                      </TableCell>
                      <TableCell data-testid={`text-status-${item.id}`}>
                        <span className="capitalize text-sm">{item.status}</span>
                      </TableCell>
                      <TableCell data-testid={`text-probability-${item.id}`}>
                        <span className="capitalize text-sm">{item.probability}</span>
                      </TableCell>
                      <TableCell data-testid={`text-impact-${item.id}`}>
                        <span className="capitalize text-sm">{item.impact}</span>
                      </TableCell>
                      <TableCell
                        className="max-w-[140px] truncate"
                        data-testid={`text-owner-${item.id}`}
                      >
                        {item.owner || "-"}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap"
                        data-testid={`text-due-date-${item.id}`}
                      >
                        {formatDate(item.dueDate)}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap"
                        data-testid={`text-raised-date-${item.id}`}
                      >
                        {formatDate(item.raisedDate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground" data-testid="text-raid-count">
          {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""} shown
        </div>
      </div>
    </ReportLayout>
  );
}
