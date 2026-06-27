import { Link } from "wouter";
import {
  ArrowUpRight,
  AlertTriangle,
  Gavel,
  Flag,
  Target,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RAG_COLOR, RAG_LABEL, formatCurrency, type Rag } from "./theme";
import type {
  PortfolioProjectOverview,
  HeatmapRow,
  HeatmapColumn,
} from "./types";

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
  exception_requested: "Exception Requested",
  exception_approved: "Exception Approved",
};

function num(v: string | null): number {
  return parseFloat(v || "0") || 0;
}

function ragDot(rag: Rag, size = 8) {
  return (
    <span
      className="rounded-full shrink-0 inline-block"
      style={{ width: size, height: size, backgroundColor: RAG_COLOR[rag] }}
    />
  );
}

function recommendedAction(p: PortfolioProjectOverview): string {
  if (p.openCriticalRiskCount > 0) {
    return `Escalate ${p.openCriticalRiskCount} critical risk${p.openCriticalRiskCount === 1 ? "" : "s"} to the steering committee.`;
  }
  if (p.gateSummary.blocked > 0) {
    return `Unblock ${p.gateSummary.blocked} gate${p.gateSummary.blocked === 1 ? "" : "s"} — review readiness criteria with the gate owner.`;
  }
  if (p.openDecisionCount > 0) {
    return `Resolve ${p.openDecisionCount} pending gate exception${p.openDecisionCount === 1 ? "" : "s"} awaiting a decision.`;
  }
  if (p.overallRag === "red") {
    return "Project health is critical — convene a recovery review.";
  }
  if (p.overallRag === "amber") {
    return "Monitor at-risk dimensions and close gaps before the next gate.";
  }
  return "On track — maintain current delivery cadence.";
}

function StatRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium tabular-nums text-right ${muted ? "text-muted-foreground" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

interface ProjectDrawerProps {
  project: PortfolioProjectOverview | null;
  heatmapRow?: HeatmapRow;
  heatmapColumns: HeatmapColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDrawer({
  project,
  heatmapRow,
  heatmapColumns,
  open,
  onOpenChange,
}: ProjectDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="drawer-project"
      >
        {project && (
          <>
            <SheetHeader className="space-y-2 pr-6">
              <div className="flex items-center gap-2">
                {ragDot(project.overallRag, 10)}
                <SheetTitle className="text-lg leading-tight" data-testid="text-drawer-title">
                  {project.title}
                </SheetTitle>
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_LABELS[project.projectStatus] || project.projectStatus}
                </Badge>
                {project.clientName && <span>{project.clientName}</span>}
                {project.flightpathStageName && (
                  <span className="text-muted-foreground">
                    {"\u00b7"} {project.flightpathStageName}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Recommended action */}
              <div
                className="rounded-lg border bg-muted/40 p-3 flex gap-2.5"
                data-testid="drawer-recommended-action"
              >
                <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recommended action
                  </p>
                  <p className="text-sm mt-0.5">{recommendedAction(project)}</p>
                </div>
              </div>

              {/* Health overview */}
              <Section icon={<TrendingUp className="w-3.5 h-3.5" />} title="Health overview">
                <div className="rounded-lg border divide-y px-3">
                  <StatRow
                    label="Overall health"
                    value={
                      <span className="flex items-center gap-1.5 justify-end">
                        {ragDot(project.overallRag)}
                        {project.overallScore ?? "\u2014"} {"\u00b7"} {RAG_LABEL[project.overallRag]}
                      </span>
                    }
                  />
                  <StatRow
                    label="Start \u2192 End"
                    value={`${project.startDate ?? "\u2014"} \u2192 ${project.endDate ?? "\u2014"}`}
                    muted={!project.startDate && !project.endDate}
                  />
                </div>
              </Section>

              {/* Dimension breakdown */}
              {heatmapRow && (
                <Section icon={<TrendingUp className="w-3.5 h-3.5" />} title="Dimension breakdown">
                  <div className="space-y-1.5">
                    {heatmapColumns.map((c) => {
                      const cell = heatmapRow.cells[c.key];
                      if (!cell) return null;
                      return (
                        <div
                          key={c.key}
                          className="rounded-md border p-2"
                          data-testid={`drawer-dimension-${c.key}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              {ragDot(cell.rag)}
                              {c.label}
                            </span>
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {cell.score === null ? "\u2014" : cell.score} {"\u00b7"}{" "}
                              {RAG_LABEL[cell.rag]}
                            </span>
                          </div>
                          {cell.rationale && (
                            <p className="text-xs text-muted-foreground mt-1">{cell.rationale}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Financials */}
              <Section icon={<TrendingUp className="w-3.5 h-3.5" />} title="Financials">
                <div className="rounded-lg border divide-y px-3">
                  <StatRow
                    label="Approved budget"
                    value={project.approvedBudget ? formatCurrency(num(project.approvedBudget)) : "\u2014"}
                    muted={!project.approvedBudget}
                  />
                  <StatRow
                    label="Running cost"
                    value={project.totalRunningCost ? formatCurrency(num(project.totalRunningCost)) : "\u2014"}
                    muted={!project.totalRunningCost}
                  />
                  <StatRow
                    label="Forecast revenue"
                    value={project.estimatedRevenue ? formatCurrency(num(project.estimatedRevenue)) : "\u2014"}
                    muted={!project.estimatedRevenue}
                  />
                  <StatRow
                    label="Gross margin"
                    value={project.grossMargin ? formatCurrency(num(project.grossMargin)) : "\u2014"}
                    muted={!project.grossMargin}
                  />
                  <StatRow
                    label="CPI / SPI"
                    value={
                      project.evm
                        ? `${project.evm.cpi?.toFixed(2) ?? "\u2014"} / ${project.evm.spi?.toFixed(2) ?? "\u2014"}`
                        : "\u2014"
                    }
                    muted={!project.evm}
                  />
                </div>
              </Section>

              {/* Risks */}
              <Section icon={<AlertTriangle className="w-3.5 h-3.5" />} title="RAID exposure">
                <div className="rounded-lg border divide-y px-3">
                  <StatRow label="Open items" value={project.openRiskCount} muted={project.openRiskCount === 0} />
                  <StatRow
                    label="Critical risks"
                    value={
                      <span style={project.openCriticalRiskCount > 0 ? { color: RAG_COLOR.red } : undefined}>
                        {project.openCriticalRiskCount}
                      </span>
                    }
                    muted={project.openCriticalRiskCount === 0}
                  />
                </div>
              </Section>

              {/* Gate status */}
              <Section icon={<Gavel className="w-3.5 h-3.5" />} title="Governance">
                <div className="rounded-lg border divide-y px-3">
                  <StatRow
                    label="Current gate"
                    value={
                      project.currentGateStatus
                        ? GATE_STATUS_LABELS[project.currentGateStatus] || project.currentGateStatus
                        : "\u2014"
                    }
                    muted={!project.currentGateStatus}
                  />
                  <StatRow
                    label="Next gate"
                    value={project.nextGateName ?? "\u2014"}
                    muted={!project.nextGateName}
                  />
                  <StatRow
                    label="Blocked / pending gates"
                    value={`${project.gateSummary.blocked} / ${project.gateSummary.pending}`}
                    muted={project.gateSummary.blocked === 0 && project.gateSummary.pending === 0}
                  />
                  <StatRow
                    label="Decisions awaiting"
                    value={project.openDecisionCount}
                    muted={project.openDecisionCount === 0}
                  />
                </div>
              </Section>

              {/* Next milestone */}
              <Section icon={<Flag className="w-3.5 h-3.5" />} title="Next milestone">
                {project.nextMilestone ? (
                  <div className="rounded-lg border p-3" data-testid="drawer-next-milestone">
                    <p className="text-sm font-medium">{project.nextMilestone.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{project.nextMilestone.date}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming milestone.</p>
                )}
              </Section>

              {/* Outcomes */}
              <Section icon={<Target className="w-3.5 h-3.5" />} title="Business outcomes">
                <div className="rounded-lg border divide-y px-3">
                  <StatRow
                    label="Linked outcomes"
                    value={project.outcomeCount}
                    muted={project.outcomeCount === 0}
                  />
                </div>
              </Section>

              <Link href={`/timeline/${project.id}`}>
                <Button className="w-full" data-testid="button-open-project">
                  Open project
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
