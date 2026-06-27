import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  DollarSign,
  Users,
  TrendingUp,
  Briefcase,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReportCard = {
  titleKey: string;
  descKey: string;
  icon: any;
  href: string;
  available: boolean;
  testId: string;
};

type ReportCategory = {
  titleKey: string;
  testId: string;
  reports: ReportCard[];
};

const reportCategories: ReportCategory[] = [
  {
    titleKey: "reports.projectDelivery",
    testId: "project-&-delivery",
    reports: [
      {
        titleKey: "reports.portfolioHealth",
        descKey: "reports.portfolioHealthDesc",
        icon: Activity,
        href: "/reports/portfolio-health",
        available: true,
        testId: "portfolio-health",
      },
      {
        titleKey: "reports.projectStatus",
        descKey: "reports.projectStatusDesc",
        icon: BarChart3,
        href: "/reports/project-status",
        available: true,
        testId: "project-status",
      },
      {
        titleKey: "reports.milestoneTracker",
        descKey: "reports.milestoneTrackerDesc",
        icon: Target,
        href: "/reports/milestone-tracker",
        available: true,
        testId: "milestone-tracker",
      },
      {
        titleKey: "reports.raidSummary",
        descKey: "reports.raidSummaryDesc",
        icon: AlertTriangle,
        href: "/reports/raid-summary",
        available: true,
        testId: "raid-summary",
      },
      {
        titleKey: "reports.businessOutcomes",
        descKey: "reports.businessOutcomesDesc",
        icon: Target,
        href: "/reports/business-outcomes",
        available: true,
        testId: "business-outcomes",
      },
    ],
  },
  {
    titleKey: "reports.financial",
    testId: "financial",
    reports: [
      {
        titleKey: "reports.costTracking",
        descKey: "reports.costTrackingDesc",
        icon: DollarSign,
        href: "/reports/cost-tracking",
        available: false,
        testId: "cost-tracking",
      },
      {
        titleKey: "reports.marginAnalysis",
        descKey: "reports.marginAnalysisDesc",
        icon: TrendingUp,
        href: "/reports/margin-analysis",
        available: false,
        testId: "margin-analysis",
      },
    ],
  },
  {
    titleKey: "reports.resources",
    testId: "resources",
    reports: [
      {
        titleKey: "reports.teamUtilization",
        descKey: "reports.teamUtilizationDesc",
        icon: Users,
        href: "/reports/team-utilization",
        available: false,
        testId: "team-utilization",
      },
      {
        titleKey: "reports.timesheetSummary",
        descKey: "reports.timesheetSummaryDesc",
        icon: Clock,
        href: "/reports/timesheet-summary",
        available: false,
        testId: "timesheet-summary",
      },
    ],
  },
  {
    titleKey: "reports.pipeline",
    testId: "pipeline",
    reports: [
      {
        titleKey: "reports.opportunityPipeline",
        descKey: "reports.opportunityPipelineDesc",
        icon: Briefcase,
        href: "/reports/opportunity-pipeline",
        available: false,
        testId: "opportunity-pipeline",
      },
    ],
  },
  {
    titleKey: "reports.executive",
    testId: "executive",
    reports: [
      {
        titleKey: "reports.revenueForecast",
        descKey: "reports.revenueForecastDesc",
        icon: TrendingUp,
        href: "/reports/revenue-forecast",
        available: false,
        testId: "revenue-forecast",
      },
      {
        titleKey: "reports.evmExecutive",
        descKey: "reports.evmExecutiveDesc",
        icon: Activity,
        href: "/reports/evm-summary",
        available: false,
        testId: "evm-executive-summary",
      },
    ],
  },
];

export default function ReportsPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t("reports.title")} | Project Planning</title>
      </Helmet>
      <div className="max-w-[1400px] mx-auto p-6 fade-in" data-testid="reports-page">
        <div className="mb-8">
          <h1 className="page-title text-2xl font-bold tracking-tight" data-testid="text-reports-title">
            {t("reports.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("reports.subtitle")}
          </p>
        </div>

        <div className="space-y-8">
          {reportCategories.map((category) => (
            <div key={category.testId}>
              <h2
                className="section-title text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
                data-testid={`text-category-${category.testId}`}
              >
                {t(category.titleKey)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  if (!report.available) {
                    return (
                      <Card
                        key={report.testId}
                        className="opacity-50 cursor-default"
                        data-testid={`card-report-${report.testId}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                              <Icon className="w-4.5 h-4.5 text-muted-foreground/50" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold truncate">{t(report.titleKey)}</h3>
                                <Badge variant="outline" className="text-[10px] shrink-0" data-testid={`badge-coming-soon-${report.testId}`}>
                                  {t("common.comingSoon")}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {t(report.descKey)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return (
                    <Link key={report.testId} href={report.href}>
                      <Card
                        className="card-interactive cursor-pointer group"
                        data-testid={`card-report-${report.testId}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4.5 h-4.5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold truncate">{t(report.titleKey)}</h3>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {t(report.descKey)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
