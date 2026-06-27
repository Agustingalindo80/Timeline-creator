// Portfolio FlightPath flow + heatmap aggregation.
//
// Pure functions that turn per-project flow inputs (already enriched with
// dimension scores, current-stage gate status, inferred stage-entry timestamp
// and mandatory-checkpoint counts) into:
//   1. Per-stage distribution buckets for the FlightPath stage view.
//   2. A projects x dimensions heatmap matrix with per-cell RAG + rationale.
//
// All scoring/RAG decisions are reused from the scoring engine; this module only
// groups and rolls them up. Keep it free of DB access so it stays unit-testable.

import {
  type DimensionKey,
  type DimensionScores,
  type Rag,
  scoreToRag,
} from "./portfolio-scoring";

// A project currently has no dedicated stage-entry field, so "expected time in
// stage" cannot be configured yet. Until that data model lands (later task) we
// treat any project that has sat in its current stage longer than this as
// "aging". The threshold is surfaced in the payload so the UI can label it.
export const STAGE_AGING_THRESHOLD_DAYS = 90;

// Gate statuses that represent an executive decision still being required.
const DECISION_GATE = new Set(["exception_requested"]);
// Gate statuses that represent a blocked / failed gate. Kept consistent with the
// portfolio gate-summary semantics in server/reports.ts so the same data never
// shows a different blocked count across the dashboard.
const BLOCKED_GATE = new Set(["rejected", "failed", "exception", "exception_requested"]);

export interface FlowProjectInput {
  id: string;
  title: string;
  flightpathStageId: string | null;
  overallScore: number | null;
  // Status of the gate for the project's CURRENT stage, if any.
  currentGateStatus: string | null;
  // Inferred ISO timestamp of when the project entered its current stage.
  stageEnteredAt: string | null;
  // Mandatory (non-optional) checkpoint counts for the current stage.
  mandatoryTotal: number;
  mandatoryDone: number;
  dimensions: DimensionScores;
  rationales: Record<DimensionKey, string>;
}

export interface FlowStageMeta {
  id: string;
  name: string;
  gateName: string | null;
  sortOrder: number;
}

export interface StageBucket {
  id: string;
  name: string;
  gateName: string | null;
  sortOrder: number;
  projectCount: number;
  avgHealthScore: number | null;
  avgHealthRag: Rag;
  blockedGates: number;
  decisionsRequired: number;
  avgDaysInStage: number | null;
  agingProjects: number;
  agingThresholdDays: number;
  readinessPct: number | null;
}

export interface HeatmapColumn {
  key: DimensionKey;
  label: string;
}

export interface HeatmapCell {
  rag: Rag;
  score: number | null;
  rationale: string;
}

export interface HeatmapRow {
  id: string;
  title: string;
  overallRag: Rag;
  cells: Record<DimensionKey, HeatmapCell>;
}

export interface Heatmap {
  columns: HeatmapColumn[];
  rows: HeatmapRow[];
}

export const HEATMAP_COLUMNS: HeatmapColumn[] = [
  { key: "schedule", label: "Schedule" },
  { key: "financial", label: "Financials" },
  { key: "scope", label: "Scope" },
  { key: "quality", label: "Quality" },
  { key: "risk", label: "Risks" },
  { key: "governance", label: "Governance" },
  { key: "outcome", label: "Outcomes" },
];

const UNASSIGNED_ID = "unassigned";

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.floor((to - from) / (24 * 60 * 60 * 1000)));
}

function buildBucket(
  meta: FlowStageMeta,
  members: FlowProjectInput[],
  nowIso: string,
): StageBucket {
  const scored = members.filter((p) => p.overallScore !== null);
  const avgHealthScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.overallScore ?? 0), 0) / scored.length)
      : null;

  const blockedGates = members.filter(
    (p) => p.currentGateStatus !== null && BLOCKED_GATE.has(p.currentGateStatus),
  ).length;
  const decisionsRequired = members.filter(
    (p) => p.currentGateStatus !== null && DECISION_GATE.has(p.currentGateStatus),
  ).length;

  const withEntry = members.filter((p) => p.stageEnteredAt !== null);
  const daysList = withEntry.map((p) => daysBetween(p.stageEnteredAt as string, nowIso));
  const avgDaysInStage =
    daysList.length > 0
      ? Math.round(daysList.reduce((s, d) => s + d, 0) / daysList.length)
      : null;
  const agingProjects = daysList.filter((d) => d > STAGE_AGING_THRESHOLD_DAYS).length;

  const mandatoryTotal = members.reduce((s, p) => s + p.mandatoryTotal, 0);
  const mandatoryDone = members.reduce((s, p) => s + p.mandatoryDone, 0);
  const readinessPct =
    mandatoryTotal > 0 ? Math.round((mandatoryDone / mandatoryTotal) * 100) : null;

  return {
    id: meta.id,
    name: meta.name,
    gateName: meta.gateName,
    sortOrder: meta.sortOrder,
    projectCount: members.length,
    avgHealthScore,
    avgHealthRag: scoreToRag(avgHealthScore),
    blockedGates,
    decisionsRequired,
    avgDaysInStage,
    agingProjects,
    agingThresholdDays: STAGE_AGING_THRESHOLD_DAYS,
    readinessPct,
  };
}

export function computeStageBuckets(
  projects: FlowProjectInput[],
  stages: FlowStageMeta[],
  nowIso: string,
): StageBucket[] {
  const byStage = new Map<string, FlowProjectInput[]>();
  for (const p of projects) {
    const key = p.flightpathStageId ?? UNASSIGNED_ID;
    const arr = byStage.get(key) ?? [];
    arr.push(p);
    byStage.set(key, arr);
  }

  const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const buckets: StageBucket[] = ordered.map((meta) =>
    buildBucket(meta, byStage.get(meta.id) ?? [], nowIso),
  );

  const unassigned = byStage.get(UNASSIGNED_ID);
  if (unassigned && unassigned.length > 0) {
    buckets.push(
      buildBucket(
        {
          id: UNASSIGNED_ID,
          name: "Unassigned",
          gateName: null,
          sortOrder: Number.MAX_SAFE_INTEGER,
        },
        unassigned,
        nowIso,
      ),
    );
  }

  return buckets;
}

export function buildHeatmap(projects: FlowProjectInput[]): Heatmap {
  const rows: HeatmapRow[] = projects.map((p) => {
    const cells = {} as Record<DimensionKey, HeatmapCell>;
    let worst: Rag = "gray";
    const rank: Record<Rag, number> = { gray: 0, green: 1, amber: 2, red: 3 };
    for (const col of HEATMAP_COLUMNS) {
      const dim = p.dimensions[col.key];
      const cell: HeatmapCell = {
        rag: dim.rag,
        score: dim.score,
        rationale: p.rationales[col.key] ?? "",
      };
      cells[col.key] = cell;
      if (rank[dim.rag] > rank[worst]) worst = dim.rag;
    }
    return { id: p.id, title: p.title, overallRag: worst, cells };
  });

  return { columns: HEATMAP_COLUMNS, rows };
}
