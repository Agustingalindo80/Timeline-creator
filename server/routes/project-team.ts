import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext, checkTimelineAccess } from "./helpers";
import { recalcTotalRunningCost } from "../services/financials";

export function registerProjectTeamRoutes(app: Express) {
  app.get("/api/timelines/:id/team", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const members = await storage.getProjectTeamMembers(req.params.id, req.tenantId || "default");
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/team", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      const parentTimeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (parentTimeline && parentTimeline.recordType === "project" && !teamMemberId) {
        return res.status(400).json({ message: "Team member is required for projects" });
      }
      if (!teamMemberId && !rateCardId) {
        return res.status(400).json({ message: "Either a team member or a role (rate card) is required" });
      }
      const assignment = await storage.createProjectTeamMember({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        teamMemberId: teamMemberId || null,
        rateCardId: rateCardId || null,
        monthlyCost: monthlyCost || null,
        hourlyCost: hourlyCost || null,
        allocation: allocation ?? 100,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      res.status(201).json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/team/sync-from-estimate", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const timelineId = req.params.id;
      const timeline = await storage.getTimeline(timelineId, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });
      if (timeline.recordType !== "opportunity") {
        return res.status(400).json({ message: "Sync from estimate is only available for opportunities" });
      }

      const allResources = await storage.getWorkstreamResourcesByTimeline(timelineId, req.tenantId || "default");
      const allTasks = await storage.getTasksByTimeline(timelineId, req.tenantId || "default");
      const existingTeam = await storage.getProjectTeamMembers(timelineId, req.tenantId || "default");
      const allRateCards = await storage.getRateCards(req.tenantId);
      const rateCardMap = new Map(allRateCards.map(rc => [rc.id, rc]));
      const taskMap = new Map(allTasks.map(t => [t.id, t]));

      const existingCountByCard: Record<string, number> = {};
      for (const t of existingTeam) {
        if (t.rateCardId) {
          existingCountByCard[t.rateCardId] = (existingCountByCard[t.rateCardId] || 0) + 1;
        }
      }

      const resourcesByCard: Record<string, Array<{ hoursPerWeek: string; taskId: string }>> = {};
      for (const r of allResources) {
        if (!resourcesByCard[r.rateCardId]) resourcesByCard[r.rateCardId] = [];
        resourcesByCard[r.rateCardId].push({ hoursPerWeek: r.hoursPerWeek, taskId: r.taskId });
      }

      const created: any[] = [];
      const FTE_HOURS = 40;

      for (const [rateCardId, resources] of Object.entries(resourcesByCard)) {
        const rc = rateCardMap.get(rateCardId);
        if (!rc) continue;

        const intervals: Array<{ start: number; end: number; hpw: number }> = [];
        for (const r of resources) {
          const ws = taskMap.get(r.taskId);
          if (!ws) continue;
          const startStr = ws.startDate;
          const endStr = ws.endDate;
          const start = startStr ? new Date(startStr).getTime() : 0;
          const durationWeeks = parseFloat(ws.durationWeeks || "0") || 0;
          const end = endStr ? new Date(endStr).getTime() : (start + durationWeeks * 7 * 24 * 60 * 60 * 1000);
          intervals.push({ start, end, hpw: parseFloat(r.hoursPerWeek || "0") || 0 });
        }

        let requiredFTEs = 1;
        if (intervals.length > 0) {
          const events: Array<{ time: number; hpw: number }> = [];
          for (const iv of intervals) {
            events.push({ time: iv.start, hpw: iv.hpw });
            events.push({ time: iv.end, hpw: -iv.hpw });
          }
          events.sort((a, b) => a.time - b.time || a.hpw - b.hpw);

          let currentHpw = 0;
          let peakHpw = 0;
          for (const ev of events) {
            currentHpw += ev.hpw;
            peakHpw = Math.max(peakHpw, currentHpw);
          }
          requiredFTEs = Math.max(1, Math.ceil(peakHpw / FTE_HOURS));
        }

        const existingCount = existingCountByCard[rateCardId] || 0;
        const toCreate = Math.max(0, requiredFTEs - existingCount);

        for (let i = 0; i < toCreate; i++) {
          const entry = await storage.createProjectTeamMember({
            tenantId: req.tenantId || "default",
            timelineId,
            teamMemberId: null,
            rateCardId,
            monthlyCost: rc.costRate || null,
            hourlyCost: rc.billRate || null,
            allocation: 100,
            startDate: null,
            endDate: null,
          });
          created.push(entry);
        }
      }

      res.json({ created: created.length, entries: created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/project-team/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      const updates: any = {};
      if (teamMemberId !== undefined) updates.teamMemberId = teamMemberId || null;
      if (rateCardId !== undefined) updates.rateCardId = rateCardId || null;
      if (monthlyCost !== undefined) updates.monthlyCost = monthlyCost;
      if (hourlyCost !== undefined) updates.hourlyCost = hourlyCost;
      if (allocation !== undefined) updates.allocation = allocation;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;

      const existing = await storage.getProjectTeamMemberById(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Assignment not found" });
      const finalTeamMemberId = updates.teamMemberId !== undefined ? updates.teamMemberId : existing.teamMemberId;
      const finalRateCardId = updates.rateCardId !== undefined ? updates.rateCardId : existing.rateCardId;
      const parentTimeline = await storage.getTimeline(existing.timelineId, req.tenantId || "default");
      if (parentTimeline && parentTimeline.recordType === "project" && !finalTeamMemberId) {
        return res.status(400).json({ message: "Team member is required for projects" });
      }
      if (!finalTeamMemberId && !finalRateCardId) {
        return res.status(400).json({ message: "Either a team member or a role (rate card) is required" });
      }

      const assignment = await storage.updateProjectTeamMember(req.params.id, req.tenantId || "default", updates);
      if (!assignment) return res.status(404).json({ message: "Assignment not found" });
      res.json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/project-team/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.deleteProjectTeamMember(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id/allocations", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const allocs = await storage.getAllocationsByTimeline(req.params.id, req.tenantId || "default");
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/allocations", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const allocs = await storage.getAllAllAllocations(req.tenantId);
      if (ctx.isGlobal) {
        return res.json(allocs);
      }
      const filtered = allocs.filter(a =>
        (ctx.teamMemberId && a.teamMemberId === ctx.teamMemberId) ||
        ctx.assignedTimelineIds.includes(a.timelineId)
      );
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/team-members/:id/allocations", async (req, res) => {
    try {
      const allocs = await storage.getAllocations(req.params.id, req.tenantId || "default");
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/team-members/:id/allocations", requireModuleAccess("allocations"), requirePermission("project.edit"), async (req, res) => {
    try {
      const data = {
        tenantId: req.tenantId || "default",
        teamMemberId: req.params.id,
        timelineId: req.body.timelineId,
        weeklyHours: req.body.weeklyHours || null,
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        status: req.body.status || "active",
        notes: req.body.notes || null,
      };
      if (!data.timelineId) {
        return res.status(400).json({ message: "timelineId is required" });
      }
      const allocation = await storage.createAllocation(data);
      await recalcTotalRunningCost(data.timelineId, req.tenantId || "default");
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/allocations/:id", requireModuleAccess("allocations"), requirePermission("project.edit"), async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Allocation not found" });

      const updates: any = {};
      if (req.body.timelineId !== undefined) updates.timelineId = req.body.timelineId;
      if (req.body.weeklyHours !== undefined) updates.weeklyHours = req.body.weeklyHours;
      if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
      if (req.body.endDate !== undefined) updates.endDate = req.body.endDate;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      const allocation = await storage.updateAllocation(req.params.id, req.tenantId || "default", updates);
      if (!allocation) return res.status(404).json({ message: "Allocation not found" });

      await recalcTotalRunningCost(allocation.timelineId, req.tenantId || "default");
      if (existing.timelineId !== allocation.timelineId) {
        await recalcTotalRunningCost(existing.timelineId, req.tenantId || "default");
      }
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/allocations/:id", requireModuleAccess("allocations"), requirePermission("project.edit"), async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id, req.tenantId || "default");
      await storage.deleteAllocation(req.params.id, req.tenantId || "default");
      if (existing) {
        await recalcTotalRunningCost(existing.timelineId, req.tenantId || "default");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
