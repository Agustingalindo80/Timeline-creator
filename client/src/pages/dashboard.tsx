import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  Target,
  FolderOpen,
  TrendingUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTitle } from "@/hooks/use-app-title";
import type { TimelineWithMilestones, AppSettings } from "@shared/schema";

const OPP_STATUS_OPTIONS = [
  { value: "qualifying", label: "Qualifying", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "estimating", label: "Estimating", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "proposed", label: "Proposed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "won", label: "Won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

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

  const oppsByStatus = OPP_STATUS_OPTIONS.map(s => ({
    ...s,
    count: opportunities.filter(o => o.opportunityStatus === s.value).length,
    revenue: opportunities.filter(o => o.opportunityStatus === s.value).reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0),
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>
      <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-active-projects">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FolderOpen className="w-4 h-4" />
              Active Projects
            </div>
            {projectsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{activeProjects.length}</div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-total-budget">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              Total Budget
            </div>
            {projectsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${totalProjectBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            )}
          </CardContent>
        </Card>
        {oppsEnabled && (
          <>
            <Card data-testid="card-active-opportunities">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Target className="w-4 h-4" />
                  Active Opportunities
                </div>
                {oppsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{activeOpps.length}</div>
                )}
              </CardContent>
            </Card>
            <Card data-testid="card-pipeline-value">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Pipeline Value
                </div>
                {oppsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">${pipelineValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {oppsEnabled && opportunities.length > 0 && (
        <Card data-testid="card-pipeline-funnel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Pipeline Funnel</span>
              <Link href="/opportunities">
                <Button variant="ghost" size="sm" data-testid="link-view-all-opportunities">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {oppsByStatus.map(s => (
                <div key={s.value} className="text-center" data-testid={`pipeline-stage-${s.value}`}>
                  <Badge className={`${s.color} border-0 mb-2`}>{s.label}</Badge>
                  <div className="text-2xl font-bold">{s.count}</div>
                  {s.revenue > 0 && (
                    <div className="text-xs text-muted-foreground">
                      ${s.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Recent Projects</span>
              <Link href="/projects">
                <Button variant="ghost" size="sm" data-testid="link-view-all-projects">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active projects</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/timeline/${p.id}`}>
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid={`project-row-${p.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground">{p.projectStatus || "Not started"}</div>
                      </div>
                      {p.approvedBudget && (
                        <div className="text-sm font-medium shrink-0 ml-2">
                          ${parseFloat(p.approvedBudget).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {oppsEnabled && (
          <Card data-testid="card-recent-opportunities">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Recent Opportunities</span>
                <Link href="/opportunities">
                  <Button variant="ghost" size="sm" data-testid="link-view-recent-opps">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oppsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No opportunities yet</p>
              ) : (
                <div className="space-y-2">
                  {opportunities.slice(0, 5).map(o => {
                    const statusOpt = OPP_STATUS_OPTIONS.find(s => s.value === o.opportunityStatus);
                    return (
                      <Link key={o.id} href={`/opportunities/${o.id}`}>
                        <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid={`opp-row-${o.id}`}>
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="text-sm font-medium truncate">{o.title}</div>
                            {statusOpt && <Badge className={`${statusOpt.color} border-0 text-[10px] px-1.5 py-0`}>{statusOpt.label}</Badge>}
                          </div>
                          {o.estimatedRevenue && (
                            <div className="text-sm font-medium shrink-0 ml-2">
                              ${parseFloat(o.estimatedRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          )}
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
