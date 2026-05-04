import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";
import { extractFolderIdFromUrl } from "../google-drive";
import { getRecordAccessContext } from "./helpers";
import { convertOpportunityToProject } from "../services/opportunity-conversion";

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
      const result = await convertOpportunityToProject(req.params.id, req.tenantId || "default");
      res.status(201).json(result);
    } catch (err: any) { res.status(err.statusCode || 500).json({ message: err.message }); }
  });
}
