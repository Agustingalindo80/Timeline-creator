import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";

export function registerWorkstreamResourceRoutes(app: Express) {
  app.get("/api/tasks/:taskId/resources", async (req, res) => {
    try {
      const resources = await storage.getWorkstreamResources(req.params.taskId, req.tenantId || "default");
      res.json(resources);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/tasks/:taskId/resources", requirePermission("estimate.edit"), async (req, res) => {
    try {
      const { rateCardId, teamMemberId, hoursPerWeek, taskType, notes } = req.body;
      if (!rateCardId) return res.status(400).json({ message: "Rate card is required" });
      if (!hoursPerWeek && hoursPerWeek !== 0) return res.status(400).json({ message: "Hours per week is required" });
      const resource = await storage.createWorkstreamResource({
        tenantId: req.tenantId || "default",
        taskId: req.params.taskId,
        rateCardId,
        teamMemberId: teamMemberId || null,
        hoursPerWeek: String(hoursPerWeek),
        taskType: taskType || null,
        notes: notes || null,
      });
      res.status(201).json(resource);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/workstream-resources/:id", requirePermission("estimate.edit"), async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.rateCardId !== undefined) updates.rateCardId = req.body.rateCardId;
      if (req.body.teamMemberId !== undefined) updates.teamMemberId = req.body.teamMemberId;
      if (req.body.hoursPerWeek !== undefined) updates.hoursPerWeek = String(req.body.hoursPerWeek);
      if (req.body.taskType !== undefined) updates.taskType = req.body.taskType;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      const resource = await storage.updateWorkstreamResource(req.params.id, req.tenantId || "default", updates);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/workstream-resources/:id", requirePermission("estimate.edit"), async (req, res) => {
    try {
      await storage.deleteWorkstreamResource(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:timelineId/workstream-resources", async (req, res) => {
    try {
      const resources = await storage.getWorkstreamResourcesByTimeline(req.params.timelineId, req.tenantId || "default");
      res.json(resources);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
