import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";

export function registerRiskRoutes(app: Express) {
  app.get("/api/timelines/:id/risks", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const risks = await storage.getRisks(req.params.id, req.tenantId || "default");
      res.json(risks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/risks", requirePermission("raid.edit"), async (req, res) => {
    try {
      const { title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const risk = await storage.createRisk({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        title,
        description: description || null,
        category: category || null,
        owner: owner || null,
        probability: probability || "medium",
        impact: impact || "medium",
        mitigation: mitigation || null,
        contingency: contingency || null,
        status: status || "open",
        dueDate: dueDate || null,
        sortOrder: sortOrder ?? 0,
      });
      res.status(201).json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      const { title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (owner !== undefined) updates.owner = owner;
      if (probability !== undefined) updates.probability = probability;
      if (impact !== undefined) updates.impact = impact;
      if (mitigation !== undefined) updates.mitigation = mitigation;
      if (contingency !== undefined) updates.contingency = contingency;
      if (status !== undefined) updates.status = status;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const risk = await storage.updateRisk(req.params.id, req.tenantId || "default", updates);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      res.json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      await storage.deleteRisk(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
