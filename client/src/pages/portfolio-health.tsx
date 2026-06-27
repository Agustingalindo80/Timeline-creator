import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, ArrowUpDown, Search } from "lucide-react";
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
import { DropdownFilter, DateRangeFilter } from "@/components/reports/report-filters";
import { ExecutiveSummaryHeader } from "@/features/portfolio-health/ExecutiveSummaryHeader";
import { KpiCards } from "@/features/portfolio-health/KpiCards";
import { ExecutivePanels, ExecutivePanelsSkeleton } from "@/features/portfolio-health/ExecutivePanels";
import {
  StageDistribution,
  DimensionHeatmap,
  FlightPathFlowSkeleton,
} from "@/features/portfolio-health/FlightPathFlow";
import { ProjectDrawer } from "@/features/portfolio-health/ProjectDrawer";
import { RAG_COLOR, RAG_LABEL, formatCurrency, type Rag } from "@/features/portfolio-health/theme";
import type { PortfolioOverview, PortfolioProjectOverview } from "@/features/portfolio-health/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { buildHealthTrend } from "@shared/health-trend";

interface PortfolioProjectLite {
  id: string;
  clientId: string | null;
  clientName: string | null;
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

interface PortfolioHealthResponse {
  projects: PortfolioProjectLite[];
  history: HealthHistoryRecord[];
  historyFrom: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const GATE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  exception_requested: "Exception",
  exception_approved: "Exc. Approved",
};

const HEALTH_COLORS: Record<string, string> = RAG_COLOR;
const RAG_RANK: Record<string, number> = { green: 0, amber: 1, red: 2, gray: 3 };

type SortKey =
  | "title"
  | "clientName"
  | "flightpathStageName"
  | "overallRag"
  | "approvedBudget"
  | "openCriticalRiskCount"
  | "currentGateStatus"
  | "projectStatus";

function num(v: string | null): number {
  return parseFloat(v || "0") || 0;
}

function ragDot(rag: Rag, size = 10) {
  return (
    <span
      className="rounded-full shrink-0 inline-block"
      style={{ width: size, height: size, backgroundColor: RAG_COLOR[rag] }}
    />
  );
}

interface Rollup {
  key: string;
  label: string;
  total: number;
  green: number;
  amber: number;
  red: number;
  totalBudget: number;
}

function buildRollups(
  projects: PortfolioProjectOverview[],
  keyFn: (p: PortfolioProjectOverview) => { key: string; label: string } | null,
): Rollup[] {
  const map = new Map<string, Rollup>();
  for (const p of projects) {
    const k = keyFn(p);
    if (!k) continue;
    const existing =
      map.get(k.key) ??
      { key: k.key, label: k.label, total: 0, green: 0, amber: 0, red: 0, totalBudget: 0 };
    existing.total += 1;
    if (p.overallRag === "green") existing.green += 1;
    else if (p.overallRag === "amber") existing.amber += 1;
    else if (p.overallRag === "red") existing.red += 1;
    existing.totalBudget += num(p.approvedBudget);
    map.set(k.key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function RollupTable({ title, rows, testId }: { title: string; rows: Rollup[]; testId: string }) {
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

  // Filter state (server-driven).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [ragFilter, setRagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("overallRag");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounce search input so we don't refetch on every keystroke.
  useEffect(() => {
    const h = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(h);
  }, [searchInput]);

  // Build the filter querystring as a SINGLE query-key element so the default
  // queryFn (which joins the key by "/") produces a valid URL.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (clientFilter !== "all") params.set("clientId", clientFilter);
    if (stageFilter !== "all") params.set("stageId", stageFilter);
    if (ragFilter !== "all") params.set("rag", ragFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [search, clientFilter, stageFilter, ragFilter, statusFilter, dateFrom, dateTo]);

  // Unfiltered: stable filter option lists + full trend history.
  const { data: baseData, isLoading: baseLoading, isError: baseError, refetch } =
    useQuery<PortfolioHealthResponse>({
      queryKey: ["/api/dashboard/portfolio-health"],
    });

  // Filtered: drives the WHOLE dashboard (header, KPIs, panels, stages, heatmap, table).
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: overviewError,
  } = useQuery<PortfolioOverview>({
    queryKey: [`/api/dashboard/portfolio-overview${queryString}`],
    placeholderData: keepPreviousData,
  });

  const overviewProjects = useMemo(() => overview?.projects ?? [], [overview]);
  const history = baseData?.history ?? [];
  const from = baseData?.historyFrom;

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    (baseData?.projects ?? []).forEach((p) => {
      if (p.clientId && p.clientName) map.set(p.clientId, p.clientName);
    });
    return Array.from(map, ([id, name]) => ({ value: id, label: name })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [baseData]);

  const stageOptions = useMemo(
    () => (overview?.stages ?? []).map((s) => ({ value: s.id, label: s.name })),
    [overview],
  );

  const sorted = useMemo(() => {
    const arr = [...overviewProjects];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "approvedBudget") {
        av = num(a.approvedBudget);
        bv = num(b.approvedBudget);
      } else if (sortKey === "openCriticalRiskCount") {
        av = a.openCriticalRiskCount;
        bv = b.openCriticalRiskCount;
      } else if (sortKey === "overallRag") {
        av = RAG_RANK[a.overallRag] ?? -1;
        bv = RAG_RANK[b.overallRag] ?? -1;
      } else {
        av = (a[sortKey] || "").toString().toLowerCase();
        bv = (b[sortKey] || "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [overviewProjects, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const bubbleData = useMemo(() => {
    return overviewProjects.map((p) => {
      const budget = num(p.approvedBudget);
      const cost = num(p.totalRunningCost);
      const margin = budget > 0 ? Math.round(((budget - cost) / budget) * 1000) / 10 : 0;
      return {
        x: budget,
        y: margin,
        z: Math.max(budget, 1),
        name: p.title,
        rag: p.overallRag,
      };
    });
  }, [overviewProjects]);

  // Trend is filtered to the active project set so it stays consistent with filters.
  const trendData = useMemo(() => {
    const ids = new Set(overviewProjects.map((p) => p.id));
    const filteredHistory = ids.size > 0 ? history.filter((h) => ids.has(h.timelineId)) : [];
    return buildHealthTrend(filteredHistory, from);
  }, [overviewProjects, history, from]);

  const byClient = useMemo(
    () =>
      buildRollups(overviewProjects, (p) =>
        p.clientId ? { key: p.clientId, label: p.clientName || "Unknown" } : null,
      ),
    [overviewProjects],
  );
  const byRegion = useMemo(
    () => buildRollups(overviewProjects, (p) => (p.region ? { key: p.region, label: p.region } : null)),
    [overviewProjects],
  );

  const selectedProject = useMemo(
    () => overviewProjects.find((p) => p.id === selectedId) ?? null,
    [overviewProjects, selectedId],
  );
  const selectedHeatmapRow = useMemo(
    () => overview?.heatmap.rows.find((r) => r.id === selectedId),
    [overview, selectedId],
  );

  const openDrawer = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  // If active filters remove the selected project, close the drawer to avoid an
  // open/empty sheet state.
  useEffect(() => {
    if (drawerOpen && selectedId && !overviewProjects.some((p) => p.id === selectedId)) {
      setDrawerOpen(false);
      setSelectedId(null);
    }
  }, [drawerOpen, selectedId, overviewProjects]);

  const hasActiveFilters =
    !!search ||
    clientFilter !== "all" ||
    stageFilter !== "all" ||
    ragFilter !== "all" ||
    statusFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setClientFilter("all");
    setStageFilter("all");
    setRagFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

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

  if (baseLoading) {
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

  if (baseError) {
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

      {/* Global filter bar — server-driven; drives the entire dashboard. */}
      <Card data-testid="filter-bar">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Project or client…"
                  className="w-56 pl-8"
                  data-testid="input-filter-search"
                />
              </div>
            </div>
            <DropdownFilter
              label={t("common.client")}
              value={clientFilter}
              onValueChange={setClientFilter}
              options={clientOptions}
              placeholder="All Clients"
              testId="select-filter-client"
            />
            <DropdownFilter
              label="FlightPath Stage"
              value={stageFilter}
              onValueChange={setStageFilter}
              options={stageOptions}
              placeholder="All Stages"
              testId="select-filter-stage"
            />
            <DropdownFilter
              label="Health"
              value={ragFilter}
              onValueChange={setRagFilter}
              options={[
                { value: "green", label: "On Track" },
                { value: "amber", label: "At Risk" },
                { value: "red", label: "Critical" },
                { value: "gray", label: "Insufficient Data" },
              ]}
              placeholder="All Health"
              testId="select-filter-health"
            />
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
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
            {/* Downstream filters (data models pending). */}
            <div className="space-y-1 opacity-50 pointer-events-none">
              <Label className="text-xs text-muted-foreground">Subsidiary</Label>
              <Input value="" placeholder="Coming soon" disabled className="w-40" data-testid="select-filter-subsidiary" />
            </div>
            <div className="space-y-1 opacity-50 pointer-events-none">
              <Label className="text-xs text-muted-foreground">Project Manager</Label>
              <Input value="" placeholder="Coming soon" disabled className="w-40" data-testid="select-filter-pm" />
            </div>
            <div className="space-y-1 opacity-50 pointer-events-none">
              <Label className="text-xs text-muted-foreground">Strategic Account</Label>
              <Input value="" placeholder="Coming soon" disabled className="w-40" data-testid="select-filter-strategic-account" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                Clear filters
              </Button>
            )}
            {overviewFetching && (
              <span className="text-xs text-muted-foreground" data-testid="text-filter-updating">
                Updating…
              </span>
            )}
          </div>
        </CardContent>
      </Card>

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
          <DimensionHeatmap heatmap={overview.heatmap} onSelectProject={openDrawer} />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-quadrant">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-primary" /> Budget vs Margin
            </CardTitle>
            <p className="text-xs text-muted-foreground">Bubble size = budget {"\u00b7"} colour = overall health</p>
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
                        <Cell key={`cell-${index}`} fill={HEALTH_COLORS[entry.rag] || "#9ca3af"} fillOpacity={0.7} />
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
        <RollupTable title="By Client" rows={byClient} testId="rollup-by-client" />
        <RollupTable title="By Region" rows={byRegion} testId="rollup-by-region" />
      </div>

      {/* Executive project table */}
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
                  <SortHeader label="Stage" sk="flightpathStageName" />
                  <SortHeader label="Health" sk="overallRag" className="text-center" />
                  <TableHead className="table-header-cell text-center">CPI / SPI</TableHead>
                  <SortHeader label="Budget" sk="approvedBudget" className="text-right" />
                  <TableHead className="table-header-cell text-right">Margin</TableHead>
                  <SortHeader label="Crit. Risks" sk="openCriticalRiskCount" className="text-center" />
                  <SortHeader label="Gate" sk="currentGateStatus" />
                  <TableHead className="table-header-cell">Next Milestone</TableHead>
                  <SortHeader label="Status" sk="projectStatus" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8" data-testid="text-no-projects">
                      No projects found matching the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((p) => {
                    const margin = p.grossMargin ? num(p.grossMargin) : null;
                    return (
                      <TableRow
                        key={p.id}
                        className="table-row-hover cursor-pointer"
                        onClick={() => openDrawer(p.id)}
                        data-testid={`row-project-${p.id}`}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-project-name-${p.id}`}>
                          {p.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate" data-testid={`text-client-${p.id}`}>
                          {p.clientName || "\u2014"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[140px] truncate">
                          {p.flightpathStageName || "\u2014"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`health-overall-${p.id}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            {ragDot(p.overallRag, 10)}
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {p.overallScore ?? "\u2014"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums whitespace-nowrap">
                          {p.evm
                            ? `${p.evm.cpi?.toFixed(2) ?? "\u2014"} / ${p.evm.spi?.toFixed(2) ?? "\u2014"}`
                            : <span className="text-muted-foreground/50">{"\u2014"}</span>}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs tabular-nums whitespace-nowrap" data-testid={`text-budget-${p.id}`}>
                          {p.approvedBudget ? formatCurrency(num(p.approvedBudget)) : <span className="text-muted-foreground/50">{"\u2014"}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                          {margin !== null ? formatCurrency(margin) : <span className="text-muted-foreground/50">{"\u2014"}</span>}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">
                          <span style={p.openCriticalRiskCount > 0 ? { color: RAG_COLOR.red } : undefined}>
                            {p.openCriticalRiskCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.currentGateStatus ? (
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                              {GATE_STATUS_LABELS[p.currentGateStatus] || p.currentGateStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap max-w-[150px] truncate">
                          {p.nextMilestone ? (
                            <span title={p.nextMilestone.title}>
                              {p.nextMilestone.date}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-status-${p.id}`}>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {STATUS_LABELS[p.projectStatus] || p.projectStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProjectDrawer
        project={selectedProject}
        heatmapRow={selectedHeatmapRow}
        heatmapColumns={overview?.heatmap.columns ?? []}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
