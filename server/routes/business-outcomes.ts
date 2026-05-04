import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { extractUserId } from "./helpers";
import { insertBusinessOutcomeSchema } from "@shared/schema";

const VALID_STATUSES = ["draft", "active", "achieved", "at_risk", "cancelled"] as const;

export function registerBusinessOutcomeRoutes(app: Express) {
  app.get("/api/business-outcomes", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const outcomes = await storage.getBusinessOutcomes(req.tenantId || "default");
      res.json(outcomes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const outcome = await storage.getBusinessOutcome(req.params.id, req.tenantId || "default");
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json(outcome);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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

      if (parsed.data.status && !VALID_STATUSES.includes(parsed.data.status as any)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const outcome = await storage.createBusinessOutcome(parsed.data);
      res.status(201).json(outcome);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const allowedFields = ["title", "strategicObjective", "successMetric", "baseline", "target", "currentValue", "status", "evidence", "valueNotes", "clientId", "opportunityId", "projectId", "stageId", "ownerId", "targetDate"];
      const updates: Record<string, any> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (updates.status && !VALID_STATUSES.includes(updates.status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      if (updates.title !== undefined && (!updates.title || !String(updates.title).trim())) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }

      const outcome = await storage.updateBusinessOutcome(req.params.id, req.tenantId || "default", updates);
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json(outcome);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      await storage.deleteBusinessOutcome(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
