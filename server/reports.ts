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
} from "@shared/schema";

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
