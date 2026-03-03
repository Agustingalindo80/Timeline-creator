import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ReportLayout } from "@/components/reports/report-layout";
import { ReportStatCard } from "@/components/reports/report-charts";
import { DateRangeFilter, ProjectFilter, ToggleFilter } from "@/components/reports/report-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, Clock, AlertTriangle, DollarSign, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MilestoneRow {
  id: string;
  timelineId: string;
  projectName: string;
  title: string;
  date: string;
  actualDate: string | null;
  status: "upcoming" | "overdue" | "completed";
  isFinancialObligation: boolean;
  amount: string | null;
}

type SortKey = "date" | "amount" | "projectName";
type SortDir = "asc" | "desc";

export default function MilestoneTrackerReport() {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [financialOnly, setFinancialOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (projectId !== "all") queryParams.set("projectId", projectId);
  if (financialOnly) queryParams.set("financialOnly", "true");

  const queryString = queryParams.toString();

  const { data: milestones, isLoading } = useQuery<MilestoneRow[]>({
    queryKey: ["/api/reports/milestones", queryString],
    queryFn: async () => {
      const url = `/api/reports/milestones${queryString ? `?${queryString}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: projects } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/timelines"],
  });

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ id: p.id, name: p.title })),
    [projects]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedMilestones = useMemo(() => {
    if (!milestones) return [];
    const sorted = [...milestones];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === "amount") {
        const aVal = parseFloat(a.amount || "0") || 0;
        const bVal = parseFloat(b.amount || "0") || 0;
        cmp = aVal - bVal;
      } else if (sortKey === "projectName") {
        cmp = a.projectName.localeCompare(b.projectName);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [milestones, sortKey, sortDir]);

  const totalMilestones = milestones?.length || 0;
  const upcomingCount = milestones?.filter((m) => m.status === "upcoming").length || 0;
  const overdueCount = milestones?.filter((m) => m.status === "overdue").length || 0;
  const financialTotal = milestones
    ?.filter((m) => m.isFinancialObligation && m.amount)
    .reduce((sum, m) => sum + (parseFloat(m.amount!) || 0), 0) || 0;

  const csvColumns = [
    { key: "projectName", label: "Project" },
    { key: "title", label: "Milestone" },
    { key: "date", label: "Planned Date" },
    { key: "actualDate", label: "Actual Date" },
    { key: "status", label: "Status" },
    { key: "isFinancialObligation", label: "Financial Obligation" },
    { key: "amount", label: "Amount" },
  ];

  const csvData = sortedMilestones.map((m) => ({
    projectName: m.projectName,
    title: m.title,
    date: m.date,
    actualDate: m.actualDate || "",
    status: m.status,
    isFinancialObligation: m.isFinancialObligation ? "Yes" : "No",
    amount: m.amount || "",
  }));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const statusBadge = (status: string) => {
    if (status === "completed") {
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" data-testid={`badge-status-${status}`}>Completed</Badge>;
    }
    if (status === "overdue") {
      return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" data-testid={`badge-status-${status}`}>Overdue</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-status-${status}`}>Upcoming</Badge>;
  };

  const SortButton = ({ label, column }: { label: string; column: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="no-default-hover-elevate no-default-active-elevate -ml-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground"
      onClick={() => toggleSort(column)}
      data-testid={`button-sort-${column}`}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <ReportLayout
      ref={contentRef}
      title="Milestone Tracker"
      description="Track milestones across all projects with status and financial obligation details."
      csvData={csvData}
      csvColumns={csvColumns}
      csvFilename="milestone-tracker"
      filters={
        <>
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
          <ProjectFilter
            value={projectId}
            onValueChange={setProjectId}
            projects={projectOptions}
          />
          <ToggleFilter
            label="Financial Only"
            checked={financialOnly}
            onCheckedChange={setFinancialOnly}
            testId="switch-filter-financial-only"
          />
        </>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-4 pb-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="milestone-kpi-cards">
              <ReportStatCard
                title="Total Milestones"
                value={totalMilestones}
                icon={<CalendarCheck className="h-5 w-5 text-primary" />}
                testId="stat-total-milestones"
              />
              <ReportStatCard
                title="Upcoming (30d)"
                value={upcomingCount}
                icon={<Clock className="h-5 w-5 text-blue-500" />}
                testId="stat-upcoming-milestones"
              />
              <ReportStatCard
                title="Overdue"
                value={overdueCount}
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                valueClassName={overdueCount > 0 ? "text-red-500 dark:text-red-400" : ""}
                testId="stat-overdue-milestones"
              />
              <ReportStatCard
                title="Financial Total"
                value={formatCurrency(String(financialTotal))}
                icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
                testId="stat-financial-total"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table data-testid="table-milestones">
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortButton label="Project" column="projectName" /></TableHead>
                        <TableHead className="table-header-cell">Milestone</TableHead>
                        <TableHead><SortButton label="Planned Date" column="date" /></TableHead>
                        <TableHead className="table-header-cell">Actual Date</TableHead>
                        <TableHead className="table-header-cell">Status</TableHead>
                        <TableHead className="table-header-cell">Financial</TableHead>
                        <TableHead><SortButton label="Amount" column="amount" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedMilestones.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8" data-testid="text-no-milestones">
                            No milestones found matching the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedMilestones.map((m) => (
                          <TableRow
                            key={m.id}
                            className={`table-row-hover ${m.status === "overdue" ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                            data-testid={`row-milestone-${m.id}`}
                          >
                            <TableCell className="font-medium" data-testid={`text-project-${m.id}`}>{m.projectName}</TableCell>
                            <TableCell data-testid={`text-milestone-${m.id}`}>{m.title}</TableCell>
                            <TableCell className="tabular-nums whitespace-nowrap" data-testid={`text-date-${m.id}`}>{formatDate(m.date)}</TableCell>
                            <TableCell className="tabular-nums whitespace-nowrap" data-testid={`text-actual-date-${m.id}`}>
                              {m.actualDate ? formatDate(m.actualDate) : "-"}
                            </TableCell>
                            <TableCell>{statusBadge(m.status)}</TableCell>
                            <TableCell data-testid={`text-financial-${m.id}`}>
                              {m.isFinancialObligation ? (
                                <Badge variant="outline" className="text-xs">Yes</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">No</span>
                              )}
                            </TableCell>
                            <TableCell className="table-financial" data-testid={`text-amount-${m.id}`}>
                              {formatCurrency(m.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ReportLayout>
  );
}
