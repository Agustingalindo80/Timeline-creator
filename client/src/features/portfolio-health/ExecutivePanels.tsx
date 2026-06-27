import {
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  ListChecks,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RAG_COLOR, RAG_LABEL, formatCurrency, type Rag } from "./theme";
import type {
  FinancialPanel,
  GovernancePanel,
  RaidPanel,
  OutcomePanel,
  PortfolioPanels,
} from "./types";

function RagBadge({ rag, testId }: { rag: Rag; testId?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${RAG_COLOR[rag]}1f`, color: RAG_COLOR[rag] }}
      data-testid={testId}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RAG_COLOR[rag] }} />
      {RAG_LABEL[rag]}
    </span>
  );
}

function PanelShell({
  title,
  icon: Icon,
  rag,
  reasons,
  testId,
  children,
}: {
  title: string;
  icon: LucideIcon;
  rag: Rag;
  reasons: string[];
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={testId} className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <RagBadge rag={rag} testId={`${testId}-rag`} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {children}
        {rag !== "green" && rag !== "gray" && reasons.length > 0 && (
          <div
            className="rounded-md border p-2.5 text-xs space-y-1"
            style={{ borderColor: `${RAG_COLOR[rag]}55`, backgroundColor: `${RAG_COLOR[rag]}0d` }}
            data-testid={`${testId}-reasons`}
          >
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5" data-testid={`${testId}-reason-${i}`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: RAG_COLOR[rag] }} />
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone?: Rag;
  testId: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </p>
      <p
        className="text-lg font-semibold tabular-nums mt-0.5"
        style={tone ? { color: RAG_COLOR[tone] } : undefined}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function fmtIndex(v: number | null): string {
  return v === null ? "\u2014" : v.toFixed(2);
}

function fmtPct(v: number | null): string {
  return v === null || Number.isNaN(v) ? "\u2014" : `${v}%`;
}

function FinancialHealthPanel({ panel }: { panel: FinancialPanel }) {
  const cpiTone: Rag | undefined =
    panel.cpi === null ? undefined : panel.cpi < 0.85 ? "red" : panel.cpi < 0.95 ? "amber" : "green";
  const marginTone: Rag | undefined =
    panel.forecastMarginPct === null
      ? undefined
      : panel.forecastMarginPct < panel.targetMarginPct - 5
        ? "red"
        : panel.forecastMarginPct < panel.targetMarginPct
          ? "amber"
          : "green";
  return (
    <PanelShell title="Financial Health" icon={DollarSign} rag={panel.rag} reasons={panel.reasons} testId="panel-financial">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Contracted Revenue" value={formatCurrency(panel.contractedRevenue)} testId="financial-revenue" />
        <Metric label="Approved Budget" value={formatCurrency(panel.approvedBudget)} testId="financial-budget" />
        <Metric label="Actual Cost" value={formatCurrency(panel.actualCost)} testId="financial-actual-cost" />
        <Metric label="Forecast Cost" value={formatCurrency(panel.forecastCost)} testId="financial-forecast-cost" />
        <Metric label="EAC" value={formatCurrency(panel.eac)} testId="financial-eac" />
        <Metric label="Earned Value (EV)" value={formatCurrency(panel.earnedValue)} testId="financial-ev" />
        <Metric label="Planned Value (PV)" value={formatCurrency(panel.plannedValue)} testId="financial-pv" />
        <Metric
          label="Cost Variance (CV)"
          value={formatCurrency(panel.costVariance)}
          tone={panel.costVariance < 0 ? "red" : undefined}
          testId="financial-cv"
        />
        <Metric
          label="Schedule Variance (SV)"
          value={formatCurrency(panel.scheduleVariance)}
          tone={panel.scheduleVariance < 0 ? "amber" : undefined}
          testId="financial-sv"
        />
        <Metric
          label="VAC"
          value={formatCurrency(panel.vac)}
          tone={panel.vac < 0 ? "red" : undefined}
          testId="financial-vac"
        />
        <Metric label="CPI" value={fmtIndex(panel.cpi)} tone={cpiTone} testId="financial-cpi" />
        <Metric label="SPI" value={fmtIndex(panel.spi)} testId="financial-spi" />
        <Metric
          label={`Forecast Margin (tgt ${panel.targetMarginPct}%)`}
          value={fmtPct(panel.forecastMarginPct)}
          tone={marginTone}
          testId="financial-margin"
        />
        <Metric
          label="Margin Leakage"
          value={panel.marginLeakage > 0 ? formatCurrency(panel.marginLeakage) : "\u2014"}
          tone={panel.marginLeakage > 0 ? "red" : undefined}
          testId="financial-leakage"
        />
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="financial-evm-coverage">
        EVM data for {panel.projectsWithEvm} of {panel.totalProjects} projects
      </p>
    </PanelShell>
  );
}

const GATE_STATUS_LABEL: Record<string, string> = {
  blocked: "Blocked",
  in_review: "In Review",
  on_track: "On Track",
  not_started: "Not Started",
};
const GATE_STATUS_TONE: Record<string, Rag> = {
  blocked: "red",
  in_review: "amber",
  on_track: "green",
  not_started: "gray",
};

function GateReadinessPanel({ panel }: { panel: GovernancePanel }) {
  return (
    <PanelShell title="Gate Readiness" icon={ShieldCheck} rag={panel.rag} reasons={panel.reasons} testId="panel-governance">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Approved Gates" value={`${panel.approvedGates}/${panel.totalGates}`} tone="green" testId="governance-approved" />
        <Metric label="Awaiting Review" value={String(panel.pendingGates)} tone={panel.pendingGates > 0 ? "amber" : undefined} testId="governance-pending" />
        <Metric label="Blocked Gates" value={String(panel.blockedGates)} tone={panel.blockedGates > 0 ? "red" : undefined} testId="governance-blocked" />
        <Metric label="Missing Evidence" value={String(panel.missingEvidence)} tone={panel.missingEvidence > 0 ? "red" : undefined} testId="governance-missing-evidence" />
        <Metric label="Overdue Projects" value={String(panel.projectsOverdue)} tone={panel.projectsOverdue > 0 ? "red" : undefined} testId="governance-overdue" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Projects At Gate
        </p>
        {panel.projects.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="governance-projects-empty">
            No gate activity recorded.
          </p>
        ) : (
          <ul className="space-y-2.5" data-testid="governance-projects">
            {panel.projects.slice(0, 5).map((p) => (
              <li key={p.id} className="text-xs space-y-1" data-testid={`governance-project-${p.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate min-w-0">
                    <span className="font-medium">{p.title}</span>
                    {p.stageName && <span className="text-muted-foreground"> · {p.stageName}</span>}
                  </span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 font-medium"
                    style={{
                      backgroundColor: `${RAG_COLOR[GATE_STATUS_TONE[p.gateStatus]]}1f`,
                      color: RAG_COLOR[GATE_STATUS_TONE[p.gateStatus]],
                    }}
                  >
                    {GATE_STATUS_LABEL[p.gateStatus]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span data-testid={`governance-next-gate-${p.id}`}>
                    Next: {p.nextGateName || "\u2014"}
                  </span>
                  <span
                    data-testid={`governance-target-${p.id}`}
                    className={p.overdue ? "text-red-500 dark:text-red-400 font-medium" : undefined}
                  >
                    Project due: {p.targetDate ? new Date(p.targetDate).toLocaleDateString() : "\u2014"}
                    {p.overdue && " (overdue)"}
                  </span>
                  <span data-testid={`governance-owner-${p.id}`}>
                    Owner: {p.owner || "\u2014"}
                  </span>
                  {p.missingEvidence > 0 && (
                    <span data-testid={`governance-evidence-${p.id}`}>
                      {p.missingEvidence} evidence outstanding
                    </span>
                  )}
                </div>
                {p.blockers.length > 0 && (
                  <div className="flex items-start gap-1.5" data-testid={`governance-blockers-${p.id}`}>
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
                    <span className="text-muted-foreground">{p.blockers.join(" · ")}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}

function RaidRiskPanel({ panel }: { panel: RaidPanel }) {
  return (
    <PanelShell title="RAID / Risk" icon={ListChecks} rag={panel.rag} reasons={panel.reasons} testId="panel-raid">
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Risks" value={String(panel.openRisks)} testId="raid-risks" />
        <Metric label="Assump." value={String(panel.openAssumptions)} testId="raid-assumptions" />
        <Metric label="Issues" value={String(panel.openIssues)} testId="raid-issues" />
        <Metric label="Depend." value={String(panel.openDependencies)} testId="raid-dependencies" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Critical" value={String(panel.criticalRisks)} tone={panel.criticalRisks > 0 ? "red" : undefined} testId="raid-critical" />
        <Metric label="Overdue" value={String(panel.overdueMitigations)} tone={panel.overdueMitigations > 0 ? "red" : undefined} testId="raid-overdue" />
        <Metric label="Escalate" value={String(panel.needingEscalation)} tone={panel.needingEscalation > 0 ? "red" : undefined} testId="raid-escalation" />
        <Metric label="No Owner" value={String(panel.risksWithoutOwner)} tone={panel.risksWithoutOwner > 0 ? "amber" : undefined} testId="raid-no-owner" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Top Risks
        </p>
        {panel.topRisks.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="raid-top-empty">
            No open risks.
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="raid-top-risks">
            {panel.topRisks.map((r) => {
              const tone: Rag = r.score >= 12 ? "red" : r.score >= 6 ? "amber" : "green";
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs" data-testid={`raid-risk-${r.id}`}>
                  <span className="truncate min-w-0">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-muted-foreground"> · {r.projectTitle}</span>
                  </span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 font-medium tabular-nums"
                    style={{ backgroundColor: `${RAG_COLOR[tone]}1f`, color: RAG_COLOR[tone] }}
                  >
                    {r.score}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}

function BusinessOutcomePanel({ panel }: { panel: OutcomePanel }) {
  return (
    <PanelShell title="Business Outcomes" icon={Target} rag={panel.rag} reasons={panel.reasons} testId="panel-outcome">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Tracked" value={String(panel.tracked)} testId="outcome-tracked" />
        <Metric label="On Track" value={String(panel.onTrack)} tone={panel.onTrack > 0 ? "green" : undefined} testId="outcome-on-track" />
        <Metric label="At Risk" value={String(panel.atRisk)} tone={panel.atRisk > 0 ? "red" : undefined} testId="outcome-at-risk" />
        <Metric label="Delivered" value={String(panel.delivered)} testId="outcome-delivered" />
        <Metric
          label="Not Measurable"
          value={String(panel.notMeasurable)}
          tone={panel.notMeasurable > 0 ? "amber" : undefined}
          testId="outcome-not-measurable"
        />
        <Metric label="Metrics Available" value={String(panel.metricsAvailable)} tone={panel.metricsAvailable > 0 ? "green" : undefined} testId="outcome-metrics-available" />
        <Metric
          label="Metrics Missing"
          value={String(panel.metricsMissing)}
          tone={panel.metricsMissing > 0 ? "amber" : undefined}
          testId="outcome-metrics-missing"
        />
        <Metric label="Evidence Captured" value={String(panel.evidenceCaptured)} testId="outcome-evidence" />
      </div>
    </PanelShell>
  );
}

export function ExecutivePanels({ panels }: { panels: PortfolioPanels }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="executive-panels">
      <FinancialHealthPanel panel={panels.financial} />
      <GateReadinessPanel panel={panels.governance} />
      <RaidRiskPanel panel={panels.raid} />
      <BusinessOutcomePanel panel={panels.outcome} />
    </div>
  );
}

export function ExecutivePanelsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}
