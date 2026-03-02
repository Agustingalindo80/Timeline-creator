import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
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
  title: string;
  description: string;
  icon: any;
  href: string;
  available: boolean;
};

type ReportCategory = {
  title: string;
  reports: ReportCard[];
};

const reportCategories: ReportCategory[] = [
  {
    title: "Project & Delivery",
    reports: [
      {
        title: "Portfolio Health",
        description: "Overview of all projects with health indicators, stages, and status across the portfolio.",
        icon: Activity,
        href: "/reports/portfolio-health",
        available: true,
      },
      {
        title: "Project Status",
        description: "Detailed single-project snapshot with financials, tasks, milestones, and EVM metrics.",
        icon: BarChart3,
        href: "/reports/project-status",
        available: true,
      },
      {
        title: "Milestone Tracker",
        description: "Track upcoming, overdue, and completed milestones with financial obligations across projects.",
        icon: Target,
        href: "/reports/milestone-tracker",
        available: true,
      },
      {
        title: "RAID Summary",
        description: "Consolidated view of Risks, Assumptions, Issues, and Dependencies across all projects.",
        icon: AlertTriangle,
        href: "/reports/raid-summary",
        available: true,
      },
    ],
  },
  {
    title: "Financial",
    reports: [
      {
        title: "Cost Tracking",
        description: "Budget vs. actuals analysis with burn rate trends per project.",
        icon: DollarSign,
        href: "/reports/cost-tracking",
        available: false,
      },
      {
        title: "Margin Analysis",
        description: "Gross margin breakdown by project, client, and region.",
        icon: TrendingUp,
        href: "/reports/margin-analysis",
        available: false,
      },
    ],
  },
  {
    title: "Resources",
    reports: [
      {
        title: "Team Utilization",
        description: "Allocated vs. available hours per team member across all projects.",
        icon: Users,
        href: "/reports/team-utilization",
        available: false,
      },
      {
        title: "Timesheet Summary",
        description: "Actual hours logged by person, project, and week with variance analysis.",
        icon: Clock,
        href: "/reports/timesheet-summary",
        available: false,
      },
    ],
  },
  {
    title: "Pipeline",
    reports: [
      {
        title: "Opportunity Pipeline",
        description: "Funnel view of opportunities by status with estimated revenue and probability.",
        icon: Briefcase,
        href: "/reports/opportunity-pipeline",
        available: false,
      },
    ],
  },
  {
    title: "Executive",
    reports: [
      {
        title: "Revenue Forecast",
        description: "Projected revenue from active projects and weighted pipeline.",
        icon: TrendingUp,
        href: "/reports/revenue-forecast",
        available: false,
      },
      {
        title: "EVM Executive Summary",
        description: "Portfolio-level CPI and SPI averages with at-risk project identification.",
        icon: Activity,
        href: "/reports/evm-summary",
        available: false,
      },
    ],
  },
];

export default function ReportsPage() {
  return (
    <>
      <Helmet>
        <title>Reports | Project Planning</title>
      </Helmet>
      <div className="max-w-[1400px] mx-auto p-6 fade-in" data-testid="reports-page">
        <div className="mb-8">
          <h1 className="page-title text-2xl font-bold tracking-tight" data-testid="text-reports-title">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operational and executive reporting across your portfolio
          </p>
        </div>

        <div className="space-y-8">
          {reportCategories.map((category) => (
            <div key={category.title}>
              <h2
                className="section-title text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
                data-testid={`text-category-${category.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {category.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  if (!report.available) {
                    return (
                      <Card
                        key={report.title}
                        className="opacity-50 cursor-default"
                        data-testid={`card-report-${report.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                              <Icon className="w-4.5 h-4.5 text-muted-foreground/50" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold truncate">{report.title}</h3>
                                <Badge variant="outline" className="text-[10px] shrink-0" data-testid={`badge-coming-soon-${report.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                  Coming Soon
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {report.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return (
                    <Link key={report.title} href={report.href}>
                      <Card
                        className="card-interactive cursor-pointer group"
                        data-testid={`card-report-${report.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4.5 h-4.5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold truncate">{report.title}</h3>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {report.description}
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
