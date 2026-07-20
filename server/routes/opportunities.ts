import type { Express, Request } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";
import { hasPermission } from "../rbac";
import { db } from "../db";
import { users, timelines } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { extractFolderIdFromUrl } from "../google-drive";
import { getRecordAccessContext } from "./helpers";
import { convertOpportunityToProject } from "../services/opportunity-conversion";

const LOCKED_ESTIMATE_STATUSES = new Set(["proposed", "won", "lost"]);

function extractUserId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  return user?.claims?.sub || user?.id || null;
}

async function isWonApprover(userId: string, tenantId: string): Promise<boolean> {
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
  if (user?.isSuperAdmin === true) return true;
  return hasPermission(userId, tenantId, "org.settings.manage");
}

function computeEffectiveMargin(existing: any, updates: any): number {
  const revenue = parseFloat(updates.estimatedRevenue ?? existing.estimatedRevenue ?? "0") || 0;
  const cost = parseFloat(updates.totalRunningCost ?? existing.totalRunningCost ?? "0") || 0;
  if (revenue > 0) return ((revenue - cost) / revenue) * 100;
  const gm = parseFloat(updates.grossMargin ?? existing.grossMargin ?? "");
  return isNaN(gm) ? 0 : gm;
}

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

      const activeModels = (await storage.getOperatingModels(req.tenantId || "default")).filter(m => m.status === "active");
      const defaultModel = activeModels.length === 1 ? activeModels[0] : null;
      if (defaultModel) {
        await storage.updateTimeline(opp.id, req.tenantId || "default", { operatingModelId: defaultModel.id });
      }
      const allStages = defaultModel
        ? await storage.getFlightpathStages(req.tenantId || "default", defaultModel.id)
        : [];
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
        "totalRunningCost", "grossMargin", "initialEstimate", "confidencePercent",
        "riskFactorPercent", "bufferPercent", "opportunityStatus", "startDate", "endDate",
        "docRepositoryType", "docRepositoryUrl", "dateFormat",
        "healthOverall", "scopeHealth", "budgetHealth", "teamHealth",
      ];
      for (const field of oppFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      // Initial estimate is only editable while the opportunity is in qualifying/estimating
      if (updates.initialEstimate !== undefined) {
        const effectiveStatus = updates.opportunityStatus ?? existing.opportunityStatus ?? "qualifying";
        const currentValue = existing.initialEstimate ?? null;
        const newValue = updates.initialEstimate ?? null;
        const changed = String(currentValue ?? "") !== String(newValue ?? "");
        if (changed && LOCKED_ESTIMATE_STATUSES.has(effectiveStatus)) {
          return res.status(400).json({ message: "The initial estimate is locked once the opportunity is Proposed, Won, or Lost" });
        }
        if (newValue !== null && newValue !== "" && (isNaN(parseFloat(newValue)) || parseFloat(newValue) < 0)) {
          return res.status(400).json({ message: "Initial estimate must be a non-negative number" });
        }
        if (newValue === "") updates.initialEstimate = null;
      }

      // Confidence % (0-100). Won and Lost are forced server-side below.
      if (updates.confidencePercent !== undefined) {
        const raw = updates.confidencePercent;
        if (raw === null || raw === "") {
          updates.confidencePercent = null;
        } else {
          const num = parseFloat(raw);
          if (isNaN(num) || num < 0 || num > 100) {
            return res.status(400).json({ message: "Confidence must be a number between 0 and 100" });
          }
          updates.confidencePercent = num.toFixed(2);
        }
      }

      // Won opportunities are always 100% confidence; Lost are always 0%
      // (based on the effective final status, so it also holds for already won/lost records)
      const finalStatus = updates.opportunityStatus ?? existing.opportunityStatus;
      if (finalStatus === "won") {
        updates.confidencePercent = "100.00";
      } else if (finalStatus === "lost") {
        updates.confidencePercent = "0.00";
      }

      // Margin approval gate for the Won transition
      if (updates.opportunityStatus === "won" && existing.opportunityStatus !== "won") {
        const settings = await storage.getSettings(req.tenantId || "default");
        const threshold = parseFloat((settings as any)?.minMarginForWon ?? "") || 0;
        if (threshold > 0) {
          const margin = computeEffectiveMargin(existing, updates);
          if (margin < threshold) {
            const userId = extractUserId(req);
            const approver = userId ? await isWonApprover(userId, req.tenantId || "default") : false;
            if (approver) {
              // Org Admins / Super Admins get implicit approval
              updates.wonApprovalStatus = "approved";
              updates.wonApprovalRequestedBy = userId;
              updates.wonApprovalRequestedAt = new Date();
              updates.wonApprovalMarginAtRequest = margin.toFixed(2);
              updates.wonApprovalThresholdAtRequest = threshold.toFixed(2);
              updates.wonApprovalDecidedBy = userId;
              updates.wonApprovalDecidedAt = new Date();
              updates.wonApprovalReason = null;
            } else {
              // Below threshold: keep the current status and record a pending approval request
              delete updates.opportunityStatus;
              delete updates.confidencePercent;
              updates.wonApprovalStatus = "pending";
              updates.wonApprovalRequestedBy = userId;
              updates.wonApprovalRequestedAt = new Date();
              updates.wonApprovalMarginAtRequest = margin.toFixed(2);
              updates.wonApprovalThresholdAtRequest = threshold.toFixed(2);
              updates.wonApprovalDecidedBy = null;
              updates.wonApprovalDecidedAt = null;
              updates.wonApprovalReason = null;
              const pendingRecord = await storage.updateTimeline(req.params.id, req.tenantId || "default", updates);
              return res.json({ ...pendingRecord, wonApprovalRequired: true, wonApprovalThreshold: threshold });
            }
          }
        }
      }

      // Any other status change cancels an outstanding pending approval
      if (
        updates.opportunityStatus !== undefined &&
        updates.opportunityStatus !== "won" &&
        existing.wonApprovalStatus === "pending"
      ) {
        updates.wonApprovalStatus = null;
        updates.wonApprovalRequestedBy = null;
        updates.wonApprovalRequestedAt = null;
        updates.wonApprovalMarginAtRequest = null;
        updates.wonApprovalThresholdAtRequest = null;
        updates.wonApprovalDecidedBy = null;
        updates.wonApprovalDecidedAt = null;
        updates.wonApprovalReason = null;
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

  app.post("/api/opportunities/:id/won-approval/:decision", requirePermission("opp.edit"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const decision = req.params.decision;
      if (decision !== "approve" && decision !== "reject") {
        return res.status(400).json({ message: "Decision must be approve or reject" });
      }
      const opp = await storage.getTimeline(req.params.id, tenantId);
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      if (opp.recordType !== "opportunity") return res.status(404).json({ message: "Not an opportunity" });
      if (opp.wonApprovalStatus !== "pending") {
        return res.status(400).json({ message: "There is no pending Won approval request for this opportunity" });
      }

      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const approver = await isWonApprover(userId, tenantId);
      if (!approver) {
        return res.status(403).json({ message: "Only Org Admins and Super Admins can approve or reject Won requests" });
      }

      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() || null : null;
      const updates: any = {
        wonApprovalStatus: decision === "approve" ? "approved" : "rejected",
        wonApprovalDecidedBy: userId,
        wonApprovalDecidedAt: new Date(),
        wonApprovalReason: reason,
        updatedAt: new Date(),
      };
      if (decision === "approve") {
        updates.opportunityStatus = "won";
        updates.confidencePercent = "100.00";
      }
      const [updated] = await db
        .update(timelines)
        .set(updates)
        .where(and(
          eq(timelines.id, req.params.id),
          eq(timelines.tenantId, tenantId),
          eq(timelines.recordType, "opportunity"),
          eq(timelines.wonApprovalStatus, "pending"),
        ))
        .returning();
      if (!updated) {
        return res.status(409).json({ message: "This Won request has already been decided" });
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/opportunities/:id/operating-model", requirePermission("opp.edit"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const opp = await storage.getTimeline(req.params.id, tenantId);
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      if (opp.recordType !== "opportunity") return res.status(404).json({ message: "Not an opportunity" });
      if (opp.operatingModelConfirmedAt) {
        return res.status(400).json({ message: "The operating model has already been confirmed for this opportunity and cannot be changed" });
      }

      const { operatingModelId, confirm } = req.body;
      if (!operatingModelId) return res.status(400).json({ message: "operatingModelId is required" });
      const model = await storage.getOperatingModel(operatingModelId, tenantId);
      if (!model) return res.status(404).json({ message: "Operating model not found" });
      if (model.status !== "active") return res.status(400).json({ message: "Only active operating models can be selected" });

      const modelChanged = opp.operatingModelId !== operatingModelId;
      const updates: any = { operatingModelId };
      if (confirm) updates.operatingModelConfirmedAt = new Date();

      const modelStages = await storage.getFlightpathStages(tenantId, operatingModelId);
      const stage0 = modelStages.sort((a, b) => a.stageNumber - b.stageNumber).find(s => s.stageNumber === 0);

      if (modelChanged) {
        // Remove checkpoints/gates tied to stages of the previous model
        const validStageIds = new Set(modelStages.map(s => s.id));
        const checkpoints = await storage.getProjectCheckpoints(req.params.id, tenantId);
        for (const cp of checkpoints) {
          if (cp.stageId && !validStageIds.has(cp.stageId)) await storage.deleteProjectCheckpoint(cp.id, tenantId);
        }
        updates.flightpathStageId = stage0?.id || null;
      }

      const updated = await storage.updateTimeline(req.params.id, tenantId, updates);

      if (stage0) {
        const existing = await storage.getProjectCheckpointsByStage(req.params.id, stage0.id, tenantId);
        if (existing.length === 0) {
          const deliverables = await storage.getStageDeliverables(stage0.id, tenantId);
          for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
            await storage.createProjectCheckpoint({
              tenantId,
              timelineId: req.params.id,
              stageId: stage0.id,
              deliverableId: d.id,
              checkpointName: d.name,
              completed: false,
            });
          }
        }
      }

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
