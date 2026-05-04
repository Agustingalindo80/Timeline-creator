import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext, checkTimelineAccess } from "./helpers";

export function registerTimesheetRoutes(app: Express) {
  app.get("/api/timesheets", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });

      const { timelineId, teamMemberId, weekEnding } = req.query;

      if (!ctx.isGlobal) {
        const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
          timelineId: timelineId as string | undefined,
          teamMemberId: ctx.teamMemberId || undefined,
          weekEnding: weekEnding as string | undefined,
        });
        return res.json(entries);
      }

      const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
        timelineId: timelineId as string | undefined,
        teamMemberId: teamMemberId as string | undefined,
        weekEnding: weekEnding as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id/timesheets", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { weekEnding, teamMemberId } = req.query;
      const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
        timelineId: req.params.id,
        weekEnding: weekEnding as string | undefined,
        teamMemberId: teamMemberId as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timesheets", requireModuleAccess("timesheets"), requirePermission("timesheet.submit"), async (req, res) => {
    try {
      const { timelineId, teamMemberId, taskId, weekEnding, dayDate, hours, billableType, notes } = req.body;
      if (!timelineId || !teamMemberId || !weekEnding || hours === undefined) {
        return res.status(400).json({ message: "timelineId, teamMemberId, weekEnding, and hours are required" });
      }
      const allAllocations = await storage.getAllocations(teamMemberId, req.tenantId || "default");
      const hasActiveAllocation = allAllocations.some(a => a.timelineId === timelineId && a.status === "active");
      if (!hasActiveAllocation) {
        return res.status(403).json({ message: "Team member does not have an active allocation to this project" });
      }
      const entry = await storage.createTimesheetEntry({
        tenantId: req.tenantId || "default",
        timelineId,
        teamMemberId,
        taskId: taskId || null,
        weekEnding,
        dayDate: dayDate || null,
        hours: String(hours),
        billableType: billableType || "billable",
        notes: notes || null,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/timesheets/:entryId", requireModuleAccess("timesheets"), requirePermission("timesheet.submit"), async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.hours !== undefined) updates.hours = String(req.body.hours);
      if (req.body.taskId !== undefined) updates.taskId = req.body.taskId;
      if (req.body.weekEnding !== undefined) updates.weekEnding = req.body.weekEnding;
      if (req.body.dayDate !== undefined) updates.dayDate = req.body.dayDate;
      if (req.body.billableType !== undefined) updates.billableType = req.body.billableType;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.teamMemberId !== undefined) updates.teamMemberId = req.body.teamMemberId;
      if (req.body.timelineId !== undefined) updates.timelineId = req.body.timelineId;
      const entry = await storage.updateTimesheetEntry(req.params.entryId, req.tenantId || "default", updates);
      if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/timesheets/:entryId", requireModuleAccess("timesheets"), requirePermission("timesheet.submit"), async (req, res) => {
    try {
      await storage.deleteTimesheetEntry(req.params.entryId, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
