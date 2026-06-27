// Portfolio Health weighted scoring engine.
//
// Produces a 0-100 score and a RAG rating for each governance dimension of a
// project, then rolls those up into a single weighted health score. Dimensions
// without a usable data source return a `null` score (rendered as "Gray" /
// insufficient data) and are EXCLUDED from the weighted average rather than
// counted as zero.

export type Rag = "green" | "amber" | "red" | "gray";

export type DimensionKey =
  | "schedule"
  | "financial"
  | "scope"
  | "quality"
  | "risk"
  | "governance"
  | "outcome";

export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  schedule: 0.2,
  financial: 0.2,
  scope: 0.15,
  quality: 0.15,
  risk: 0.15,
  governance: 0.1,
  outcome: 0.05,
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  schedule: "Schedule",
  financial: "Financial",
  scope: "Scope",
  quality: "Quality",
  risk: "Risk",
  governance: "Governance",
  outcome: "Outcome",
};

export interface DimensionScore {
  score: number | null; // null => insufficient data (gray)
  rag: Rag;
}

export type DimensionScores = Record<DimensionKey, DimensionScore>;

export interface ProjectScoreResult {
  dimensions: DimensionScores;
  overallScore: number | null;
  overallRag: Rag;
}

const HealthRag = ["green", "amber", "red"] as const;
type HealthRag = (typeof HealthRag)[number];

// Map a project's existing RAG enum value to a representative numeric score
// inside the correct band (green >= 85, amber 70-84, red < 70).
const RAG_TO_SCORE: Record<HealthRag, number> = {
  green: 90,
  amber: 77,
  red: 60,
};

export function scoreToRag(score: number | null): Rag {
  if (score === null || Number.isNaN(score)) return "gray";
  if (score >= 85) return "green";
  if (score >= 70) return "amber";
  return "red";
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function ragScore(rag: string | null | undefined): number | null {
  if (rag === "green" || rag === "amber" || rag === "red") {
    return RAG_TO_SCORE[rag];
  }
  return null;
}

// Convert an EVM performance index (CPI or SPI, where 1.0 is on-plan) into a
// 0-100 score. >= 1.0 is excellent; degrades smoothly below plan.
function indexToScore(index: number | null | undefined): number | null {
  if (index === null || index === undefined || Number.isNaN(index)) return null;
  if (index >= 1.0) return 100;
  if (index >= 0.95) return 88;
  if (index >= 0.9) return 80;
  if (index >= 0.85) return 72;
  // Below 0.85 falls into the red band, scaled down by how far off-plan it is.
  return clamp(72 - (0.85 - index) * 200, 30, 72);
}

const SEVERITY: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  very_high: 4,
};

export interface RiskInput {
  probability: string;
  impact: string;
  status: string;
  itemType?: string;
}

export interface GateInput {
  status: string;
}

export interface OutcomeInput {
  status: string;
}

export interface ProjectMetricsInput {
  // Existing per-project RAG values (always present on a project row).
  healthOverall?: string | null;
  scopeHealth?: string | null;
  budgetHealth?: string | null;
  teamHealth?: string | null;
  // Latest current EVM snapshot indices, if any.
  cpi?: number | null;
  spi?: number | null;
  grossMargin?: number | null;
  // Governance / RAID / value data sources.
  risks?: RiskInput[];
  gates?: GateInput[];
  outcomes?: OutcomeInput[];
}

function scoreSchedule(m: ProjectMetricsInput): number | null {
  const fromEvm = indexToScore(m.spi);
  if (fromEvm !== null) return fromEvm;
  // Fall back to the project's overall RAG as a schedule proxy.
  return ragScore(m.healthOverall);
}

function scoreFinancial(m: ProjectMetricsInput): number | null {
  let base = indexToScore(m.cpi);
  if (base === null) {
    base = ragScore(m.budgetHealth);
  }
  if (base === null) return null;
  // A negative gross margin caps the financial dimension into the red band.
  if (m.grossMargin !== null && m.grossMargin !== undefined && m.grossMargin < 0) {
    base = Math.min(base, 60);
  }
  return base;
}

function scoreScope(m: ProjectMetricsInput): number | null {
  return ragScore(m.scopeHealth);
}

// Quality has no data source yet -> always insufficient data (gray).
function scoreQuality(_m: ProjectMetricsInput): number | null {
  return null;
}

function scoreRisk(m: ProjectMetricsInput): number | null {
  const open = (m.risks ?? []).filter(
    (r) => (r.itemType ?? "risk") === "risk" && r.status === "open",
  );
  if (open.length === 0) return 95;
  let worst = 0;
  for (const r of open) {
    const sev = (SEVERITY[r.probability] ?? 2) * (SEVERITY[r.impact] ?? 2);
    if (sev > worst) worst = sev;
  }
  if (worst >= 12) return 58;
  if (worst >= 9) return 68;
  if (worst >= 6) return 78;
  if (worst >= 3) return 86;
  return 92;
}

function scoreGovernance(m: ProjectMetricsInput): number | null {
  const gates = m.gates ?? [];
  if (gates.length === 0) return null;
  const has = (s: string) => gates.some((g) => g.status === s);
  if (has("rejected") || has("failed")) return 60;
  if (has("exception") || has("exception_requested")) return 72;
  if (has("pending") || has("in_review")) return 80;
  // All gates approved / passed.
  return 95;
}

const OUTCOME_SCORE: Record<string, number> = {
  achieved: 100,
  active: 85,
  draft: 78,
  at_risk: 60,
  cancelled: 55,
};

function scoreOutcome(m: ProjectMetricsInput): number | null {
  const outcomes = m.outcomes ?? [];
  if (outcomes.length === 0) return null;
  const sum = outcomes.reduce((acc, o) => acc + (OUTCOME_SCORE[o.status] ?? 78), 0);
  return Math.round(sum / outcomes.length);
}

const SCORERS: Record<DimensionKey, (m: ProjectMetricsInput) => number | null> = {
  schedule: scoreSchedule,
  financial: scoreFinancial,
  scope: scoreScope,
  quality: scoreQuality,
  risk: scoreRisk,
  governance: scoreGovernance,
  outcome: scoreOutcome,
};

// Short, human-readable rationale per dimension. Mirrors the scorer logic above
// so a heatmap tooltip can explain *why* a cell is the colour it is. Keep these
// consistent with the corresponding `score*` functions.
function severityLabel(sev: number): string {
  if (sev >= 12) return "critical";
  if (sev >= 9) return "high";
  if (sev >= 6) return "elevated";
  if (sev >= 3) return "moderate";
  return "low";
}

function rationaleSchedule(m: ProjectMetricsInput): string {
  if (m.spi !== null && m.spi !== undefined && !Number.isNaN(m.spi)) {
    const tone = m.spi >= 1 ? "on or ahead of schedule" : m.spi >= 0.95 ? "slightly behind schedule" : "behind schedule";
    return `SPI ${m.spi.toFixed(2)} — ${tone}`;
  }
  if (ragScore(m.healthOverall) !== null) return `Schedule proxy: overall health ${m.healthOverall}`;
  return "No schedule data";
}

function rationaleFinancial(m: ProjectMetricsInput): string {
  const marginNote =
    m.grossMargin !== null && m.grossMargin !== undefined && m.grossMargin < 0 ? "; negative gross margin" : "";
  if (m.cpi !== null && m.cpi !== undefined && !Number.isNaN(m.cpi)) {
    const tone = m.cpi >= 1 ? "on or under budget" : m.cpi >= 0.95 ? "slightly over budget" : "over budget";
    return `CPI ${m.cpi.toFixed(2)} — ${tone}${marginNote}`;
  }
  if (ragScore(m.budgetHealth) !== null) return `Budget health: ${m.budgetHealth}${marginNote}`;
  return "No financial data";
}

function rationaleScope(m: ProjectMetricsInput): string {
  if (ragScore(m.scopeHealth) !== null) return `Scope health: ${m.scopeHealth}`;
  return "No scope data";
}

function rationaleRisk(m: ProjectMetricsInput): string {
  const open = (m.risks ?? []).filter((r) => (r.itemType ?? "risk") === "risk" && r.status === "open");
  if (open.length === 0) return "No open risks";
  let worst = 0;
  for (const r of open) {
    const sev = (SEVERITY[r.probability] ?? 2) * (SEVERITY[r.impact] ?? 2);
    if (sev > worst) worst = sev;
  }
  return `${open.length} open risk${open.length === 1 ? "" : "s"}; worst severity ${severityLabel(worst)}`;
}

function rationaleGovernance(m: ProjectMetricsInput): string {
  const gates = m.gates ?? [];
  if (gates.length === 0) return "No gates configured";
  const has = (s: string) => gates.some((g) => g.status === s);
  if (has("rejected") || has("failed")) return "Gate rejected or failed";
  if (has("exception") || has("exception_requested")) return "Gate exception pending";
  if (has("pending") || has("in_review")) return "Gate in review";
  return "All gates approved";
}

function rationaleOutcome(m: ProjectMetricsInput): string {
  const outcomes = m.outcomes ?? [];
  if (outcomes.length === 0) return "No outcomes linked";
  const atRisk = outcomes.filter((o) => o.status === "at_risk").length;
  if (atRisk > 0) return `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"}; ${atRisk} at risk`;
  const achieved = outcomes.filter((o) => o.status === "achieved").length;
  if (achieved === outcomes.length) return `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"} achieved`;
  return `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"} on track`;
}

const RATIONALES: Record<DimensionKey, (m: ProjectMetricsInput) => string> = {
  schedule: rationaleSchedule,
  financial: rationaleFinancial,
  scope: rationaleScope,
  quality: () => "No quality data captured yet",
  risk: rationaleRisk,
  governance: rationaleGovernance,
  outcome: rationaleOutcome,
};

export function buildDimensionRationales(m: ProjectMetricsInput): Record<DimensionKey, string> {
  const out = {} as Record<DimensionKey, string>;
  (Object.keys(RATIONALES) as DimensionKey[]).forEach((key) => {
    out[key] = RATIONALES[key](m);
  });
  return out;
}

export function scoreProject(m: ProjectMetricsInput): ProjectScoreResult {
  const dimensions = {} as DimensionScores;
  let weightedSum = 0;
  let totalWeight = 0;

  (Object.keys(SCORERS) as DimensionKey[]).forEach((key) => {
    const raw = SCORERS[key](m);
    const score = raw === null ? null : Math.round(clamp(raw));
    dimensions[key] = { score, rag: scoreToRag(score) };
    if (score !== null) {
      weightedSum += score * DIMENSION_WEIGHTS[key];
      totalWeight += DIMENSION_WEIGHTS[key];
    }
  });

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  return {
    dimensions,
    overallScore,
    overallRag: scoreToRag(overallScore),
  };
}
