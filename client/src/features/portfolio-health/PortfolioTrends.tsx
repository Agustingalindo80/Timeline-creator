import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TrendingUp, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/reports/report-filters";
import { RAG_COLOR, VOGARA, formatCurrency } from "./theme";

interface PortfolioTrendPoint {
  date: string;
  healthScore: number | null;
  green: number;
  amber: number;
  red: number;
  gray: number;
  forecastMargin: number | null;
  riskExposure: number;
  gateReadiness: number | null;
  outcomesOnTrack: number;
}

interface PortfolioTrendsResponse {
  points: PortfolioTrendPoint[];
  projectCount: number;
  from: string | null;
  to: string | null;
}

type MetricKey =
  | "healthScore"
  | "rag"
  | "forecastMargin"
  | "riskExposure"
  | "gateReadiness"
  | "outcomesOnTrack";

const LINE_COLOR = VOGARA.navy;

function fmtAxisDate(v: string): string {
  // v is YYYY-MM-DD; render as "Mon D" without timezone drift.
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return v;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
} as const;

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
const axisLine = { stroke: "hsl(var(--border))" } as const;

export function PortfolioTrends() {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<MetricKey>("healthScore");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [dateFrom, dateTo]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery<PortfolioTrendsResponse>({
    queryKey: [`/api/dashboard/portfolio-trends${queryString}`],
    placeholderData: keepPreviousData,
  });

  const points = data?.points ?? [];

  const metricOptions: { key: MetricKey; label: string }[] = [
    { key: "healthScore", label: t("portfolioHealth.trends.healthScore") },
    { key: "rag", label: t("portfolioHealth.trends.ragComposition") },
    { key: "forecastMargin", label: t("portfolioHealth.trends.forecastMargin") },
    { key: "riskExposure", label: t("portfolioHealth.trends.riskExposure") },
    { key: "gateReadiness", label: t("portfolioHealth.trends.gateReadiness") },
    { key: "outcomesOnTrack", label: t("portfolioHealth.trends.outcomeRealization") },
  ];

  const formatValue = (value: number): string => {
    switch (metric) {
      case "forecastMargin":
      case "gateReadiness":
        return `${value}%`;
      case "riskExposure":
        return formatCurrency(value);
      default:
        return `${value}`;
    }
  };

  const renderChart = () => {
    if (metric === "rag") {
      return (
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={axisTick} axisLine={axisLine} tickLine={false} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtAxisDate} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Line type="monotone" dataKey="green" name={t("portfolioHealth.trends.green")} stroke={RAG_COLOR.green} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="amber" name={t("portfolioHealth.trends.amber")} stroke={RAG_COLOR.amber} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="red" name={t("portfolioHealth.trends.red")} stroke={RAG_COLOR.red} strokeWidth={2} dot={false} />
        </LineChart>
      );
    }

    const activeOption = metricOptions.find((o) => o.key === metric);
    return (
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={axisTick} axisLine={axisLine} tickLine={false} />
        <YAxis
          tick={axisTick}
          axisLine={axisLine}
          tickLine={false}
          tickFormatter={(v) => formatValue(Number(v))}
          width={metric === "riskExposure" ? 56 : 40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={fmtAxisDate}
          formatter={(value: number) => [formatValue(value), activeOption?.label ?? ""]}
        />
        <Line type="monotone" dataKey={metric} name={activeOption?.label} stroke={LINE_COLOR} strokeWidth={2.5} dot={false} />
      </LineChart>
    );
  };

  return (
    <Card data-testid="card-portfolio-trends">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" style={{ color: VOGARA.navy }} />
              {t("portfolioHealth.trends.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("portfolioHealth.trends.subtitle")}</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-3" data-testid="trend-metric-selector">
          {metricOptions.map((o) => (
            <Button
              key={o.key}
              size="sm"
              variant={metric === o.key ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setMetric(o.key)}
              data-testid={`button-trend-metric-${o.key}`}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="trend-loading">
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-[280px] gap-3" data-testid="trend-error">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{t("portfolioHealth.trends.error")}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-trend-retry">
              {t("portfolioHealth.trends.retry")}
            </Button>
          </div>
        ) : points.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground" data-testid="trend-empty">
            {t("portfolioHealth.trends.empty")}
          </div>
        ) : (
          <div className="relative">
            {isFetching && (
              <span
                className="absolute right-0 -top-1 text-xs text-muted-foreground z-10"
                data-testid="trend-updating"
              >
                {t("portfolioHealth.trends.updating")}
              </span>
            )}
            <div style={{ height: 280 }} data-testid="chart-portfolio-trends">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
