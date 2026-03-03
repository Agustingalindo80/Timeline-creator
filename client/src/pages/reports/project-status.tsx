import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ReportLayout } from "@/components/reports/report-layout";
import { ReportStatCard, HealthDot } from "@/components/reports/report-charts";
import { DropdownFilter } from "@/components/reports/report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Users,
  DollarSign,
  Target,
  Milestone,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface ProjectStatusData {
  id: string;
  title: string;
  clientName: string | null;
  region: string | null;
  healthOverall: string | null;
  scopeHealth: string | null;
  budgetHealth: string | null;
  teamHealth: string | null;
  projectStatus: string | null;
  flightpathStageId: string | null;
  startDate: string | null;
  endDate: string | null;
  approvedBudget: string | null;
  totalRunningCost: string | null;
  grossMargin: string | null;
  tasksSummary: {
    total: number;
    complete: number;
    inProgress: number;
    notStarted: number;
    percentComplete: number;
  };
  milestonesSummary: {
    total: number;
    upcoming: number;
    overdue: number;
  };
  raidSummary: {
    openRisks: number;
    openIssues: number;
    openDependencies: number;
  };
  evm: {
    cpi: string | null;
    spi: string | null;
    weekEnding: string | null;
  } | null;
  teamMemberCount: number;
}

interface ProjectOption {
  id: string;
  title: string;
}

function formatCurrency(val: string | null | undefined): string {
  if (!val) return "$0";
  const num = parseFloat(val);
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercent(val: string | null | undefined): string {
  if (!val) return "0%";
  const num = parseFloat(val);
  if (isNaN(num)) return "0%";
  return `${num.toFixed(1)}%`;
}

function getEvmColor(val: string | null | undefined): string {
  if (!val) return "";
  const num = parseFloat(val);
  if (isNaN(num)) return "";
  if (num >= 1.0) return "metric-positive";
  if (num >= 0.9) return "metric-warning";
  return "metric-negative";
}

export default function ProjectStatusReport() {
  const { t } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState("all");

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectOption[]>({
    queryKey: ["/api/timelines"],
    select: (data: any[]) =>
      data
        .filter((t: any) => t.recordType === "project")
        .map((t: any) => ({ id: t.id, title: t.title })),
  });

  const projectId = selectedProjectId !== "all" ? selectedProjectId : null;

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useQuery<ProjectStatusData>({
    queryKey: ["/api/reports/project-status", projectId],
    enabled: !!projectId,
  });

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.title,
  }));

  return (
    <ReportLayout
      title="Project Status Report"
      description="Comprehensive single-project snapshot with health, financials, tasks, milestones, and RAID summary"
    >
      <div className="space-y-6">
        <div data-testid="project-selector-section">
          <DropdownFilter
            label="Select Project"
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            options={projectOptions}
            placeholder="Select a project"
            testId="select-project"
          />
        </div>

        {projectsLoading && (
          <div className="space-y-4" data-testid="loading-skeleton">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        )}

        {!projectId && !projectsLoading && (
          <Card data-testid="prompt-select-project">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-8">
                <Activity className="w-10 h-10 opacity-40" />
                <p className="text-sm">Select a project above to view its status report</p>
              </div>
            </CardContent>
          </Card>
        )}

        {projectId && reportLoading && (
          <div className="space-y-4" data-testid="loading-report">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        )}

        {reportError && (
          <Card data-testid="error-message">
            <CardContent className="pt-6 pb-6">
              <p className="text-sm text-destructive text-center">
                Failed to load project status. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {report && (
          <div className="space-y-6 fade-in" data-testid="report-data">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold" data-testid="text-project-title">
                  {report.title}
                </h2>
                {report.clientName && (
                  <p className="text-sm text-muted-foreground" data-testid="text-client-name">
                    {report.clientName}
                    {report.region && ` \u2014 ${report.region}`}
                  </p>
                )}
              </div>
              {report.projectStatus && (
                <Badge variant="outline" data-testid="badge-project-status">
                  {report.projectStatus}
                </Badge>
              )}
            </div>

            <Card data-testid="card-health-indicators">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Health Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2" data-testid="health-overall">
                    <HealthDot health={report.healthOverall} size="md" />
                    <span className="text-sm font-medium">Overall</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="health-scope">
                    <HealthDot health={report.scopeHealth} size="md" />
                    <span className="text-sm font-medium">Scope</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="health-budget">
                    <HealthDot health={report.budgetHealth} size="md" />
                    <span className="text-sm font-medium">Budget</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="health-team">
                    <HealthDot health={report.teamHealth} size="md" />
                    <span className="text-sm font-medium">Team</span>
                  </div>
                  {report.flightpathStageId && (
                    <Badge variant="secondary" data-testid="badge-governance-stage">
                      Stage: {report.flightpathStageId}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="section-financials">
              <ReportStatCard
                title="Approved Budget"
                value={formatCurrency(report.approvedBudget)}
                icon={<DollarSign className="w-5 h-5 text-primary" />}
                testId="stat-approved-budget"
              />
              <ReportStatCard
                title="Running Cost"
                value={formatCurrency(report.totalRunningCost)}
                icon={<DollarSign className="w-5 h-5 text-primary" />}
                testId="stat-running-cost"
              />
              <ReportStatCard
                title="Gross Margin"
                value={formatPercent(report.grossMargin)}
                icon={<Target className="w-5 h-5 text-primary" />}
                valueClassName={
                  report.grossMargin
                    ? parseFloat(report.grossMargin) >= 0
                      ? "metric-positive"
                      : "metric-negative"
                    : ""
                }
                testId="stat-gross-margin"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-tasks-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Tasks Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Total Tasks</span>
                      <span className="text-sm font-semibold tabular-nums" data-testid="text-tasks-total">
                        {report.tasksSummary.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Complete</span>
                      <span className="text-sm font-semibold tabular-nums metric-positive" data-testid="text-tasks-complete">
                        {report.tasksSummary.complete}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">In Progress</span>
                      <span className="text-sm font-semibold tabular-nums metric-warning" data-testid="text-tasks-in-progress">
                        {report.tasksSummary.inProgress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Not Started</span>
                      <span className="text-sm font-semibold tabular-nums" data-testid="text-tasks-not-started">
                        {report.tasksSummary.notStarted}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Overall Complete</span>
                        <span className="text-lg font-bold tabular-nums" data-testid="text-tasks-percent">
                          {report.tasksSummary.percentComplete}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full">
                        <div
                          className="h-2 bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${report.tasksSummary.percentComplete}%` }}
                          data-testid="progress-tasks"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-milestones-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Milestone className="w-4 h-4" />
                    Milestones Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Total Milestones</span>
                      <span className="text-sm font-semibold tabular-nums" data-testid="text-milestones-total">
                        {report.milestonesSummary.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Upcoming (30 days)</span>
                      <span className="text-sm font-semibold tabular-nums metric-warning" data-testid="text-milestones-upcoming">
                        {report.milestonesSummary.upcoming}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Overdue</span>
                      <span className="text-sm font-semibold tabular-nums metric-negative" data-testid="text-milestones-overdue">
                        {report.milestonesSummary.overdue}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-raid-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    RAID Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Open Risks</span>
                      <Badge variant="destructive" data-testid="text-raid-risks">
                        {report.raidSummary.openRisks}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Open Issues</span>
                      <Badge variant="secondary" data-testid="text-raid-issues">
                        {report.raidSummary.openIssues}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Open Dependencies</span>
                      <Badge variant="secondary" data-testid="text-raid-dependencies">
                        {report.raidSummary.openDependencies}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-evm-team">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    EVM & Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.evm ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            CPI
                            {report.evm.cpi && parseFloat(report.evm.cpi) >= 1.0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${getEvmColor(report.evm.cpi)}`}
                            data-testid="text-evm-cpi"
                          >
                            {report.evm.cpi ? parseFloat(report.evm.cpi).toFixed(2) : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            SPI
                            {report.evm.spi && parseFloat(report.evm.spi) >= 1.0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${getEvmColor(report.evm.spi)}`}
                            data-testid="text-evm-spi"
                          >
                            {report.evm.spi ? parseFloat(report.evm.spi).toFixed(2) : "N/A"}
                          </span>
                        </div>
                        {report.evm.weekEnding && (
                          <p className="text-xs text-muted-foreground pt-1" data-testid="text-evm-week">
                            Week ending: {report.evm.weekEnding}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-evm-none">
                        No EVM data available
                      </p>
                    )}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Team Members
                        </span>
                        <span className="text-sm font-semibold tabular-nums" data-testid="text-team-count">
                          {report.teamMemberCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(report.startDate || report.endDate) && (
              <Card data-testid="card-dates">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    {report.startDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Start Date</p>
                        <p className="text-sm font-medium" data-testid="text-start-date">
                          {report.startDate}
                        </p>
                      </div>
                    )}
                    {report.endDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">End Date</p>
                        <p className="text-sm font-medium" data-testid="text-end-date">
                          {report.endDate}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
