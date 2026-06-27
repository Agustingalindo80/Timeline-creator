import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CircleDashed,
  Wallet,
  TrendingDown,
  Flame,
  Lock,
  Rocket,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RAG_COLOR, formatCurrency } from "./theme";
import type { PortfolioOverviewKpis } from "./types";
import type { ReactNode } from "react";

interface KpiItem {
  label: string;
  value: string;
  icon: ReactNode;
  testId: string;
  accent?: string;
}

function KpiCard({ item }: { item: KpiItem }) {
  return (
    <Card data-testid={item.testId}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {item.label}
            </p>
            <p
              className="text-2xl font-semibold tabular-nums mt-1"
              style={item.accent ? { color: item.accent } : undefined}
              data-testid={`${item.testId}-value`}
            >
              {item.value}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ kpis }: { kpis: PortfolioOverviewKpis }) {
  const items: KpiItem[] = [
    {
      label: "Green",
      value: String(kpis.greenProjects),
      icon: <ShieldCheck className="w-4 h-4" style={{ color: RAG_COLOR.green }} />,
      accent: RAG_COLOR.green,
      testId: "kpi-green",
    },
    {
      label: "Amber",
      value: String(kpis.amberProjects),
      icon: <AlertTriangle className="w-4 h-4" style={{ color: RAG_COLOR.amber }} />,
      accent: RAG_COLOR.amber,
      testId: "kpi-amber",
    },
    {
      label: "Red",
      value: String(kpis.redProjects),
      icon: <XCircle className="w-4 h-4" style={{ color: RAG_COLOR.red }} />,
      accent: RAG_COLOR.red,
      testId: "kpi-red",
    },
    {
      label: "No Data",
      value: String(kpis.grayProjects),
      icon: <CircleDashed className="w-4 h-4" style={{ color: RAG_COLOR.gray }} />,
      testId: "kpi-gray",
    },
    {
      label: "Total Budget",
      value: formatCurrency(kpis.totalBudget),
      icon: <Wallet className="w-4 h-4 text-primary" />,
      testId: "kpi-total-budget",
    },
    {
      label: "Actual Cost",
      value: formatCurrency(kpis.actualCost),
      icon: <Wallet className="w-4 h-4 text-muted-foreground" />,
      testId: "kpi-actual-cost",
    },
    {
      label: "Forecast Cost",
      value: formatCurrency(kpis.forecastCost),
      icon: <TrendingDown className="w-4 h-4 text-muted-foreground" />,
      testId: "kpi-forecast-cost",
    },
    {
      label: "Critical Risks",
      value: String(kpis.openCriticalRisks),
      icon: <Flame className="w-4 h-4" style={{ color: RAG_COLOR.red }} />,
      testId: "kpi-critical-risks",
    },
    {
      label: "Blocked Gates",
      value: String(kpis.blockedGates),
      icon: <Lock className="w-4 h-4" style={{ color: RAG_COLOR.amber }} />,
      testId: "kpi-blocked-gates",
    },
    {
      label: "Upcoming Go-Lives",
      value: String(kpis.upcomingGoLives),
      icon: <Rocket className="w-4 h-4 text-primary" />,
      testId: "kpi-upcoming-go-lives",
    },
    {
      label: "Outcomes On Track",
      value: String(kpis.outcomesOnTrack),
      icon: <Target className="w-4 h-4" style={{ color: RAG_COLOR.green }} />,
      testId: "kpi-outcomes-on-track",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
      data-testid="kpi-cards"
    >
      {items.map((item) => (
        <KpiCard key={item.testId} item={item} />
      ))}
    </div>
  );
}
