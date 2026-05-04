import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";
import { extractFolderIdFromUrl } from "../google-drive";
import { getRecordAccessContext } from "./helpers";

export function registerOpportunityRoutes(app: Express) {
  app.get("/api/opportunities", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const opportunities = await storage.getTimelines("opportunity", req.tenantId);
        return res.json(opportunities);
      }
      const opportunities = await storage.getTimelinesByIds(ctx.assignedTimelineIds, "opportunity");
      res.json(opportunities);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/opportunities", requirePermission("opp.create"), async (req, res) => {
    try {
      const { title, description, color, clientId, region, salesforceClouds, currency, engagementModel, projectType } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ message: "Title is required" });

      const opp = await storage.createTimeline({
        tenantId: req.tenantId || "default",
        title: title.trim(),
        description: description || null,
        color: color || "#8b5cf6",
        clientId: clientId || null,
        region: region || null,
        salesforceClouds: salesforceClouds || null,
        currency: currency || "USD",
        engagementModel: engagementModel || null,
        projectType: projectType || null,
        recordType: "opportunity",
        opportunityStatus: "qualifying",
        projectStatus: "not_started",
      });

      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      const stage0 = allStages.sort((a, b) => a.stageNumber - b.stageNumber).find(s => s.stageNumber === 0);
      if (stage0) {
        await storage.updateTimeline(opp.id, req.tenantId || "default", { flightpathStageId: stage0.id });
        const deliverables = await storage.getStageDeliverables(stage0.id, req.tenantId || "default");
        for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
          await storage.createProjectCheckpoint({
            tenantId: req.tenantId || "default",
            timelineId: opp.id,
            stageId: stage0.id,
            deliverableId: d.id,
            checkpointName: d.name,
            completed: false,
          });
        }
      }

      const full = await storage.getTimeline(opp.id, req.tenantId || "default");
      res.status(201).json(full);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/opportunities/:id", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal && !ctx.assignedTimelineIds.includes(req.params.id)) {
        return res.status(403).json({ message: "You don't have access to this opportunity" });
      }
      const opp = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      if (opp.recordType !== "opportunity") return res.status(404).json({ message: "Not an opportunity" });
      res.json(opp);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/opportunities/:id", requirePermission("opp.edit"), async (req, res) => {
    try {
      const existing = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Opportunity not found" });
      if (existing.recordType !== "opportunity") return res.status(404).json({ message: "Not an opportunity" });

      const updates: any = {};
      const oppFields = [
        "title", "description", "color", "clientId", "region", "salesforceClouds",
        "currency", "engagementModel", "projectType", "approvedBudget", "estimatedRevenue",
        "totalRunningCost", "grossMargin",
        "riskFactorPercent", "bufferPercent", "opportunityStatus", "startDate", "endDate",
        "docRepositoryType", "docRepositoryUrl", "dateFormat",
        "healthOverall", "scopeHealth", "budgetHealth", "teamHealth",
      ];
      for (const field of oppFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (req.body.docRepositoryUrl !== undefined) {
        const url = req.body.docRepositoryUrl;
        if (url && req.body.docRepositoryType === "google_drive") {
          updates.docRepositoryFolderId = extractFolderIdFromUrl(url);
        } else if (!url) {
          updates.docRepositoryFolderId = null;
        }
      }

      if (updates.grossMargin === undefined && updates.estimatedRevenue !== undefined && updates.approvedBudget !== undefined) {
        const revenue = parseFloat(updates.estimatedRevenue) || 0;
        const cost = parseFloat(updates.approvedBudget) || 0;
        if (revenue > 0) {
          updates.grossMargin = (((revenue - cost) / revenue) * 100).toFixed(2);
        }
      }

      const updated = await storage.updateTimeline(req.params.id, req.tenantId || "default", updates);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/opportunities/:id", requirePermission("opp.edit"), async (req, res) => {
    try {
      const existing = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Opportunity not found" });
      if (existing.recordType !== "opportunity") return res.status(404).json({ message: "Not an opportunity" });
      await storage.deleteTimeline(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/opportunities/:id/convert", requirePermission("opp.edit"), requirePermission("project.create"), async (req, res) => {
    try {
      const opp = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      if (opp.recordType !== "opportunity") return res.status(400).json({ message: "Not an opportunity" });
      if (opp.opportunityStatus !== "won") return res.status(400).json({ message: "Opportunity must have status 'won' before converting to a project" });

      if (opp.convertedAt) {
        return res.status(400).json({ message: "This opportunity has already been converted to a project" });
      }
      const existingProject = await storage.getTimelinesBySource(opp.id, req.tenantId || "default");
      if (existingProject) {
        return res.status(400).json({ message: "A project already exists for this opportunity" });
      }

      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = allStages.sort((a, b) => a.stageNumber - b.stageNumber);
      const stage0 = sortedStages.find(s => s.stageNumber === 0);
      const stage1 = sortedStages.find(s => s.stageNumber === 1);

      if (stage0 && opp.flightpathStageId === stage0.id) {
        const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
        const stage0Gate = gates.find(g => g.stageId === stage0.id);
        if (!stage0Gate || (stage0Gate.status !== "passed" && stage0Gate.status !== "exception")) {
          return res.status(400).json({ message: "Stage 0 gate must be passed or have an approved exception before converting to a project" });
        }
      }

      const project = await storage.createTimeline({
        tenantId: req.tenantId || "default",
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
      });

      const oppTasks = opp.tasks || [];
      const taskIdMap = new Map<string, string>();

      const phases = oppTasks.filter(t => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
      for (const phase of phases) {
        const newPhase = await storage.createTask({
          tenantId: req.tenantId || "default",
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
          tenantId: req.tenantId || "default",
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
        const resources = await storage.getWorkstreamResources(oldTaskId, req.tenantId || "default");
        for (const resource of resources) {
          await storage.createWorkstreamResource({
            tenantId: req.tenantId || "default",
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

      const oppTeamMembers = await storage.getProjectTeamMembers(opp.id, req.tenantId || "default");
      for (const ptm of oppTeamMembers) {
        await storage.createProjectTeamMember({
          tenantId: req.tenantId || "default",
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

      const oppAllocations = await storage.getAllocationsByTimeline(opp.id, req.tenantId || "default");
      for (const alloc of oppAllocations) {
        await storage.createAllocation({
          tenantId: req.tenantId || "default",
          teamMemberId: alloc.teamMemberId,
          timelineId: project.id,
          weeklyHours: alloc.weeklyHours,
          startDate: alloc.startDate,
          endDate: alloc.endDate,
          status: alloc.status,
          notes: alloc.notes,
        });
      }

      const oppRisks = await storage.getRisks(opp.id, req.tenantId || "default");
      for (const risk of oppRisks) {
        await storage.createRisk({
          tenantId: req.tenantId || "default",
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
          tenantId: req.tenantId || "default",
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
        const deliverables = await storage.getStageDeliverables(stage1.id, req.tenantId || "default");
        for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
          await storage.createProjectCheckpoint({
            tenantId: req.tenantId || "default",
            timelineId: project.id,
            stageId: stage1.id,
            deliverableId: d.id,
            checkpointName: d.name,
            completed: false,
          });
        }
      }

      await storage.updateTimeline(opp.id, req.tenantId || "default", {
        opportunityStatus: "won",
        convertedAt: new Date(),
      });

      const fullProject = await storage.getTimeline(project.id, req.tenantId || "default");
      res.status(201).json({
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
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
