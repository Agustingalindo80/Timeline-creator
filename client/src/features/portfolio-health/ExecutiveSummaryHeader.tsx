import { HealthScoreGauge } from "./HealthScoreGauge";
import { VOGARA, formatCurrency, formatPercent } from "./theme";
import type { PortfolioOverviewHeader } from "./types";

interface MetricProps {
  label: string;
  value: string;
  testId: string;
  emphasis?: boolean;
}

function Metric({ label, value, testId, emphasis }: MetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/60 truncate">
        {label}
      </p>
      <p
        className={`tabular-nums truncate ${emphasis ? "text-xl font-bold" : "text-lg font-semibold"} text-white`}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

interface ExecutiveSummaryHeaderProps {
  header: PortfolioOverviewHeader;
  generatedAt: string;
}

export function ExecutiveSummaryHeader({ header, generatedAt }: ExecutiveSummaryHeaderProps) {
  const lastUpdated = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "\u2014";

  return (
    <div
      className="rounded-xl p-6 shadow-sm"
      style={{
        background: `linear-gradient(135deg, ${VOGARA.navy} 0%, ${VOGARA.navyDeep} 100%)`,
      }}
      data-testid="exec-summary-header"
    >
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-5">
          <HealthScoreGauge score={header.healthScore} rag={header.healthRag} />
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="text-portfolio-health-title">
              Portfolio Health
            </h1>
            <p className="text-sm text-white/70 mt-0.5">
              Executive governance cockpit
            </p>
            <p className="text-[11px] text-white/50 mt-2" data-testid="text-last-updated">
              Last updated {lastUpdated}
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 min-w-[280px]">
          <Metric
            label="Active Projects"
            value={`${header.activeProjects} / ${header.totalProjects}`}
            testId="metric-active-projects"
          />
          <Metric
            label="Clients"
            value={String(header.clientCount)}
            testId="metric-client-count"
          />
          <Metric
            label="Total Contract Value"
            value={formatCurrency(header.totalContractValue)}
            testId="metric-tcv"
            emphasis
          />
          <Metric
            label="Forecast Revenue"
            value={formatCurrency(header.forecastRevenue)}
            testId="metric-forecast-revenue"
          />
          <Metric
            label="Forecast Margin"
            value={formatPercent(header.forecastMarginPct)}
            testId="metric-forecast-margin"
          />
          <Metric
            label="Risk Exposure"
            value={`${header.riskExposure} critical`}
            testId="metric-risk-exposure"
          />
          <Metric
            label="Need Attention"
            value={String(header.projectsRequiringAttention)}
            testId="metric-attention"
            emphasis
          />
        </div>
      </div>
    </div>
  );
}
