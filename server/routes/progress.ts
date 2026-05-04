import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";
import { recalcPhaseProgress } from "../services/project-progress";

export function registerProgressRoutes(app: Express) {
  app.get("/api/timelines/:id/progress", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { weekEnding, taskId } = req.query;
      const entries = await storage.getProgressEntries(req.tenantId || "default", {
        timelineId: req.params.id,
        weekEnding: weekEnding as string | undefined,
        taskId: taskId as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/progress", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { taskId, weekEnding, percentComplete, notes } = req.body;
      if (!taskId || !weekEnding || percentComplete === undefined) {
        return res.status(400).json({ message: "taskId, weekEnding, and percentComplete are required" });
      }
      const pct = Math.max(0, Math.min(100, parseInt(percentComplete) || 0));

      const task = await storage.getTask(taskId, req.tenantId || "default");
      if (!task || task.timelineId !== req.params.id) {
        return res.status(400).json({ message: "Task not found in this project" });
      }
      if (task.itemType !== "workstream") {
        return res.status(400).json({ message: "Progress can only be entered for workstreams" });
      }

      const entry = await storage.createProgressEntry({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        taskId,
        weekEnding,
        percentComplete: pct,
        notes: notes || null,
      });

      await storage.updateTask(taskId, req.tenantId || "default", { percentComplete: pct });
      if (task.parentTaskId) {
        await recalcPhaseProgress(task.parentTaskId, req.tenantId || "default");
      }

      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/progress/:entryId", requirePermission("project.edit"), async (req, res) => {
    try {
      const existing = await storage.getProgressEntry(req.params.entryId, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Progress entry not found" });

      const updates: any = {};
      if (req.body.percentComplete !== undefined) updates.percentComplete = Math.max(0, Math.min(100, parseInt(req.body.percentComplete) || 0));
      if (req.body.weekEnding !== undefined) updates.weekEnding = req.body.weekEnding;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const entry = await storage.updateProgressEntry(req.params.entryId, req.tenantId || "default", updates);
      if (!entry) return res.status(404).json({ message: "Progress entry not found" });

      if (updates.percentComplete !== undefined) {
        const task = await storage.getTask(existing.taskId, req.tenantId || "default");
        if (task) {
          await storage.updateTask(existing.taskId, req.tenantId || "default", { percentComplete: updates.percentComplete });
          if (task.parentTaskId) {
            await recalcPhaseProgress(task.parentTaskId, req.tenantId || "default");
          }
        }
      }

      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/progress/:entryId", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.deleteProgressEntry(req.params.entryId, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
