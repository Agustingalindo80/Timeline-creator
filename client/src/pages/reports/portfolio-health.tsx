import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Activity, FolderKanban, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { ReportLayout } from "@/components/reports/report-layout";
import { HealthPieChart, ReportStatCard, HealthDot } from "@/components/reports/report-charts";
import { DropdownFilter, HealthFilter } from "@/components/reports/report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioProject {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  region: string | null;
  healthOverall: string;
  scopeHealth: string;
  budgetHealth: string;
  teamHealth: string;
  projectStatus: string;
  startDate: string | null;
  endDate: string | null;
  flightpathStageId: string | null;
  approvedBudget: string | null;
  totalRunningCost: string | null;
  grossMargin: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function PortfolioHealthReport() {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryParams = new URLSearchParams();
  if (clientFilter !== "all") queryParams.set("clientId", clientFilter);
  if (regionFilter !== "all") queryParams.set("region", regionFilter);
  if (healthFilter !== "all") queryParams.set("healthFilter", healthFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const queryString = queryParams.toString();
  const url = `/api/reports/portfolio-health${queryString ? `?${queryString}` : ""}`;

  const { data: projects = [], isLoading } = useQuery<PortfolioProject[]>({
    queryKey: ["/api/reports/portfolio-health", clientFilter, regionFilter, healthFilter, statusFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: allProjects = [] } = useQuery<PortfolioProject[]>({
    queryKey: ["/api/reports/portfolio-health"],
  });

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    allProjects.forEach((p) => {
      if (p.clientId && p.clientName) map.set(p.clientId, p.clientName);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allProjects]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => {
      if (p.region) set.add(p.region);
    });
    return Array.from(set).sort();
  }, [allProjects]);

  const greenCount = projects.filter((p) => p.healthOverall === "green").length;
  const amberCount = projects.filter((p) => p.healthOverall === "amber").length;
  const redCount = projects.filter((p) => p.healthOverall === "red").length;

  const pieData = [
    { name: "Green", value: greenCount },
    { name: "Amber", value: amberCount },
    { name: "Red", value: redCount },
  ];

  const csvColumns = [
    { key: "title", label: "Project" },
    { key: "clientName", label: t("common.client") },
    { key: "region", label: "Region" },
    { key: "healthOverall", label: "Overall Health" },
    { key: "scopeHealth", label: "Scope" },
    { key: "budgetHealth", label: "Budget" },
    { key: "teamHealth", label: "Team" },
    { key: "projectStatus", label: "Status" },
    { key: "startDate", label: "Start Date" },
    { key: "endDate", label: "End Date" },
  ];

  const csvData = projects.map((p) => ({
    ...p,
    projectStatus: STATUS_LABELS[p.projectStatus] || p.projectStatus,
  }));

  const filters = (
    <>
      <DropdownFilter
        label={t("common.client")}
        value={clientFilter}
        onValueChange={setClientFilter}
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
        placeholder={t("reports.allClients")}
        testId="select-filter-client"
      />
      <DropdownFilter
        label="Region"
        value={regionFilter}
        onValueChange={setRegionFilter}
        options={regions.map((r) => ({ value: r, label: r }))}
        placeholder="All Regions"
        testId="select-filter-region"
      />
      <HealthFilter value={healthFilter} onValueChange={setHealthFilter} />
      <DropdownFilter
        label="Status"
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[
          { value: "not_started", label: "Not Started" },
          { value: "in_progress", label: "In Progress" },
          { value: "completed", label: "Completed" },
        ]}
        placeholder="All Statuses"
        testId="select-filter-status"
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Portfolio Health | Reports</title>
      </Helmet>
      <ReportLayout
        ref={contentRef}
        title="Portfolio Health Dashboard"
        description="Overview of all projects with health indicators, stages, and status across the portfolio."
        filters={filters}
        csvData={csvData}
        csvColumns={csvColumns}
        csvFilename="portfolio-health"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ReportStatCard
              title="Total Projects"
              value={projects.length}
              icon={<FolderKanban className="w-5 h-5 text-primary" />}
              testId="stat-total-projects"
            />
            <ReportStatCard
              title="Green"
              value={greenCount}
              icon={<ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              valueClassName="text-emerald-600 dark:text-emerald-400"
              testId="stat-green-count"
            />
            <ReportStatCard
              title="Amber"
              value={amberCount}
              icon={<AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
              valueClassName="text-amber-500 dark:text-amber-400"
              testId="stat-amber-count"
            />
            <ReportStatCard
              title="Red"
              value={redCount}
              icon={<XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
              valueClassName="text-red-500 dark:text-red-400"
              testId="stat-red-count"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthPieChart data={pieData} height={240} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Projects ({projects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="table-header-cell" data-testid="th-project">Project</TableHead>
                      <TableHead className="table-header-cell" data-testid="th-client">Client</TableHead>
                      <TableHead className="table-header-cell" data-testid="th-region">Region</TableHead>
                      <TableHead className="table-header-cell text-center" data-testid="th-overall">Overall</TableHead>
                      <TableHead className="table-header-cell text-center" data-testid="th-scope">Scope</TableHead>
                      <TableHead className="table-header-cell text-center" data-testid="th-budget">Budget</TableHead>
                      <TableHead className="table-header-cell text-center" data-testid="th-team">Team</TableHead>
                      <TableHead className="table-header-cell" data-testid="th-status">Status</TableHead>
                      <TableHead className="table-header-cell" data-testid="th-start">Start</TableHead>
                      <TableHead className="table-header-cell" data-testid="th-end">End</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8" data-testid="text-no-projects">
                          No projects found matching the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((project) => (
                        <TableRow key={project.id} className="table-row-hover" data-testid={`row-project-${project.id}`}>
                          <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-project-name-${project.id}`}>
                            {project.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[150px] truncate" data-testid={`text-client-${project.id}`}>
                            {project.clientName || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-region-${project.id}`}>
                            {project.region || "\u2014"}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`health-overall-${project.id}`}>
                            <div className="flex justify-center">
                              <HealthDot health={project.healthOverall} size="md" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center" data-testid={`health-scope-${project.id}`}>
                            <div className="flex justify-center">
                              <HealthDot health={project.scopeHealth} />
                            </div>
                          </TableCell>
                          <TableCell className="text-center" data-testid={`health-budget-${project.id}`}>
                            <div className="flex justify-center">
                              <HealthDot health={project.budgetHealth} />
                            </div>
                          </TableCell>
                          <TableCell className="text-center" data-testid={`health-team-${project.id}`}>
                            <div className="flex justify-center">
                              <HealthDot health={project.teamHealth} />
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-status-${project.id}`}>
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                              {STATUS_LABELS[project.projectStatus] || project.projectStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums whitespace-nowrap" data-testid={`text-start-${project.id}`}>
                            {project.startDate || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums whitespace-nowrap" data-testid={`text-end-${project.id}`}>
                            {project.endDate || "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </ReportLayout>
    </>
  );
}
