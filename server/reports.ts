import { eq, and, inArray, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  timelines,
  milestones,
  tasks,
  risks,
  clients,
  evmSnapshots,
  projectTeamMembers,
  businessOutcomes,
  teamMembers,
  projectGates,
  flightpathStages,
  projectCheckpoints,
} from "@shared/schema";
import {
  scoreProject,
  scoreToRag,
  DIMENSION_WEIGHTS,
  type Rag,
  type DimensionScores,
  type RiskInput,
  type GateInput,
  type OutcomeInput,
} from "./services/portfolio-scoring";
import {
  computePanels,
  emptyPanels,
  type PortfolioPanels,
  type PanelRiskRow,
  type PanelOutcomeRow,
} from "./services/portfolio-panels";

type RecordAccessContext = {
  isGlobal: boolean;
  assignedTimelineIds: string[];
};

export async function getPortfolioHealth(tenantId: string, filters: {
  clientId?: string;
  region?: string;
  status?: string;
  healthFilter?: string;
}) {
  const conditions: any[] = [
    eq(timelines.tenantId, tenantId),
    eq(timelines.recordType, "project"),
  ];

  if (filters.clientId) {
    conditions.push(eq(timelines.clientId, filters.clientId));
  }
  if (filters.region) {
    conditions.push(eq(timelines.region, filters.region));
  }
  if (filters.status) {
    conditions.push(eq(timelines.projectStatus, filters.status as any));
  }
  if (filters.healthFilter) {
    conditions.push(eq(timelines.healthOverall, filters.healthFilter as any));
  }

  const projects = await db
    .select({
      id: timelines.id,
      title: timelines.title,
      clientId: timelines.clientId,
      region: timelines.region,
      healthOverall: timelines.healthOverall,
      scopeHealth: timelines.scopeHealth,
      budgetHealth: timelines.budgetHealth,
      teamHealth: timelines.teamHealth,
      projectStatus: timelines.projectStatus,
      startDate: timelines.startDate,
      endDate: timelines.endDate,
      flightpathStageId: timelines.flightpathStageId,
      approvedBudget: timelines.approvedBudget,
      totalRunningCost: timelines.totalRunningCost,
      grossMargin: timelines.grossMargin,
    })
    .from(timelines)
    .where(and(...conditions));

  const clientIds = Array.from(new Set(projects.map(p => p.clientId).filter(Boolean))) as string[];
  let clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const clientRows = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(inArray(clients.id, clientIds), eq(clients.tenantId, tenantId)));
    clientMap = Object.fromEntries(clientRows.map(c => [c.id, c.name]));
  }

  return projects.map(p => ({
    ...p,
    clientName: p.clientId ? clientMap[p.clientId] || null : null,
  }));
}

function num(v: string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

export interface PortfolioProjectOverview {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  region: string | null;
  projectStatus: string;
  startDate: string | null;
  endDate: string | null;
  flightpathStageId: string | null;
  flightpathStageName: string | null;
  healthOverall: string;
  scopeHealth: string;
  budgetHealth: string;
  teamHealth: string;
  approvedBudget: string | null;
  totalRunningCost: string | null;
  grossMargin: string | null;
  estimatedRevenue: string | null;
  evm: {
    cpi: number | null;
    spi: number | null;
    eac: number | null;
    actualCost: number | null;
    earnedValue: number | null;
    plannedValue: number | null;
    bac: number | null;
    vac: number | null;
    weekEnding: string | null;
  } | null;
  openRiskCount: number;
  openCriticalRiskCount: number;
  gateSummary: { total: number; blocked: number; pending: number; approved: number };
  outcomeCount: number;
  dimensions: DimensionScores;
  overallScore: number | null;
  overallRag: Rag;
}

export interface PortfolioOverview {
  generatedAt: string;
  header: {
    healthScore: number | null;
    healthRag: Rag;
    activeProjects: number;
    totalProjects: number;
    clientCount: number;
    totalContractValue: number;
    forecastRevenue: number;
    forecastMarginPct: number | null;
    riskExposure: number;
    projectsRequiringAttention: number;
  };
  kpis: {
    greenProjects: number;
    amberProjects: number;
    redProjects: number;
    grayProjects: number;
    totalBudget: number;
    actualCost: number;
    forecastCost: number;
    openCriticalRisks: number;
    blockedGates: number;
    upcomingGoLives: number;
    outcomesOnTrack: number;
  };
  panels: PortfolioPanels;
  projects: PortfolioProjectOverview[];
}

export async function getPortfolioOverview(
  tenantId: string,
  ctx: RecordAccessContext,
): Promise<PortfolioOverview> {
  const projectRows = await db
    .select({
      id: timelines.id,
      title: timelines.title,
      clientId: timelines.clientId,
      region: timelines.region,
      healthOverall: timelines.healthOverall,
      scopeHealth: timelines.scopeHealth,
      budgetHealth: timelines.budgetHealth,
      teamHealth: timelines.teamHealth,
      projectStatus: timelines.projectStatus,
      startDate: timelines.startDate,
      endDate: timelines.endDate,
      flightpathStageId: timelines.flightpathStageId,
      approvedBudget: timelines.approvedBudget,
      totalRunningCost: timelines.totalRunningCost,
      grossMargin: timelines.grossMargin,
      estimatedRevenue: timelines.estimatedRevenue,
    })
    .from(timelines)
    .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "project")));

  const accessible = ctx.isGlobal
    ? projectRows
    : projectRows.filter((p) => ctx.assignedTimelineIds.includes(p.id));

  const ids = accessible.map((p) => p.id);

  if (ids.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      header: {
        healthScore: null,
        healthRag: "gray",
        activeProjects: 0,
        totalProjects: 0,
        clientCount: 0,
        totalContractValue: 0,
        forecastRevenue: 0,
        forecastMarginPct: null,
        riskExposure: 0,
        projectsRequiringAttention: 0,
      },
      kpis: {
        greenProjects: 0,
        amberProjects: 0,
        redProjects: 0,
        grayProjects: 0,
        totalBudget: 0,
        actualCost: 0,
        forecastCost: 0,
        openCriticalRisks: 0,
        blockedGates: 0,
        upcomingGoLives: 0,
        outcomesOnTrack: 0,
      },
      panels: emptyPanels(),
      projects: [],
    };
  }

  const [clientRows, evmRows, riskRows, gateRows, stageRows, outcomeRows, checkpointRows] =
    await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.tenantId, tenantId)),
      db
        .select({
          timelineId: evmSnapshots.timelineId,
          weekEnding: evmSnapshots.weekEnding,
          cpiValue: evmSnapshots.cpiValue,
          spiValue: evmSnapshots.spiValue,
          eacValue: evmSnapshots.eacValue,
          actualCost: evmSnapshots.actualCost,
          earnedValue: evmSnapshots.earnedValue,
          plannedValue: evmSnapshots.plannedValue,
          bac: evmSnapshots.bac,
          vacValue: evmSnapshots.vacValue,
        })
        .from(evmSnapshots)
        .where(
          and(
            eq(evmSnapshots.tenantId, tenantId),
            eq(evmSnapshots.isCurrent, true),
            inArray(evmSnapshots.timelineId, ids),
          ),
        ),
      db
        .select({
          id: risks.id,
          timelineId: risks.timelineId,
          title: risks.title,
          probability: risks.probability,
          impact: risks.impact,
          status: risks.status,
          itemType: risks.itemType,
          owner: risks.owner,
          dueDate: risks.dueDate,
        })
        .from(risks)
        .where(and(eq(risks.tenantId, tenantId), inArray(risks.timelineId, ids))),
      db
        .select({
          timelineId: projectGates.timelineId,
          status: projectGates.status,
        })
        .from(projectGates)
        .where(and(eq(projectGates.tenantId, tenantId), inArray(projectGates.timelineId, ids))),
      db
        .select({ id: flightpathStages.id, name: flightpathStages.name })
        .from(flightpathStages)
        .where(eq(flightpathStages.tenantId, tenantId)),
      db
        .select({
          projectId: businessOutcomes.projectId,
          status: businessOutcomes.status,
          successMetric: businessOutcomes.successMetric,
          currentValue: businessOutcomes.currentValue,
          evidence: businessOutcomes.evidence,
        })
        .from(businessOutcomes)
        .where(and(eq(businessOutcomes.tenantId, tenantId), inArray(businessOutcomes.projectId, ids))),
      db
        .select({
          timelineId: projectCheckpoints.timelineId,
          optional: projectCheckpoints.optional,
          completed: projectCheckpoints.completed,
        })
        .from(projectCheckpoints)
        .where(and(eq(projectCheckpoints.tenantId, tenantId), inArray(projectCheckpoints.timelineId, ids))),
    ]);

  const clientMap = new Map(clientRows.map((c) => [c.id, c.name]));
  const stageMap = new Map(stageRows.map((s) => [s.id, s.name]));

  // Latest current EVM snapshot per timeline (max weekEnding).
  const evmByTimeline = new Map<string, (typeof evmRows)[number]>();
  for (const e of evmRows) {
    const existing = evmByTimeline.get(e.timelineId);
    if (!existing || (e.weekEnding ?? "") > (existing.weekEnding ?? "")) {
      evmByTimeline.set(e.timelineId, e);
    }
  }

  const risksByTimeline = new Map<string, RiskInput[]>();
  for (const r of riskRows) {
    const arr = risksByTimeline.get(r.timelineId) ?? [];
    arr.push({ probability: r.probability, impact: r.impact, status: r.status, itemType: r.itemType });
    risksByTimeline.set(r.timelineId, arr);
  }

  const gatesByTimeline = new Map<string, GateInput[]>();
  for (const g of gateRows) {
    const arr = gatesByTimeline.get(g.timelineId) ?? [];
    arr.push({ status: g.status });
    gatesByTimeline.set(g.timelineId, arr);
  }

  const outcomesByTimeline = new Map<string, OutcomeInput[]>();
  for (const o of outcomeRows) {
    if (!o.projectId) continue;
    const arr = outcomesByTimeline.get(o.projectId) ?? [];
    arr.push({ status: o.status });
    outcomesByTimeline.set(o.projectId, arr);
  }

  const isCritical = (r: RiskInput) =>
    (r.itemType ?? "risk") === "risk" &&
    r.status === "open" &&
    ["high", "very_high"].includes(r.probability) &&
    ["high", "very_high"].includes(r.impact);

  const BLOCKED_GATE = new Set(["rejected", "failed", "exception", "exception_requested"]);
  const PENDING_GATE = new Set(["pending", "in_review"]);
  const APPROVED_GATE = new Set(["approved", "passed"]);

  const now = new Date();
  const goLiveCutoff = new Date();
  goLiveCutoff.setDate(goLiveCutoff.getDate() + 30);

  const projects: PortfolioProjectOverview[] = accessible.map((p) => {
    const evm = evmByTimeline.get(p.id);
    const projectRisks = risksByTimeline.get(p.id) ?? [];
    const projectGatesList = gatesByTimeline.get(p.id) ?? [];
    const projectOutcomes = outcomesByTimeline.get(p.id) ?? [];

    const cpi = evm?.cpiValue != null ? num(evm.cpiValue) : null;
    const spi = evm?.spiValue != null ? num(evm.spiValue) : null;

    const result = scoreProject({
      healthOverall: p.healthOverall,
      scopeHealth: p.scopeHealth,
      budgetHealth: p.budgetHealth,
      teamHealth: p.teamHealth,
      cpi,
      spi,
      grossMargin: p.grossMargin != null ? num(p.grossMargin) : null,
      risks: projectRisks,
      gates: projectGatesList,
      outcomes: projectOutcomes,
    });

    const openRisks = projectRisks.filter(
      (r) => (r.itemType ?? "risk") === "risk" && r.status === "open",
    );

    return {
      id: p.id,
      title: p.title,
      clientId: p.clientId,
      clientName: p.clientId ? clientMap.get(p.clientId) ?? null : null,
      region: p.region,
      projectStatus: p.projectStatus,
      startDate: p.startDate,
      endDate: p.endDate,
      flightpathStageId: p.flightpathStageId,
      flightpathStageName: p.flightpathStageId ? stageMap.get(p.flightpathStageId) ?? null : null,
      healthOverall: p.healthOverall,
      scopeHealth: p.scopeHealth,
      budgetHealth: p.budgetHealth,
      teamHealth: p.teamHealth,
      approvedBudget: p.approvedBudget,
      totalRunningCost: p.totalRunningCost,
      grossMargin: p.grossMargin,
      estimatedRevenue: p.estimatedRevenue,
      evm: evm
        ? {
            cpi,
            spi,
            eac: evm.eacValue != null ? num(evm.eacValue) : null,
            actualCost: evm.actualCost != null ? num(evm.actualCost) : null,
            earnedValue: evm.earnedValue != null ? num(evm.earnedValue) : null,
            plannedValue: evm.plannedValue != null ? num(evm.plannedValue) : null,
            bac: evm.bac != null ? num(evm.bac) : null,
            vac: evm.vacValue != null ? num(evm.vacValue) : null,
            weekEnding: evm.weekEnding ?? null,
          }
        : null,
      openRiskCount: openRisks.length,
      openCriticalRiskCount: projectRisks.filter(isCritical).length,
      gateSummary: {
        total: projectGatesList.length,
        blocked: projectGatesList.filter((g) => BLOCKED_GATE.has(g.status)).length,
        pending: projectGatesList.filter((g) => PENDING_GATE.has(g.status)).length,
        approved: projectGatesList.filter((g) => APPROVED_GATE.has(g.status)).length,
      },
      outcomeCount: projectOutcomes.length,
      dimensions: result.dimensions,
      overallScore: result.overallScore,
      overallRag: result.overallRag,
    };
  });

  // ---- Aggregate header + KPI rollups ----
  const scored = projects.filter((p) => p.overallScore !== null);
  const healthScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.overallScore ?? 0), 0) / scored.length)
      : null;

  const clientIdSet = new Set(projects.map((p) => p.clientId).filter(Boolean));
  const totalBudget = projects.reduce((s, p) => s + num(p.approvedBudget), 0);
  const actualCost = projects.reduce(
    (s, p) => s + (p.evm?.actualCost != null ? p.evm.actualCost : num(p.totalRunningCost)),
    0,
  );
  const forecastCost = projects.reduce(
    (s, p) => s + (p.evm?.eac != null ? p.evm.eac : num(p.totalRunningCost)),
    0,
  );
  const forecastRevenue = projects.reduce(
    (s, p) => s + (num(p.estimatedRevenue) || num(p.approvedBudget)),
    0,
  );
  const totalContractValue = forecastRevenue;
  const forecastMarginPct =
    forecastRevenue > 0
      ? Math.round(((forecastRevenue - forecastCost) / forecastRevenue) * 1000) / 10
      : null;
  const openCriticalRisks = projects.reduce((s, p) => s + p.openCriticalRiskCount, 0);
  const blockedGates = projects.reduce((s, p) => s + p.gateSummary.blocked, 0);
  const upcomingGoLives = projects.filter((p) => {
    if (!p.endDate || p.projectStatus === "completed") return false;
    const d = new Date(p.endDate);
    return d >= now && d <= goLiveCutoff;
  }).length;
  const outcomesOnTrack = outcomeRows.filter(
    (o) => o.status === "active" || o.status === "achieved",
  ).length;

  const countRag = (rag: Rag) => projects.filter((p) => p.overallRag === rag).length;

  // ---- Executive panel data ----
  const missingEvidenceByTimeline = new Map<string, number>();
  for (const c of checkpointRows) {
    if (c.optional || c.completed) continue;
    missingEvidenceByTimeline.set(c.timelineId, (missingEvidenceByTimeline.get(c.timelineId) ?? 0) + 1);
  }

  const titleByTimeline = new Map(projects.map((p) => [p.id, p.title]));
  const panelRisks: PanelRiskRow[] = riskRows.map((r) => ({
    id: r.id,
    timelineId: r.timelineId,
    title: r.title,
    probability: r.probability,
    impact: r.impact,
    status: r.status,
    itemType: r.itemType,
    owner: r.owner,
    dueDate: r.dueDate,
  }));
  const panelOutcomes: PanelOutcomeRow[] = outcomeRows.map((o) => ({
    status: o.status,
    successMetric: o.successMetric,
    currentValue: o.currentValue,
    evidence: o.evidence,
  }));

  const panels = computePanels(projects, {
    missingEvidenceByTimeline,
    risks: panelRisks,
    outcomes: panelOutcomes,
    titleByTimeline,
  });

  return {
    generatedAt: new Date().toISOString(),
    header: {
      healthScore,
      healthRag: scoreToRag(healthScore),
      activeProjects: projects.filter((p) => p.projectStatus !== "completed").length,
      totalProjects: projects.length,
      clientCount: clientIdSet.size,
      totalContractValue,
      forecastRevenue,
      forecastMarginPct,
      riskExposure: openCriticalRisks,
      projectsRequiringAttention: countRag("red"),
    },
    kpis: {
      greenProjects: countRag("green"),
      amberProjects: countRag("amber"),
      redProjects: countRag("red"),
      grayProjects: countRag("gray"),
      totalBudget,
      actualCost,
      forecastCost,
      openCriticalRisks,
      blockedGates,
      upcomingGoLives,
      outcomesOnTrack,
    },
    panels,
    projects,
  };
}

export async function getProjectStatusReport(tenantId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(timelines)
    .where(and(eq(timelines.id, projectId), eq(timelines.tenantId, tenantId)));

  if (!project) return null;

  const projectTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.timelineId, projectId), eq(tasks.tenantId, tenantId)));

  const totalTasks = projectTasks.length;
  const completeTasks = projectTasks.filter(t => t.status === "complete").length;
  const inProgressTasks = projectTasks.filter(t => t.status === "in_progress").length;
  const notStartedTasks = projectTasks.filter(t => t.status === "not_started").length;

  const projectMilestones = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.timelineId, projectId), eq(milestones.tenantId, tenantId)));

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const totalMilestones = projectMilestones.length;
  const upcomingMilestones = projectMilestones.filter(m => {
    const d = new Date(m.date);
    return d >= now && d <= thirtyDaysFromNow && !m.actualDate;
  }).length;
  const overdueMilestones = projectMilestones.filter(m => {
    const d = new Date(m.date);
    return d < now && !m.actualDate;
  }).length;

  const raidItems = await db
    .select()
    .from(risks)
    .where(and(eq(risks.timelineId, projectId), eq(risks.tenantId, tenantId)));

  const openRisks = raidItems.filter(r => r.itemType === "risk" && r.status === "open").length;
  const openIssues = raidItems.filter(r => r.itemType === "issue" && r.status === "open").length;
  const openDependencies = raidItems.filter(r => r.itemType === "dependency" && r.status === "open").length;

  const [latestEvm] = await db
    .select()
    .from(evmSnapshots)
    .where(and(eq(evmSnapshots.timelineId, projectId), eq(evmSnapshots.isCurrent, true), eq(evmSnapshots.tenantId, tenantId)))
    .orderBy(sql`${evmSnapshots.weekEnding} DESC`)
    .limit(1);

  const teamCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(projectTeamMembers)
    .where(and(eq(projectTeamMembers.timelineId, projectId), eq(projectTeamMembers.tenantId, tenantId)));

  let clientName: string | null = null;
  if (project.clientId) {
    const [c] = await db.select({ name: clients.name }).from(clients).where(and(eq(clients.id, project.clientId), eq(clients.tenantId, tenantId)));
    clientName = c?.name || null;
  }

  return {
    id: project.id,
    title: project.title,
    clientName,
    region: project.region,
    healthOverall: project.healthOverall,
    scopeHealth: project.scopeHealth,
    budgetHealth: project.budgetHealth,
    teamHealth: project.teamHealth,
    projectStatus: project.projectStatus,
    flightpathStageId: project.flightpathStageId,
    startDate: project.startDate,
    endDate: project.endDate,
    approvedBudget: project.approvedBudget,
    totalRunningCost: project.totalRunningCost,
    grossMargin: project.grossMargin,
    tasksSummary: {
      total: totalTasks,
      complete: completeTasks,
      inProgress: inProgressTasks,
      notStarted: notStartedTasks,
      percentComplete: totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0,
    },
    milestonesSummary: {
      total: totalMilestones,
      upcoming: upcomingMilestones,
      overdue: overdueMilestones,
    },
    raidSummary: {
      openRisks,
      openIssues,
      openDependencies,
    },
    evm: latestEvm ? {
      cpi: latestEvm.cpiValue,
      spi: latestEvm.spiValue,
      weekEnding: latestEvm.weekEnding,
    } : null,
    teamMemberCount: Number(teamCount[0]?.count || 0),
  };
}

export async function getMilestonesReport(tenantId: string, filters: {
  dateFrom?: string;
  dateTo?: string;
  financialOnly?: boolean;
  projectId?: string;
}) {
  const conditions: any[] = [eq(milestones.tenantId, tenantId)];

  if (filters.projectId) {
    conditions.push(eq(milestones.timelineId, filters.projectId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(milestones.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(milestones.date, filters.dateTo));
  }
  if (filters.financialOnly) {
    conditions.push(eq(milestones.isFinancialObligation, true));
  }

  const allMilestones = await db
    .select({
      id: milestones.id,
      timelineId: milestones.timelineId,
      title: milestones.title,
      date: milestones.date,
      actualDate: milestones.actualDate,
      isFinancialObligation: milestones.isFinancialObligation,
      amount: milestones.amount,
    })
    .from(milestones)
    .where(and(...conditions));

  const timelineIds = Array.from(new Set(allMilestones.map(m => m.timelineId)));
  let projectMap: Record<string, string> = {};
  if (timelineIds.length > 0) {
    const projectRows = await db
      .select({ id: timelines.id, title: timelines.title })
      .from(timelines)
      .where(and(inArray(timelines.id, timelineIds), eq(timelines.recordType, "project"), eq(timelines.tenantId, tenantId)));
    projectMap = Object.fromEntries(projectRows.map(p => [p.id, p.title]));
  }

  const now = new Date();

  return allMilestones
    .filter(m => projectMap[m.timelineId])
    .map(m => {
      const milestoneDate = new Date(m.date);
      let status: string;
      if (m.actualDate) {
        status = "completed";
      } else if (milestoneDate < now) {
        status = "overdue";
      } else {
        status = "upcoming";
      }

      return {
        id: m.id,
        timelineId: m.timelineId,
        projectName: projectMap[m.timelineId] || "Unknown",
        title: m.title,
        date: m.date,
        actualDate: m.actualDate,
        status,
        isFinancialObligation: m.isFinancialObligation,
        amount: m.amount,
      };
    });
}

export async function getRaidSummaryReport(tenantId: string, filters: {
  itemType?: string;
  status?: string;
  projectId?: string;
}) {
  const conditions: any[] = [eq(risks.tenantId, tenantId)];

  if (filters.projectId) {
    conditions.push(eq(risks.timelineId, filters.projectId));
  }
  if (filters.itemType) {
    conditions.push(eq(risks.itemType, filters.itemType));
  }
  if (filters.status) {
    conditions.push(eq(risks.status, filters.status as any));
  }

  const raidItems = await db
    .select({
      id: risks.id,
      timelineId: risks.timelineId,
      title: risks.title,
      description: risks.description,
      itemType: risks.itemType,
      status: risks.status,
      probability: risks.probability,
      impact: risks.impact,
      owner: risks.owner,
      dueDate: risks.dueDate,
      raisedDate: risks.raisedDate,
    })
    .from(risks)
    .where(and(...conditions));

  const timelineIds = Array.from(new Set(raidItems.map(r => r.timelineId)));
  let projectMap: Record<string, string> = {};
  if (timelineIds.length > 0) {
    const projectRows = await db
      .select({ id: timelines.id, title: timelines.title })
      .from(timelines)
      .where(and(inArray(timelines.id, timelineIds), eq(timelines.tenantId, tenantId)));
    projectMap = Object.fromEntries(projectRows.map(p => [p.id, p.title]));
  }

  return raidItems.map(r => ({
    ...r,
    projectName: projectMap[r.timelineId] || "Unknown",
  }));
}

export async function getBusinessOutcomesReport(
  tenantId: string,
  ctx: RecordAccessContext,
  filters: {
    status?: string;
    projectId?: string;
    opportunityId?: string;
    clientId?: string;
  },
) {
  const allTimelines = await db
    .select({
      id: timelines.id,
      title: timelines.title,
      recordType: timelines.recordType,
    })
    .from(timelines)
    .where(eq(timelines.tenantId, tenantId));

  const titleMap: Record<string, { title: string; recordType: string | null }> = {};
  const projectIdSet = new Set<string>();
  const opportunityIdSet = new Set<string>();
  allTimelines.forEach(t => {
    titleMap[t.id] = { title: t.title, recordType: t.recordType };
    if (t.recordType === "project") projectIdSet.add(t.id);
    else if (t.recordType === "opportunity") opportunityIdSet.add(t.id);
  });

  const assignedSet = new Set(ctx.assignedTimelineIds);
  const accessibleProjectIdSet = ctx.isGlobal
    ? projectIdSet
    : new Set(Array.from(projectIdSet).filter(id => assignedSet.has(id)));
  const accessibleOppIdSet = ctx.isGlobal
    ? opportunityIdSet
    : new Set(Array.from(opportunityIdSet).filter(id => assignedSet.has(id)));

  const conditions: any[] = [eq(businessOutcomes.tenantId, tenantId)];
  if (filters.status) {
    conditions.push(eq(businessOutcomes.status, filters.status as any));
  }
  if (filters.projectId) {
    conditions.push(eq(businessOutcomes.projectId, filters.projectId));
  }
  if (filters.opportunityId) {
    conditions.push(eq(businessOutcomes.opportunityId, filters.opportunityId));
  }
  if (filters.clientId) {
    conditions.push(eq(businessOutcomes.clientId, filters.clientId));
  }

  const allOutcomes = await db
    .select()
    .from(businessOutcomes)
    .where(and(...conditions));

  const accessibleOutcomes = ctx.isGlobal
    ? allOutcomes
    : allOutcomes.filter(o => {
        const projOk = !o.projectId || accessibleProjectIdSet.has(o.projectId);
        const oppOk = !o.opportunityId || accessibleOppIdSet.has(o.opportunityId);
        return projOk && oppOk;
      });

  const clientIds = Array.from(
    new Set(accessibleOutcomes.map(o => o.clientId).filter(Boolean)),
  ) as string[];
  let clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const clientRows = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(inArray(clients.id, clientIds), eq(clients.tenantId, tenantId)));
    clientMap = Object.fromEntries(clientRows.map(c => [c.id, c.name]));
  }

  const ownerIds = Array.from(
    new Set(accessibleOutcomes.map(o => o.ownerId).filter(Boolean)),
  ) as string[];
  let ownerMap: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const ownerRows = await db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(and(inArray(teamMembers.id, ownerIds), eq(teamMembers.tenantId, tenantId)));
    ownerMap = Object.fromEntries(ownerRows.map(m => [m.id, m.name]));
  }

  const items = accessibleOutcomes.map(o => {
    let linkedType: string | null = null;
    let linkedName: string | null = null;
    if (o.projectId && titleMap[o.projectId]) {
      linkedType = "project";
      linkedName = titleMap[o.projectId].title;
    } else if (o.opportunityId && titleMap[o.opportunityId]) {
      linkedType = "opportunity";
      linkedName = titleMap[o.opportunityId].title;
    } else if (o.clientId && clientMap[o.clientId]) {
      linkedType = "client";
      linkedName = clientMap[o.clientId];
    }

    return {
      id: o.id,
      title: o.title,
      status: o.status,
      strategicObjective: o.strategicObjective,
      successMetric: o.successMetric,
      baseline: o.baseline,
      target: o.target,
      currentValue: o.currentValue,
      targetDate: o.targetDate,
      clientName: o.clientId ? clientMap[o.clientId] || null : null,
      ownerName: o.ownerId ? ownerMap[o.ownerId] || null : null,
      linkedType,
      linkedName,
    };
  });

  const statusCounts = { draft: 0, active: 0, achieved: 0, at_risk: 0, cancelled: 0 };
  items.forEach(o => {
    const s = o.status || "draft";
    if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++;
  });
  const total = items.length;

  return {
    items,
    summary: {
      total,
      byStatus: statusCounts,
      achievementRate: total > 0 ? Math.round((statusCounts.achieved / total) * 100) : 0,
      atRiskCount: statusCounts.at_risk,
    },
  };
}
