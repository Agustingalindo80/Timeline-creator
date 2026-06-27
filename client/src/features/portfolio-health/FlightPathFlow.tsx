import { Link } from "wouter";
import { GitBranch, Grid3x3, AlertTriangle, Gavel, Clock, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RAG_COLOR, RAG_LABEL, type Rag } from "./theme";
import type { Heatmap, StageBucket } from "./types";

function ragDot(rag: Rag) {
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RAG_COLOR[rag] }} />;
}

function StageCard({ stage }: { stage: StageBucket }) {
  const score = stage.avgHealthScore;
  return (
    <Card data-testid={`card-stage-${stage.id}`} className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold truncate" title={stage.name}>
              {stage.name}
            </h4>
            {stage.gateName && (
              <p className="text-[11px] text-muted-foreground truncate" title={stage.gateName}>
                {stage.gateName}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-2xl font-semibold tabular-nums leading-none"
              data-testid={`text-stage-count-${stage.id}`}
            >
              {stage.projectCount}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {stage.projectCount === 1 ? "project" : "projects"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          {ragDot(stage.avgHealthRag)}
          <span className="text-xs text-muted-foreground">Avg health</span>
          <span className="text-xs font-medium tabular-nums ml-auto" data-testid={`text-stage-health-${stage.id}`}>
            {score === null ? "\u2014" : `${score} \u00b7 ${RAG_LABEL[stage.avgHealthRag]}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Metric
            icon={<Gavel className="w-3.5 h-3.5" />}
            label="Blocked gates"
            value={stage.blockedGates}
            tone={stage.blockedGates > 0 ? "red" : undefined}
            testId={`text-stage-blocked-${stage.id}`}
          />
          <Metric
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="Decisions due"
            value={stage.decisionsRequired}
            tone={stage.decisionsRequired > 0 ? "amber" : undefined}
            testId={`text-stage-decisions-${stage.id}`}
          />
          <Metric
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Avg days in stage"
            value={stage.avgDaysInStage === null ? "\u2014" : stage.avgDaysInStage}
            testId={`text-stage-days-${stage.id}`}
          />
          <Metric
            icon={<Hourglass className="w-3.5 h-3.5" />}
            label={`Aging > ${stage.agingThresholdDays}d`}
            value={stage.agingProjects}
            tone={stage.agingProjects > 0 ? "amber" : undefined}
            testId={`text-stage-aging-${stage.id}`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Gate readiness</span>
            <span className="font-medium tabular-nums" data-testid={`text-stage-readiness-${stage.id}`}>
              {stage.readinessPct === null ? "\u2014" : `${stage.readinessPct}%`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${stage.readinessPct ?? 0}%`,
                backgroundColor:
                  stage.readinessPct === null
                    ? RAG_COLOR.gray
                    : stage.readinessPct >= 80
                      ? RAG_COLOR.green
                      : stage.readinessPct >= 50
                        ? RAG_COLOR.amber
                        : RAG_COLOR.red,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: Rag;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        {icon}
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={tone ? { color: RAG_COLOR[tone] } : undefined}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

export function StageDistribution({ stages }: { stages: StageBucket[] }) {
  return (
    <Card data-testid="section-stage-distribution">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-primary" /> FlightPath Stage Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-stages-empty">
            No FlightPath stages configured for this workspace.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {stages.map((s) => (
              <StageCard key={s.id} stage={s} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DimensionHeatmap({
  heatmap,
  onSelectProject,
}: {
  heatmap: Heatmap;
  onSelectProject?: (id: string) => void;
}) {
  return (
    <Card data-testid="section-dimension-heatmap">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Grid3x3 className="w-4 h-4 text-primary" /> Project Health Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        {heatmap.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-heatmap-empty">
            No projects available to chart.
          </p>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1 sticky left-0 bg-card">
                      Project
                    </th>
                    {heatmap.columns.map((c) => (
                      <th
                        key={c.key}
                        className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1 py-1"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.rows.map((row) => (
                    <tr key={row.id} data-testid={`heatmap-row-${row.id}`}>
                      <td className="text-xs font-medium px-2 py-1 max-w-[200px] truncate sticky left-0 bg-card">
                        {onSelectProject ? (
                          <button
                            type="button"
                            onClick={() => onSelectProject(row.id)}
                            className="hover:text-primary hover:underline text-left truncate w-full"
                            data-testid={`link-heatmap-project-${row.id}`}
                            title={row.title}
                          >
                            {row.title}
                          </button>
                        ) : (
                          <Link
                            href={`/timeline/${row.id}`}
                            className="hover:text-primary hover:underline"
                            data-testid={`link-heatmap-project-${row.id}`}
                            title={row.title}
                          >
                            {row.title}
                          </Link>
                        )}
                      </td>
                      {heatmap.columns.map((c) => {
                        const cell = row.cells[c.key];
                        const cellClass =
                          "h-8 w-full min-w-[44px] rounded flex items-center justify-center text-[11px] font-semibold tabular-nums cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 hover:ring-offset-card focus-visible:outline-none focus-visible:ring-2";
                        const cellStyle = {
                          backgroundColor: `${RAG_COLOR[cell.rag]}26`,
                          color: RAG_COLOR[cell.rag],
                        };
                        const cellLabel = `${row.title} ${c.label}: ${RAG_LABEL[cell.rag]}`;
                        return (
                          <td key={c.key} className="p-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {onSelectProject ? (
                                  <button
                                    type="button"
                                    onClick={() => onSelectProject(row.id)}
                                    className={cellClass}
                                    style={cellStyle}
                                    aria-label={cellLabel}
                                    data-testid={`heatmap-cell-${row.id}-${c.key}`}
                                  >
                                    {cell.score === null ? "\u2014" : cell.score}
                                  </button>
                                ) : (
                                  <Link
                                    href={`/timeline/${row.id}`}
                                    className={cellClass}
                                    style={cellStyle}
                                    aria-label={cellLabel}
                                    data-testid={`heatmap-cell-${row.id}-${c.key}`}
                                  >
                                    {cell.score === null ? "\u2014" : cell.score}
                                  </Link>
                                )}
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                <p className="font-semibold">
                                  {c.label} {"\u00b7"} {RAG_LABEL[cell.rag]}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{cell.rationale}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
              {(["green", "amber", "red", "gray"] as Rag[]).map((rag) => (
                <span key={rag} className="flex items-center gap-1.5">
                  {ragDot(rag)}
                  {RAG_LABEL[rag]}
                </span>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

export function FlightPathFlowSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
