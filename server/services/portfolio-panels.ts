// Portfolio executive panel aggregation + panel-level RAG engine.
//
// Computes four executive panels (Financial Health, Governance / Gate
// Readiness, RAID / Risk, Business Outcome) from already-gathered portfolio
// data. Each panel returns a panel-level RAG plus human-readable `reasons`
// that explain any amber/red rating. Thresholds are centralised in
// `PANEL_THRESHOLDS` so the governance rules stay configurable in one place.

import { type Rag } from "./portfolio-scoring";

export const PANEL_THRESHOLDS = {
  financial: {
    cpiGreen: 0.95,
    cpiRed: 0.85,
    targetMarginPct: 30,
    marginRedDeltaPts: 5,
  },
  raid: {
    // probability x impact severity score (1-4 each, so 1-16).
    escalationScore: 12,
    criticalScore: 9,
  },
  outcome: {
    atRiskRedRatio: 0.25,
  },
} as const;

const SEVERITY: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  very_high: 4,
};

// ---- Input shapes (mirrors fields gathered in reports.ts) ----

export interface PanelGateDetail {
  nextGateName: string | null;
  owner: string | null;
  blockers: string[];
}

export interface PanelProjectInput {
  id: string;
  title: string;
  projectStatus: string;
  estimatedRevenue: string | null;
  approvedBudget: string | null;
  totalRunningCost: string | null;
  grossMargin: string | null;
  flightpathStageName: string | null;
  endDate: string | null;
  evm: {
    cpi: number | null;
    spi: number | null;
    eac: number | null;
    actualCost: number | null;
    earnedValue: number | null;
    plannedValue: number | null;
    bac: number | null;
    vac: number | null;
  } | null;
  gateSummary: { total: number; blocked: number; pending: number; approved: number };
  gateDetail: PanelGateDetail | null;
}

export interface PanelRiskRow {
  timelineId: string;
  id: string;
  title: string;
  probability: string;
  impact: string;
  status: string;
  itemType: string;
  owner: string | null;
  dueDate: string | null;
}

export interface PanelOutcomeRow {
  status: string;
  successMetric: string | null;
  currentValue: string | null;
  evidence: string | null;
}

export interface PanelData {
  missingEvidenceByTimeline: Map<string, number>;
  risks: PanelRiskRow[];
  outcomes: PanelOutcomeRow[];
  titleByTimeline: Map<string, string>;
}

// ---- Output shapes ----

export interface FinancialPanel {
  rag: Rag;
  reasons: string[];
  contractedRevenue: number;
  approvedBudget: number;
  actualCost: number;
  forecastCost: number;
  eac: number;
  earnedValue: number;
  plannedValue: number;
  cpi: number | null;
  spi: number | null;
  costVariance: number;
  scheduleVariance: number;
  vac: number;
  forecastMarginPct: number | null;
  targetMarginPct: number;
  marginLeakage: number;
  projectsWithEvm: number;
  totalProjects: number;
}

export interface GovernanceProjectRow {
  id: string;
  title: string;
  stageName: string | null;
  gateStatus: "blocked" | "in_review" | "on_track" | "not_started";
  nextGateName: string | null;
  owner: string | null;
  targetDate: string | null;
  overdue: boolean;
  blockers: string[];
  missingEvidence: number;
  blocked: number;
}

export interface GovernancePanel {
  rag: Rag;
  reasons: string[];
  totalGates: number;
  blockedGates: number;
  pendingGates: number;
  approvedGates: number;
  projectsBlocked: number;
  projectsOverdue: number;
  missingEvidence: number;
  projectsWithMissingEvidence: number;
  projects: GovernanceProjectRow[];
}

export interface TopRiskRow {
  id: string;
  title: string;
  projectTitle: string;
  timelineId: string;
  score: number;
  probability: string;
  impact: string;
  owner: string | null;
  dueDate: string | null;
}

export interface RaidPanel {
  rag: Rag;
  reasons: string[];
  openRisks: number;
  openAssumptions: number;
  openIssues: number;
  openDependencies: number;
  criticalRisks: number;
  overdueMitigations: number;
  risksWithoutOwner: number;
  needingEscalation: number;
  totalItems: number;
  topRisks: TopRiskRow[];
}

export interface OutcomePanel {
  rag: Rag;
  reasons: string[];
  tracked: number;
  onTrack: number;
  atRisk: number;
  delivered: number;
  notMeasurable: number;
  metricsAvailable: number;
  metricsMissing: number;
  evidenceCaptured: number;
}

export interface PortfolioPanels {
  financial: FinancialPanel;
  governance: GovernancePanel;
  raid: RaidPanel;
  outcome: OutcomePanel;
}

function num(v: string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Local "today" as a YYYY-MM-DD string. Date-only DB columns are stored as
// YYYY-MM-DD; comparing them as strings against local today avoids the UTC
// parsing drift of `new Date("YYYY-MM-DD")`, which would flip same-day dates to
// the previous local day in negative UTC offsets.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// True when a date-only value is strictly before local today.
function isPastDate(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.slice(0, 10) < todayLocalISO();
}

function riskScore(r: { probability: string; impact: string }): number {
  return (SEVERITY[r.probability] ?? 2) * (SEVERITY[r.impact] ?? 2);
}

// ---- Financial panel ----

function computeFinancial(projects: PanelProjectInput[]): FinancialPanel {
  let contractedRevenue = 0;
  let approvedBudget = 0;
  let actualCost = 0;
  let evmActualCost = 0;
  let forecastCost = 0;
  let eac = 0;
  let ev = 0;
  let pv = 0;
  let vac = 0;
  let projectsWithEvm = 0;

  for (const p of projects) {
    contractedRevenue += num(p.estimatedRevenue) || num(p.approvedBudget);
    approvedBudget += num(p.approvedBudget);
    actualCost += p.evm?.actualCost != null ? p.evm.actualCost : num(p.totalRunningCost);
    forecastCost += p.evm?.eac != null ? p.evm.eac : num(p.totalRunningCost);
    if (p.evm) {
      if (p.evm.actualCost != null) evmActualCost += p.evm.actualCost;
      if (p.evm.eac != null) eac += p.evm.eac;
      if (p.evm.earnedValue != null) ev += p.evm.earnedValue;
      if (p.evm.plannedValue != null) pv += p.evm.plannedValue;
      if (p.evm.vac != null) vac += p.evm.vac;
      if (
        p.evm.earnedValue != null ||
        p.evm.actualCost != null ||
        p.evm.plannedValue != null
      ) {
        projectsWithEvm += 1;
      }
    }
  }

  // CPI/SPI and their variances must be derived only from EVM-covered projects.
  // Mixing in fallback totalRunningCost for non-EVM projects would depress CPI
  // (EV/PV come from EVM snapshots only) and misstate the RAG.
  const cpi = evmActualCost > 0 && ev > 0 ? round1((ev / evmActualCost) * 100) / 100 : null;
  const spi = pv > 0 && ev > 0 ? round1((ev / pv) * 100) / 100 : null;
  const costVariance = ev - evmActualCost;
  const scheduleVariance = ev - pv;
  const forecastMarginPct =
    contractedRevenue > 0
      ? round1(((contractedRevenue - forecastCost) / contractedRevenue) * 100)
      : null;
  const marginLeakage = forecastCost - approvedBudget;

  const t = PANEL_THRESHOLDS.financial;
  const reasons: string[] = [];
  let rag: Rag;

  const hasData = projectsWithEvm > 0 || contractedRevenue > 0 || approvedBudget > 0;
  if (!hasData) {
    rag = "gray";
    reasons.push("No financial or EVM data available across the portfolio.");
  } else {
    const cpiRed = cpi !== null && cpi < t.cpiRed;
    const cpiAmber = cpi !== null && cpi < t.cpiGreen;
    const marginRed =
      forecastMarginPct !== null && forecastMarginPct < t.targetMarginPct - t.marginRedDeltaPts;
    const marginAmber = forecastMarginPct !== null && forecastMarginPct < t.targetMarginPct;

    if (cpiRed) reasons.push(`Portfolio CPI ${cpi!.toFixed(2)} below ${t.cpiRed} (cost overrun).`);
    else if (cpiAmber) reasons.push(`Portfolio CPI ${cpi!.toFixed(2)} below target ${t.cpiGreen}.`);

    if (marginRed)
      reasons.push(
        `Forecast margin ${forecastMarginPct}% is more than ${t.marginRedDeltaPts}pts below the ${t.targetMarginPct}% target.`,
      );
    else if (marginAmber)
      reasons.push(`Forecast margin ${forecastMarginPct}% below the ${t.targetMarginPct}% target.`);

    if (marginLeakage > 0)
      reasons.push(`Forecast cost exceeds approved budget by ${Math.round(marginLeakage).toLocaleString()}.`);

    if (cpiRed || marginRed) rag = "red";
    else if (cpiAmber || marginAmber || marginLeakage > 0) rag = "amber";
    else rag = "green";
  }

  return {
    rag,
    reasons,
    contractedRevenue,
    approvedBudget,
    actualCost,
    forecastCost,
    eac,
    earnedValue: ev,
    plannedValue: pv,
    cpi,
    spi,
    costVariance,
    scheduleVariance,
    vac,
    forecastMarginPct,
    targetMarginPct: t.targetMarginPct,
    marginLeakage,
    projectsWithEvm,
    totalProjects: projects.length,
  };
}

// ---- Governance / gate readiness panel ----

function computeGovernance(
  projects: PanelProjectInput[],
  missingEvidenceByTimeline: Map<string, number>,
): GovernancePanel {
  let totalGates = 0;
  let blockedGates = 0;
  let pendingGates = 0;
  let approvedGates = 0;
  let projectsBlocked = 0;
  let projectsOverdue = 0;
  let missingEvidence = 0;
  let projectsWithMissingEvidence = 0;

  const rows: GovernanceProjectRow[] = [];

  for (const p of projects) {
    const gs = p.gateSummary;
    totalGates += gs.total;
    blockedGates += gs.blocked;
    pendingGates += gs.pending;
    approvedGates += gs.approved;

    const missing = missingEvidenceByTimeline.get(p.id) ?? 0;
    missingEvidence += missing;
    if (gs.blocked > 0) projectsBlocked += 1;
    if (missing > 0) projectsWithMissingEvidence += 1;

    // A project's governance is overdue when its due date has passed while gate
    // work is still outstanding (blocked, awaiting review, or missing evidence).
    const hasOutstandingGateWork = gs.blocked > 0 || gs.pending > 0 || missing > 0;
    const overdue = hasOutstandingGateWork && isPastDate(p.endDate);
    if (overdue) projectsOverdue += 1;

    let gateStatus: GovernanceProjectRow["gateStatus"];
    if (gs.blocked > 0) gateStatus = "blocked";
    else if (gs.pending > 0) gateStatus = "in_review";
    else if (gs.approved > 0) gateStatus = "on_track";
    else gateStatus = "not_started";

    if (gs.total > 0 || missing > 0) {
      const blockers = [...(p.gateDetail?.blockers ?? [])];
      if (missing > 0) {
        blockers.unshift(`${missing} mandatory evidence item${missing === 1 ? "" : "s"} outstanding`);
      }
      if (overdue) {
        blockers.unshift("Past due date with gate work outstanding");
      }
      rows.push({
        id: p.id,
        title: p.title,
        stageName: p.flightpathStageName,
        gateStatus,
        nextGateName: p.gateDetail?.nextGateName ?? null,
        owner: p.gateDetail?.owner ?? null,
        targetDate: p.endDate,
        overdue,
        blockers: blockers.slice(0, 4),
        missingEvidence: missing,
        blocked: gs.blocked,
      });
    }
  }

  const reasons: string[] = [];
  let rag: Rag;

  if (totalGates === 0 && missingEvidence === 0) {
    rag = "gray";
    reasons.push("No gate activity or evidence requirements recorded.");
  } else {
    if (blockedGates > 0)
      reasons.push(`${blockedGates} blocked gate${blockedGates === 1 ? "" : "s"} across ${projectsBlocked} project${projectsBlocked === 1 ? "" : "s"}.`);
    if (projectsOverdue > 0)
      reasons.push(`${projectsOverdue} project${projectsOverdue === 1 ? "" : "s"} overdue with gate work outstanding.`);
    if (missingEvidence > 0)
      reasons.push(`${missingEvidence} mandatory evidence item${missingEvidence === 1 ? "" : "s"} outstanding.`);
    if (pendingGates > 0)
      reasons.push(`${pendingGates} gate${pendingGates === 1 ? "" : "s"} awaiting review.`);

    if (blockedGates > 0 || missingEvidence > 0 || projectsOverdue > 0) rag = "red";
    else if (pendingGates > 0) rag = "amber";
    else rag = "green";
  }

  // Surface most-at-risk projects first: overdue, then blocked, then missing evidence.
  rows.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      b.blocked - a.blocked ||
      b.missingEvidence - a.missingEvidence,
  );

  return {
    rag,
    reasons,
    totalGates,
    blockedGates,
    pendingGates,
    approvedGates,
    projectsBlocked,
    projectsOverdue,
    missingEvidence,
    projectsWithMissingEvidence,
    projects: rows,
  };
}

// ---- RAID / risk panel ----

function computeRaid(risks: PanelRiskRow[], titleByTimeline: Map<string, string>): RaidPanel {
  const open = risks.filter((r) => r.status === "open");
  const openOf = (type: string) => open.filter((r) => (r.itemType ?? "risk") === type).length;

  const openRiskItems = open.filter((r) => (r.itemType ?? "risk") === "risk");

  const criticalRisks = openRiskItems.filter(
    (r) => riskScore(r) >= PANEL_THRESHOLDS.raid.criticalScore,
  ).length;
  const overdueMitigations = openRiskItems.filter((r) => isPastDate(r.dueDate)).length;
  const risksWithoutOwner = openRiskItems.filter((r) => !r.owner || !r.owner.trim()).length;
  const needingEscalation = openRiskItems.filter(
    (r) => riskScore(r) >= PANEL_THRESHOLDS.raid.escalationScore,
  ).length;

  const topRisks: TopRiskRow[] = [...openRiskItems]
    .map((r) => ({
      id: r.id,
      title: r.title,
      projectTitle: titleByTimeline.get(r.timelineId) ?? "Unknown project",
      timelineId: r.timelineId,
      score: riskScore(r),
      probability: r.probability,
      impact: r.impact,
      owner: r.owner,
      dueDate: r.dueDate,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const reasons: string[] = [];
  let rag: Rag;

  if (risks.length === 0) {
    rag = "gray";
    reasons.push("No RAID items logged across the portfolio.");
  } else {
    if (criticalRisks > 0)
      reasons.push(`${criticalRisks} critical open risk${criticalRisks === 1 ? "" : "s"}.`);
    if (overdueMitigations > 0)
      reasons.push(`${overdueMitigations} risk${overdueMitigations === 1 ? "" : "s"} with overdue mitigation.`);
    if (needingEscalation > 0)
      reasons.push(`${needingEscalation} risk${needingEscalation === 1 ? "" : "s"} need escalation.`);
    if (risksWithoutOwner > 0)
      reasons.push(`${risksWithoutOwner} open risk${risksWithoutOwner === 1 ? "" : "s"} without an owner.`);
    if (openOf("issue") > 0)
      reasons.push(`${openOf("issue")} open issue${openOf("issue") === 1 ? "" : "s"}.`);

    if (criticalRisks > 0 || overdueMitigations > 0) rag = "red";
    else if (openRiskItems.length > 0 || openOf("issue") > 0 || risksWithoutOwner > 0) rag = "amber";
    else rag = "green";
  }

  return {
    rag,
    reasons,
    openRisks: openOf("risk"),
    openAssumptions: openOf("assumption"),
    openIssues: openOf("issue"),
    openDependencies: openOf("dependency"),
    criticalRisks,
    overdueMitigations,
    risksWithoutOwner,
    needingEscalation,
    totalItems: risks.length,
    topRisks,
  };
}

// ---- Business outcome panel ----

function hasText(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0;
}

function computeOutcome(outcomes: PanelOutcomeRow[]): OutcomePanel {
  const tracked = outcomes.length;
  const onTrack = outcomes.filter((o) => o.status === "active" || o.status === "achieved").length;
  const delivered = outcomes.filter((o) => o.status === "achieved").length;
  const atRisk = outcomes.filter((o) => o.status === "at_risk").length;
  const metricsAvailable = outcomes.filter((o) => hasText(o.successMetric)).length;
  const metricsMissing = tracked - metricsAvailable;
  const notMeasurable = outcomes.filter(
    (o) => !hasText(o.successMetric) || !hasText(o.currentValue),
  ).length;
  const evidenceCaptured = outcomes.filter((o) => hasText(o.evidence)).length;

  const reasons: string[] = [];
  let rag: Rag;

  if (tracked === 0) {
    rag = "gray";
    reasons.push("No business outcomes are being tracked.");
  } else {
    const atRiskRatio = atRisk / tracked;
    if (atRisk > 0)
      reasons.push(`${atRisk} outcome${atRisk === 1 ? "" : "s"} flagged at risk.`);
    if (metricsMissing > 0)
      reasons.push(`${metricsMissing} outcome${metricsMissing === 1 ? "" : "s"} missing a success metric.`);

    if (atRiskRatio >= PANEL_THRESHOLDS.outcome.atRiskRedRatio) rag = "red";
    else if (atRisk > 0 || metricsMissing > 0) rag = "amber";
    else rag = "green";
  }

  return {
    rag,
    reasons,
    tracked,
    onTrack,
    atRisk,
    delivered,
    notMeasurable,
    metricsAvailable,
    metricsMissing,
    evidenceCaptured,
  };
}

export function computePanels(
  projects: PanelProjectInput[],
  data: PanelData,
): PortfolioPanels {
  return {
    financial: computeFinancial(projects),
    governance: computeGovernance(projects, data.missingEvidenceByTimeline),
    raid: computeRaid(data.risks, data.titleByTimeline),
    outcome: computeOutcome(data.outcomes),
  };
}

export function emptyPanels(): PortfolioPanels {
  return {
    financial: computeFinancial([]),
    governance: computeGovernance([], new Map()),
    raid: computeRaid([], new Map()),
    outcome: computeOutcome([]),
  };
}
