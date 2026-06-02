import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { extractUserId } from "./helpers";
import { insertBusinessOutcomeSchema, type BusinessOutcome, type InsertBusinessOutcome } from "@shared/schema";

const VALID_STATUSES: ReadonlyArray<BusinessOutcome["status"]> = ["draft", "active", "achieved", "at_risk", "cancelled"];

export function registerBusinessOutcomeRoutes(app: Express) {
  app.get("/api/business-outcomes", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const filters: { projectId?: string; opportunityId?: string } = {};
      if (typeof req.query.projectId === "string") filters.projectId = req.query.projectId;
      if (typeof req.query.opportunityId === "string") filters.opportunityId = req.query.opportunityId;
      const outcomes = await storage.getBusinessOutcomes(req.tenantId || "default", filters);
      res.json(outcomes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const outcome = await storage.getBusinessOutcome(req.params.id, req.tenantId || "default");
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json(outcome);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/business-outcomes", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const userId = extractUserId(req);
      const tenantId = req.tenantId || "default";

      const parsed = insertBusinessOutcomeSchema.safeParse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });

      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      if (parsed.data.status && !(VALID_STATUSES as ReadonlyArray<string>).includes(parsed.data.status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const outcome = await storage.createBusinessOutcome(parsed.data);
      res.status(201).json(outcome);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const allowedFields = ["title", "strategicObjective", "successMetric", "baseline", "target", "currentValue", "status", "evidence", "valueNotes", "clientId", "opportunityId", "projectId", "stageId", "ownerId", "targetDate"] as const;
      const updates: Partial<Pick<InsertBusinessOutcome, (typeof allowedFields)[number]>> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          (updates as Record<string, unknown>)[field] = req.body[field];
        }
      }

      if (updates.status && !(VALID_STATUSES as ReadonlyArray<string>).includes(updates.status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      if (updates.title !== undefined && (!updates.title || !String(updates.title).trim())) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }

      const outcome = await storage.updateBusinessOutcome(req.params.id, req.tenantId || "default", updates);
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json(outcome);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      await storage.deleteBusinessOutcome(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });
}
