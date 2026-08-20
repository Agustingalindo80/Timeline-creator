import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";

export function registerRiskRoutes(app: Express) {
  app.get("/api/timelines/:id/risks", async (req, res) => {
    try {
      const timelineId = String(req.params.id);
      if (!(await checkTimelineAccess(req, res, timelineId))) return;
      const risks = await storage.getRisks(timelineId, req.tenantId || "default");
      res.json(risks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/risks", requirePermission("raid.edit"), async (req, res) => {
    try {
      const timelineId = String(req.params.id);
      const {
        title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder,
        itemType, raisedDate, validationCriteria, dependencySource, requiredByDate,
      } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const risk = await storage.createRisk({
        tenantId: req.tenantId || "default",
        timelineId,
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
        itemType: itemType || "risk",
        raisedDate: raisedDate || null,
        validationCriteria: validationCriteria || null,
        dependencySource: dependencySource || null,
        requiredByDate: requiredByDate || null,
      });
      res.status(201).json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      const riskId = String(req.params.id);
      const {
        title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder,
        itemType, raisedDate, validationCriteria, dependencySource, requiredByDate,
      } = req.body;
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
      if (itemType !== undefined) updates.itemType = itemType;
      if (raisedDate !== undefined) updates.raisedDate = raisedDate;
      if (validationCriteria !== undefined) updates.validationCriteria = validationCriteria;
      if (dependencySource !== undefined) updates.dependencySource = dependencySource;
      if (requiredByDate !== undefined) updates.requiredByDate = requiredByDate;

      const risk = await storage.updateRisk(riskId, req.tenantId || "default", updates);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      res.json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      await storage.deleteRisk(String(req.params.id), req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
