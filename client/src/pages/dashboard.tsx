import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  Target,
  FolderOpen,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTitle } from "@/hooks/use-app-title";
import type { TimelineWithMilestones, AppSettings } from "@shared/schema";

const OPP_STATUS_OPTIONS = [
  { value: "qualifying", label: "Qualifying", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "estimating", label: "Estimating", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "proposed", label: "Proposed", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "won", label: "Won", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "lost", label: "Lost", color: "bg-red-500/15 text-red-700 dark:text-red-300" },
];

const FUNNEL_BAR_COLORS = [
  "bg-blue-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-red-500",
];

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <Skeleton className="h-3.5 w-24 mb-3" />
        <Skeleton className="h-9 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 px-3">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16 ml-4" />
    </div>
  );
}

function formatCurrency(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatFullCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  "not_started": "Not Started",
  "in_progress": "In Progress",
  "on_hold": "On Hold",
  "complete": "Complete",
  "cancelled": "Cancelled",
};

export default function Dashboard() {
  const appTitle = useAppTitle("Dashboard");

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: opportunities = [], isLoading: oppsLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/opportunities"],
    enabled: !!(settings as any)?.opportunitiesEnabled,
  });

  const oppsEnabled = !!(settings as any)?.opportunitiesEnabled;

  const activeProjects = projects.filter(p => p.projectStatus !== "complete" && p.projectStatus !== "cancelled");
  const activeOpps = opportunities.filter(o => o.opportunityStatus !== "won" && o.opportunityStatus !== "lost");

  const pipelineValue = activeOpps.reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0);
  const totalProjectBudget = activeProjects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || "0") || 0), 0);

  const oppsByStatus = OPP_STATUS_OPTIONS.map((s, i) => ({
    ...s,
    barColor: FUNNEL_BAR_COLORS[i],
    count: opportunities.filter(o => o.opportunityStatus === s.value).length,
    revenue: opportunities.filter(o => o.opportunityStatus === s.value).reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0),
  }));

  const maxFunnelCount = Math.max(...oppsByStatus.map(s => s.count), 1);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of projects and pipeline</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${oppsEnabled ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}>
        {projectsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            {oppsEnabled && <MetricCardSkeleton />}
            {oppsEnabled && <MetricCardSkeleton />}
          </>
        ) : (
          <>
            <Card data-testid="card-active-projects">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Active Projects
                </div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">{activeProjects.length}</div>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <span>{projects.length} total</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-budget">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Total Budget
                </div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">
                  {formatCurrency(totalProjectBudget)}
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <span>across {activeProjects.length} projects</span>
                </div>
              </CardContent>
            </Card>

            {oppsEnabled && (
              <>
                <Card data-testid="card-active-opportunities">
                  <CardContent className="pt-5 pb-5">
                    <div className="metric-label mb-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      Active Opportunities
                    </div>
                    <div className="text-3xl font-bold tracking-tight tabular-nums">{activeOpps.length}</div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <span>{opportunities.length} total</span>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-pipeline-value">
                  <CardContent className="pt-5 pb-5">
                    <div className="metric-label mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Pipeline Value
                    </div>
                    <div className="text-3xl font-bold tracking-tight tabular-nums text-primary">
                      {formatCurrency(pipelineValue)}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <span>{activeOpps.length} active deals</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      {oppsEnabled && opportunities.length > 0 && (
        <Card data-testid="card-pipeline-funnel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5" /> Pipeline Funnel
              </span>
              <Link href="/opportunities">
                <Button variant="ghost" size="sm" data-testid="link-view-all-opportunities">
                  View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {oppsByStatus.map(s => (
                <div key={s.value} className="space-y-2" data-testid={`pipeline-stage-${s.value}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.barColor} transition-all duration-500`}
                      style={{ width: `${(s.count / maxFunnelCount) * 100}%` }}
                    />
                  </div>
                  {s.revenue > 0 && (
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCurrency(s.revenue)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-recent-projects">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <FolderOpen className="w-3.5 h-3.5" /> Recent Projects
              </span>
              <Link href="/projects">
                <Button variant="ghost" size="sm" data-testid="link-view-all-projects">
                  View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3, 4].map(i => <ListRowSkeleton key={i} />)}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <FolderOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No active projects</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeProjects.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/timeline/${p.id}`}>
                    <div className="flex items-center justify-between py-3 px-2 rounded-md hover-elevate cursor-pointer group" data-testid={`project-row-${p.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {PROJECT_STATUS_LABELS[p.projectStatus || ""] || p.projectStatus || "Not started"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {p.approvedBudget && (
                          <span className="text-sm font-medium tabular-nums">
                            {formatFullCurrency(parseFloat(p.approvedBudget))}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 invisible group-hover:visible" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {oppsEnabled && (
          <Card data-testid="card-recent-opportunities">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5" /> Recent Opportunities
                </span>
                <Link href="/opportunities">
                  <Button variant="ghost" size="sm" data-testid="link-view-recent-opps">
                    View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oppsLoading ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3, 4].map(i => <ListRowSkeleton key={i} />)}
                </div>
              ) : opportunities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Target className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No opportunities yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {opportunities.slice(0, 5).map(o => {
                    const statusOpt = OPP_STATUS_OPTIONS.find(s => s.value === o.opportunityStatus);
                    return (
                      <Link key={o.id} href={`/opportunities/${o.id}`}>
                        <div className="flex items-center justify-between py-3 px-2 rounded-md hover-elevate cursor-pointer group" data-testid={`opp-row-${o.id}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{o.title}</span>
                              {statusOpt && (
                                <Badge className={`${statusOpt.color} border-0 text-[10px]`} variant="secondary">
                                  {statusOpt.label}
                                </Badge>
                              )}
                            </div>
                            {(o as any).clientName && (
                              <div className="text-xs text-muted-foreground mt-0.5">{(o as any).clientName}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {o.estimatedRevenue && (
                              <span className="text-sm font-medium tabular-nums">
                                {formatFullCurrency(parseFloat(o.estimatedRevenue))}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground/50 invisible group-hover:visible" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
