import { storage } from "../storage";

interface ConversionResult {
  project: any;
  summary: {
    tasksCreated: number;
    resourcesCopied: number;
    teamMembersCopied: number;
    allocationsCopied: number;
    raidItemsCopied: number;
    milestonesCopied: number;
    governanceStage: string;
  };
}

export async function convertOpportunityToProject(
  opportunityId: string,
  tenantId: string
): Promise<ConversionResult> {
  const opp = await storage.getTimeline(opportunityId, tenantId);
  if (!opp) throw Object.assign(new Error("Opportunity not found"), { statusCode: 404 });
  if (opp.recordType !== "opportunity") throw Object.assign(new Error("Not an opportunity"), { statusCode: 400 });
  if (opp.opportunityStatus !== "won") throw Object.assign(new Error("Opportunity must have status 'won' before converting to a project"), { statusCode: 400 });

  if (opp.convertedAt) {
    throw Object.assign(new Error("This opportunity has already been converted to a project"), { statusCode: 400 });
  }
  const existingProject = await storage.getTimelinesBySource(opp.id, tenantId);
  if (existingProject) {
    throw Object.assign(new Error("A project already exists for this opportunity"), { statusCode: 400 });
  }

  if (!opp.operatingModelId) {
    throw Object.assign(new Error("An operating model must be selected and confirmed before converting this opportunity to a project"), { statusCode: 400 });
  }
  if (!opp.operatingModelConfirmedAt) {
    throw Object.assign(new Error("The operating model must be confirmed before converting this opportunity to a project"), { statusCode: 400 });
  }

  const allStages = await storage.getFlightpathStages(tenantId, opp.operatingModelId);
  const sortedStages = allStages.sort((a, b) => a.stageNumber - b.stageNumber);
  const stage0 = sortedStages.find(s => s.stageNumber === 0);
  const stage1 = sortedStages.find(s => s.stageNumber === 1);

  if (stage0 && opp.flightpathStageId === stage0.id) {
    const gates = await storage.getProjectGates(opportunityId, tenantId);
    const stage0Gate = gates.find(g => g.stageId === stage0.id);
    if (!stage0Gate || (stage0Gate.status !== "passed" && stage0Gate.status !== "exception")) {
      throw Object.assign(new Error("Stage 0 gate must be passed or have an approved exception before converting to a project"), { statusCode: 400 });
    }
  }

  const project = await storage.createTimeline({
    tenantId,
    title: opp.title,
    description: opp.description,
    color: opp.color,
    clientId: opp.clientId,
    region: opp.region,
    dateFormat: opp.dateFormat,
    engagementModel: opp.engagementModel,
    projectType: opp.projectType,
    approvedBudget: opp.approvedBudget,
    estimatedRevenue: opp.estimatedRevenue,
    grossMargin: opp.grossMargin,
    riskFactorPercent: opp.riskFactorPercent,
    bufferPercent: opp.bufferPercent,
    startDate: opp.startDate,
    endDate: opp.endDate,
    currency: opp.currency,
    docRepositoryType: opp.docRepositoryType,
    docRepositoryUrl: opp.docRepositoryUrl,
    docRepositoryFolderId: opp.docRepositoryFolderId,
    recordType: "project",
    projectStatus: "not_started",
    sourceOpportunityId: opp.id,
    flightpathStageId: stage1?.id || null,
    operatingModelId: opp.operatingModelId,
    operatingModelConfirmedAt: opp.operatingModelConfirmedAt || (opp.operatingModelId ? new Date() : null),
  });

  await storage.createHealthHistory({
    tenantId,
    timelineId: project.id,
    healthOverall: project.healthOverall,
    scopeHealth: project.scopeHealth,
    budgetHealth: project.budgetHealth,
    teamHealth: project.teamHealth,
  });

  const oppTasks = opp.tasks || [];
  const taskIdMap = new Map<string, string>();

  const phases = oppTasks.filter(t => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
  for (const phase of phases) {
    const newPhase = await storage.createTask({
      tenantId,
      timelineId: project.id,
      title: phase.title,
      description: phase.description,
      startDate: phase.startDate,
      endDate: phase.endDate,
      color: phase.color,
      sortOrder: phase.sortOrder,
      status: "not_started",
      health: "green",
      itemType: "phase",
      estimatedHours: phase.estimatedHours,
      confidenceLevel: phase.confidenceLevel,
      taskType: phase.taskType,
      assignedRoleId: phase.assignedRoleId,
      durationWeeks: phase.durationWeeks,
    });
    taskIdMap.set(phase.id, newPhase.id);
  }

  const workstreams = oppTasks.filter(t => t.itemType === "workstream").sort((a, b) => a.sortOrder - b.sortOrder);
  for (const ws of workstreams) {
    const newParentId = ws.parentTaskId ? taskIdMap.get(ws.parentTaskId) || null : null;
    const newWs = await storage.createTask({
      tenantId,
      timelineId: project.id,
      title: ws.title,
      description: ws.description,
      startDate: ws.startDate,
      endDate: ws.endDate,
      color: ws.color,
      sortOrder: ws.sortOrder,
      status: "not_started",
      health: "green",
      itemType: "workstream",
      parentTaskId: newParentId,
      estimatedHours: ws.estimatedHours,
      confidenceLevel: ws.confidenceLevel,
      taskType: ws.taskType,
      assignedRoleId: ws.assignedRoleId,
      durationWeeks: ws.durationWeeks,
    });
    taskIdMap.set(ws.id, newWs.id);
  }

  let resourcesCopied = 0;
  const taskIdEntries = Array.from(taskIdMap.entries());
  for (const [oldTaskId, newTaskId] of taskIdEntries) {
    const resources = await storage.getWorkstreamResources(oldTaskId, tenantId);
    for (const resource of resources) {
      await storage.createWorkstreamResource({
        tenantId,
        taskId: newTaskId,
        rateCardId: resource.rateCardId,
        teamMemberId: resource.teamMemberId,
        hoursPerWeek: resource.hoursPerWeek,
        taskType: resource.taskType,
        notes: resource.notes,
      });
      resourcesCopied++;
    }
  }

  const oppTeamMembers = await storage.getProjectTeamMembers(opp.id, tenantId);
  for (const ptm of oppTeamMembers) {
    await storage.createProjectTeamMember({
      tenantId,
      timelineId: project.id,
      teamMemberId: ptm.teamMemberId,
      rateCardId: ptm.rateCardId,
      monthlyCost: ptm.monthlyCost,
      hourlyCost: ptm.hourlyCost,
      allocation: ptm.allocation,
      startDate: ptm.startDate,
      endDate: ptm.endDate,
    });
  }

  const oppAllocations = await storage.getAllocationsByTimeline(opp.id, tenantId);
  for (const alloc of oppAllocations) {
    await storage.createAllocation({
      tenantId,
      teamMemberId: alloc.teamMemberId,
      timelineId: project.id,
      weeklyHours: alloc.weeklyHours,
      startDate: alloc.startDate,
      endDate: alloc.endDate,
      status: alloc.status,
      notes: alloc.notes,
    });
  }

  const oppRisks = await storage.getRisks(opp.id, tenantId);
  for (const risk of oppRisks) {
    await storage.createRisk({
      tenantId,
      timelineId: project.id,
      title: risk.title,
      description: risk.description,
      category: risk.category,
      owner: risk.owner,
      probability: risk.probability,
      impact: risk.impact,
      mitigation: risk.mitigation,
      contingency: risk.contingency,
      status: risk.status,
      dueDate: risk.dueDate,
      itemType: risk.itemType,
      raisedDate: risk.raisedDate,
      dependencySource: risk.dependencySource,
      requiredByDate: risk.requiredByDate,
      validationCriteria: risk.validationCriteria,
    });
  }

  let milestonesCopied = 0;
  const oppMilestones = opp.milestones || [];
  for (const m of oppMilestones) {
    await storage.createMilestone({
      tenantId,
      timelineId: project.id,
      title: m.title,
      description: m.description,
      date: m.date,
      actualDate: m.actualDate,
      color: m.color,
      icon: m.icon,
      sortOrder: m.sortOrder,
      isFinancialObligation: m.isFinancialObligation,
      amount: m.amount,
    });
    milestonesCopied++;
  }

  if (stage1) {
    const deliverables = await storage.getStageDeliverables(stage1.id, tenantId);
    for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
      await storage.createProjectCheckpoint({
        tenantId,
        timelineId: project.id,
        stageId: stage1.id,
        deliverableId: d.id,
        checkpointName: d.name,
        completed: false,
      });
    }
  }

  await storage.updateTimeline(opp.id, tenantId, {
    opportunityStatus: "won",
    convertedAt: new Date(),
  });

  const fullProject = await storage.getTimeline(project.id, tenantId);
  return {
    project: fullProject,
    summary: {
      tasksCreated: taskIdMap.size,
      resourcesCopied,
      teamMembersCopied: oppTeamMembers.length,
      allocationsCopied: oppAllocations.length,
      raidItemsCopied: oppRisks.length,
      milestonesCopied,
      governanceStage: stage1 ? `Stage 1: ${stage1.name}` : "None",
    },
  };
}
