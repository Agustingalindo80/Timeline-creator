import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { HealthDot } from "@/components/reports/report-charts";
import { DropdownFilter, HealthFilter } from "@/components/reports/report-filters";
import { ExecutiveSummaryHeader } from "@/features/portfolio-health/ExecutiveSummaryHeader";
import { KpiCards } from "@/features/portfolio-health/KpiCards";
import { ExecutivePanels, ExecutivePanelsSkeleton } from "@/features/portfolio-health/ExecutivePanels";
import {
  StageDistribution,
  DimensionHeatmap,
  FlightPathFlowSkeleton,
} from "@/features/portfolio-health/FlightPathFlow";
import type { PortfolioOverview } from "@/features/portfolio-health/types";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildHealthTrend } from "@shared/health-trend";

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

interface PortfolioRollup {
  key: string;
  label: string;
  total: number;
  green: number;
  amber: number;
  red: number;
  totalBudget: number;
}

interface PortfolioHealthResponse {
  projects: PortfolioProject[];
  rollups: { byClient: PortfolioRollup[]; byRegion: PortfolioRollup[] };
  history: HealthHistoryRecord[];
  historyFrom: string;
}

interface HealthHistoryRecord {
  id: string;
  timelineId: string;
  healthOverall: string;
  scopeHealth: string;
  budgetHealth: string;
  teamHealth: string;
  recordedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const HEALTH_COLORS: Record<string, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
};

const HEALTH_RANK: Record<string, number> = { green: 0, amber: 1, red: 2 };

type SortKey =
  | "title"
  | "clientName"
  | "region"
  | "healthOverall"
  | "scopeHealth"
  | "budgetHealth"
  | "teamHealth"
  | "projectStatus"
  | "approvedBudget";

function num(v: string | null): number {
  return parseFloat(v || "0") || 0;
}

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function RollupTable({ title, rows, testId }: { title: string; rows: PortfolioRollup[]; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header-cell">{title.replace(/^By /, "")}</TableHead>
                <TableHead className="table-header-cell text-center">Total</TableHead>
                <TableHead className="table-header-cell text-center">RAG</TableHead>
                <TableHead className="table-header-cell text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No data available.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.key} className="table-row-hover" data-testid={`rollup-row-${r.key}`}>
                    <TableCell className="font-medium max-w-[200px] truncate">{r.label}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.total}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2 text-xs tabular-nums">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />{r.green}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />{r.amber}
                        </span>
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-500" />{r.red}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatCurrency(r.totalBudget)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortfolioHealth() {
  const { t } = useTranslation();
  const [clientFilter, setClientFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("healthOverall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError, refetch } = useQuery<PortfolioHealthResponse>({
    queryKey: ["/api/dashboard/portfolio-health"],
  });

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
  } = useQuery<PortfolioOverview>({
    queryKey: ["/api/dashboard/portfolio-overview"],
  });

  const projects = data?.projects ?? [];
  const history = data?.history ?? [];
  const from = data?.historyFrom;

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => {
      if (p.clientId && p.clientName) map.set(p.clientId, p.clientName);
    });
    return Array.from(map, ([id, name]) => ({ value: id, label: name }));
  }, [projects]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.region) set.add(p.region);
    });
    return Array.from(set).sort().map((r) => ({ value: r, label: r }));
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (clientFilter !== "all" && p.clientId !== clientFilter) return false;
      if (regionFilter !== "all" && p.region !== regionFilter) return false;
      if (healthFilter !== "all" && p.healthOverall !== healthFilter) return false;
      if (statusFilter !== "all" && p.projectStatus !== statusFilter) return false;
      return true;
    });
  }, [projects, clientFilter, regionFilter, healthFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "approvedBudget") {
        av = num(a.approvedBudget);
        bv = num(b.approvedBudget);
      } else if (
        sortKey === "healthOverall" ||
        sortKey === "scopeHealth" ||
        sortKey === "budgetHealth" ||
        sortKey === "teamHealth"
      ) {
        av = HEALTH_RANK[a[sortKey]] ?? -1;
        bv = HEALTH_RANK[b[sortKey]] ?? -1;
      } else {
        av = (a[sortKey] || "").toString().toLowerCase();
        bv = (b[sortKey] || "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const bubbleData = useMemo(() => {
    return filtered.map((p) => {
      const budget = num(p.approvedBudget);
      const cost = num(p.totalRunningCost);
      const margin = budget > 0 ? Math.round(((budget - cost) / budget) * 1000) / 10 : 0;
      return {
        x: budget,
        y: margin,
        z: Math.max(budget, 1),
        name: p.title,
        health: p.healthOverall,
      };
    });
  }, [filtered]);

  const trendData = useMemo(() => buildHealthTrend(history, from), [history, from]);

  const SortHeader = ({ label, sk, className }: { label: string; sk: SortKey; className?: string }) => (
    <TableHead className={`table-header-cell ${className || ""}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => toggleSort(sk)}
        data-testid={`sort-${sk}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sk ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-muted-foreground text-center">Failed to load portfolio health data.</p>
            <Button onClick={() => refetch()} data-testid="button-retry">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <Helmet>
        <title>Portfolio Health | Mission Control</title>
        <meta name="description" content="Portfolio-wide project health across all accessible projects: RAG status, quadrant analysis, client and region rollups, and trends over time." />
      </Helmet>

      {overview ? (
        <ExecutiveSummaryHeader header={overview.header} generatedAt={overview.generatedAt} />
      ) : overviewError ? (
        <Card data-testid="overview-error">
          <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Executive summary is temporarily unavailable. The data below is still up to date.</span>
          </CardContent>
        </Card>
      ) : (
        <Skeleton className="h-40 rounded-xl" />
      )}

      {overview ? (
        <KpiCards kpis={overview.kpis} />
      ) : overviewLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <ExecutivePanels panels={overview.panels} />
      ) : overviewError ? (
        <Card data-testid="panels-error">
          <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Executive panels are temporarily unavailable.</span>
          </CardContent>
        </Card>
      ) : overviewLoading ? (
        <ExecutivePanelsSkeleton />
      ) : null}

      {overview ? (
        <>
          <StageDistribution stages={overview.stages} />
          <DimensionHeatmap heatmap={overview.heatmap} />
        </>
      ) : overviewError ? (
        <Card data-testid="flow-error">
          <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Stage distribution and heatmap are temporarily unavailable.</span>
          </CardContent>
        </Card>
      ) : overviewLoading ? (
        <FlightPathFlowSkeleton />
      ) : null}

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <DropdownFilter
              label={t("common.client")}
              value={clientFilter}
              onValueChange={setClientFilter}
              options={clientOptions}
              placeholder="All Clients"
              testId="select-filter-client"
            />
            <DropdownFilter
              label="Region"
              value={regionFilter}
              onValueChange={setRegionFilter}
              options={regionOptions}
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-quadrant">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-primary" /> Budget vs Margin
            </CardTitle>
            <p className="text-xs text-muted-foreground">Bubble size = budget · colour = overall health</p>
          </CardHeader>
          <CardContent>
            {bubbleData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground" data-testid="quadrant-empty">
                No projects to plot.
              </div>
            ) : (
              <div style={{ height: 260 }} data-testid="chart-quadrant">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Budget"
                      tickFormatter={(v) => formatCurrency(Number(v))}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Margin"
                      unit="%"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <ZAxis type="number" dataKey="z" range={[60, 500]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "Budget") return [formatCurrency(value), name];
                        if (name === "Margin") return [`${value}%`, name];
                        return [value, name];
                      }}
                      labelFormatter={() => ""}
                    />
                    <Scatter data={bubbleData}>
                      {bubbleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={HEALTH_COLORS[entry.health] || "#9ca3af"} fillOpacity={0.7} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-primary" /> Health Trend (90 days)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Portfolio RAG composition over time</p>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground" data-testid="trend-empty">
                No health history recorded yet.
              </div>
            ) : (
              <div style={{ height: 260 }} data-testid="chart-trend">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="Green" stroke={HEALTH_COLORS.green} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Amber" stroke={HEALTH_COLORS.amber} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Red" stroke={HEALTH_COLORS.red} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RollupTable title="By Client" rows={data?.rollups.byClient ?? []} testId="rollup-by-client" />
        <RollupTable title="By Region" rows={data?.rollups.byRegion ?? []} testId="rollup-by-region" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Projects ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Project" sk="title" />
                  <SortHeader label={t("common.client")} sk="clientName" />
                  <SortHeader label="Region" sk="region" />
                  <SortHeader label="Overall" sk="healthOverall" className="text-center" />
                  <SortHeader label="Scope" sk="scopeHealth" className="text-center" />
                  <SortHeader label="Budget" sk="budgetHealth" className="text-center" />
                  <SortHeader label="Team" sk="teamHealth" className="text-center" />
                  <SortHeader label="Status" sk="projectStatus" />
                  <SortHeader label="Budget ($)" sk="approvedBudget" className="text-right" />
                  <TableHead className="table-header-cell" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8" data-testid="text-no-projects">
                      No projects found matching the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((project) => (
                    <TableRow key={project.id} className="table-row-hover" data-testid={`row-project-${project.id}`}>
                      <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-project-name-${project.id}`}>
                        <Link href={`/timeline/${project.id}`} className="hover:text-primary hover:underline">
                          {project.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate" data-testid={`text-client-${project.id}`}>
                        {project.clientName || "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-region-${project.id}`}>
                        {project.region || "\u2014"}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`health-overall-${project.id}`}>
                        <div className="flex justify-center"><HealthDot health={project.healthOverall} size="md" /></div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`health-scope-${project.id}`}>
                        <div className="flex justify-center"><HealthDot health={project.scopeHealth} /></div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`health-budget-${project.id}`}>
                        <div className="flex justify-center"><HealthDot health={project.budgetHealth} /></div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`health-team-${project.id}`}>
                        <div className="flex justify-center"><HealthDot health={project.teamHealth} /></div>
                      </TableCell>
                      <TableCell data-testid={`text-status-${project.id}`}>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {STATUS_LABELS[project.projectStatus] || project.projectStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs tabular-nums whitespace-nowrap" data-testid={`text-budget-${project.id}`}>
                        {project.approvedBudget ? formatCurrency(num(project.approvedBudget)) : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/timeline/${project.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`link-project-${project.id}`}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
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
  );
}
