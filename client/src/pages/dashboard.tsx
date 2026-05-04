import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Activity,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  Calendar,
  Target,
  FolderOpen,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTitle } from "@/hooks/use-app-title";
import type { AppSettings } from "@shared/schema";

type DashboardSummary = {
  portfolioHealth: { green: number; amber: number; red: number };
  totalProjects: number;
  activeProjects: number;
  totalBudget: number;
  totalCost: number;
  forecastedRevenue: number;
  grossMarginPercent: number;
  pipelineValue: number;
  atRiskCount: number;
  openEscalations: number;
  atRiskProjects: { id: string; title: string; healthOverall: string }[];
  overdueMilestones: { id: string; title: string; date: string; projectTitle: string; timelineId: string }[];
  upcomingMilestones: { id: string; title: string; date: string; projectTitle: string; timelineId: string }[];
  criticalRaidItems: { id: string; title: string; itemType: string; impact: string; probability: string; projectTitle: string; timelineId: string }[];
  gateExceptions: { id: string; status: string; projectTitle: string; timelineId: string; stageName?: string }[];
  healthHeatmap: { id: string; title: string; healthOverall: string; scopeHealth: string; budgetHealth: string; teamHealth: string; projectStatus: string }[];
};

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

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const HEALTH_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const HEALTH_DOT: Record<string, string> = {
  green: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/20 text-red-600 dark:text-red-400",
};

export default function Dashboard() {
  const { t } = useTranslation();
  const appTitle = useAppTitle(t("dashboard.missionControl"));

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: summary, isLoading, isError, refetch } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const oppsEnabled = !!settings?.opportunitiesEnabled;
  const health = summary?.portfolioHealth || { green: 0, amber: 0, red: 0 };
  const totalHealthed = health.green + health.amber + health.red;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title" data-testid="text-dashboard-title">{t("dashboard.missionControl")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.missionControlSubtitle")}</p>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-destructive">{t("common.error")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-dashboard">{t("common.retry")}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <Card data-testid="card-portfolio-health">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  {t("dashboard.portfolioHealth")}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex gap-1 flex-1 h-2 rounded-full overflow-hidden bg-muted">
                    {totalHealthed > 0 && (
                      <>
                        <div className="bg-emerald-500 transition-all" style={{ width: `${(health.green / totalHealthed) * 100}%` }} />
                        <div className="bg-amber-500 transition-all" style={{ width: `${(health.amber / totalHealthed) * 100}%` }} />
                        <div className="bg-red-500 transition-all" style={{ width: `${(health.red / totalHealthed) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{health.green}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{health.amber}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{health.red}</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-forecasted-revenue">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {t("dashboard.forecastedRevenue")}
                </div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">
                  {formatCurrency(summary?.forecastedRevenue || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summary?.activeProjects || 0} {t("dashboard.projectsLabel")}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-gross-margin">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  {t("dashboard.grossMargin")}
                </div>
                <div className="text-3xl font-bold tracking-tight tabular-nums">
                  {summary?.grossMarginPercent || 0}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.totalBudget")}: {formatCurrency(summary?.totalBudget || 0)}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-at-risk">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("dashboard.projectsAtRisk")}
                </div>
                <div className={`text-3xl font-bold tracking-tight tabular-nums ${(summary?.atRiskCount || 0) > 0 ? "text-red-500" : ""}`}>
                  {summary?.atRiskCount || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.across")} {summary?.activeProjects || 0} {t("dashboard.activeProjects").toLowerCase()}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-open-escalations">
              <CardContent className="pt-5 pb-5">
                <div className="metric-label mb-2 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  {t("dashboard.openEscalations")}
                </div>
                <div className={`text-3xl font-bold tracking-tight tabular-nums ${(summary?.openEscalations || 0) > 0 ? "text-amber-500" : ""}`}>
                  {summary?.openEscalations || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.decisionsNeeded")}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-health-heatmap">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" /> {t("dashboard.healthHeatmap")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !summary?.healthHeatmap?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noActiveProjects")}</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr,60px,60px,60px,60px] gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pb-1">
                  <span>{t("common.project")}</span>
                  <span className="text-center">{t("dashboard.overall")}</span>
                  <span className="text-center">{t("dashboard.scope")}</span>
                  <span className="text-center">{t("dashboard.budget")}</span>
                  <span className="text-center">{t("dashboard.team")}</span>
                </div>
                {summary.healthHeatmap.slice(0, 10).map(p => (
                  <Link key={p.id} href={`/timeline/${p.id}`}>
                    <div className="grid grid-cols-[1fr,60px,60px,60px,60px] gap-1 items-center px-2 py-1.5 rounded-md hover-elevate cursor-pointer group" data-testid={`heatmap-row-${p.id}`}>
                      <span className="text-sm font-medium truncate">{p.title}</span>
                      {[p.healthOverall, p.scopeHealth, p.budgetHealth, p.teamHealth].map((h, i) => (
                        <div key={i} className="flex justify-center">
                          <span className={`w-3 h-3 rounded-full ${HEALTH_COLORS[h] || "bg-muted"}`} />
                        </div>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {oppsEnabled && (
          <Card data-testid="card-pipeline-conversion">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5" /> {t("dashboard.pipelineConversion")}
                </span>
                <Link href="/opportunities">
                  <Button variant="ghost" size="sm" data-testid="link-view-pipeline">
                    {t("common.viewAll")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6">
                <div className="text-3xl font-bold tracking-tight tabular-nums text-primary">
                  {formatCurrency(summary?.pipelineValue || 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{t("dashboard.pipelineValue")}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {!oppsEnabled && (
          <Card data-testid="card-at-risk-projects">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" /> {t("dashboard.projectsAtRisk")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!summary?.atRiskProjects?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noAtRiskProjects")}</p>
              ) : (
                <div className="divide-y divide-border">
                  {summary.atRiskProjects.slice(0, 5).map(p => (
                    <Link key={p.id} href={`/timeline/${p.id}`}>
                      <div className="flex items-center justify-between py-2.5 px-2 rounded-md hover-elevate cursor-pointer group" data-testid={`risk-project-${p.id}`}>
                        <span className="text-sm font-medium truncate">{p.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[p.healthOverall]}`} />
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 invisible group-hover:visible" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-overdue-milestones">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-red-500" /> {t("dashboard.overdueMilestones")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !summary?.overdueMilestones?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noOverdueMilestones")}</p>
            ) : (
              <div className="divide-y divide-border">
                {summary.overdueMilestones.map(m => (
                  <Link key={m.id} href={`/timeline/${m.timelineId}`}>
                    <div className="py-2.5 px-2 rounded-md hover-elevate cursor-pointer" data-testid={`overdue-milestone-${m.id}`}>
                      <div className="text-sm font-medium truncate">{m.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="text-red-500">{t("dashboard.dueDate")}: {m.date}</span>
                        <span className="truncate">{m.projectTitle}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-critical-raid">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> {t("dashboard.criticalRaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !summary?.criticalRaidItems?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noCriticalRaid")}</p>
            ) : (
              <div className="divide-y divide-border">
                {summary.criticalRaidItems.map(r => (
                  <Link key={r.id} href={`/timeline/${r.timelineId}`}>
                    <div className="py-2.5 px-2 rounded-md hover-elevate cursor-pointer" data-testid={`raid-item-${r.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{r.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{r.itemType}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{t("dashboard.riskImpact")}: {r.impact}</span>
                        <span className="truncate">{r.projectTitle}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-gate-exceptions-list">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> {t("dashboard.gateExceptions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !summary?.gateExceptions?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noGateExceptions")}</p>
            ) : (
              <div className="divide-y divide-border">
                {summary.gateExceptions.map(g => (
                  <Link key={g.id} href={`/timeline/${g.timelineId}`}>
                    <div className="py-2.5 px-2 rounded-md hover-elevate cursor-pointer" data-testid={`gate-exception-${g.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{g.projectTitle}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{g.status.replace("_", " ")}</Badge>
                      </div>
                      {g.stageName && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{g.stageName}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-milestones">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" /> {t("dashboard.upcomingMilestones")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !summary?.upcomingMilestones?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noUpcomingMilestones")}</p>
            ) : (
              <div className="divide-y divide-border">
                {summary.upcomingMilestones.map(m => (
                  <Link key={m.id} href={`/timeline/${m.timelineId}`}>
                    <div className="py-2.5 px-2 rounded-md hover-elevate cursor-pointer" data-testid={`upcoming-milestone-${m.id}`}>
                      <div className="text-sm font-medium truncate">{m.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{m.date}</span>
                        <span className="truncate">{m.projectTitle}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
