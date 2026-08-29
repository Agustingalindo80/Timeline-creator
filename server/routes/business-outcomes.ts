import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { extractUserId } from "./helpers";
import { z } from "zod";
import { insertBusinessOutcomeSchema, insertBusinessOutcomeMetricSchema, type BusinessOutcome, type InsertBusinessOutcome } from "@shared/schema";

const VALID_STATUSES: ReadonlyArray<BusinessOutcome["status"]> = ["draft", "active", "achieved", "at_risk", "cancelled"];
const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

export function registerBusinessOutcomeRoutes(app: Express) {
  app.get("/api/business-outcomes", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const filters: { projectId?: string; opportunityId?: string } = {};
      if (typeof req.query.projectId === "string") filters.projectId = req.query.projectId;
      if (typeof req.query.opportunityId === "string") filters.opportunityId = req.query.opportunityId;
      const tenantId = req.tenantId || "default";
      const outcomes = await storage.getBusinessOutcomes(tenantId, filters);
      const metrics = await storage.getBusinessOutcomeMetricsForOutcomes(outcomes.map((outcome) => outcome.id), tenantId);
      const metricsByOutcome = new Map<string, typeof metrics>();
      for (const metric of metrics) {
        const grouped = metricsByOutcome.get(metric.businessOutcomeId) ?? [];
        grouped.push(metric);
        metricsByOutcome.set(metric.businessOutcomeId, grouped);
      }
      res.json(outcomes.map((outcome) => ({
        ...outcome,
        metrics: metricsByOutcome.get(outcome.id) ?? [],
      })));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const outcome = await storage.getBusinessOutcome(routeParam(req.params.id), req.tenantId || "default");
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json({ ...outcome, metrics: await storage.getBusinessOutcomeMetrics(outcome.id, req.tenantId || "default") });
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

      const metricRows = z.array(z.unknown()).safeParse(req.body.metrics ?? []);
      if (!metricRows.success) return res.status(400).json({ message: "Metric validation failed" });
      const validatedMetrics = metricRows.data.map((row, sortOrder) =>
        insertBusinessOutcomeMetricSchema.safeParse({ ...(row as object), tenantId, businessOutcomeId: "pending", sortOrder }),
      );
      const invalidMetric = validatedMetrics.find((metric) => !metric.success);
      if (invalidMetric && !invalidMetric.success) {
        return res.status(400).json({ message: "Metric validation failed", errors: invalidMetric.error.flatten().fieldErrors });
      }
      const { outcome, metrics: createdMetrics } = await storage.createBusinessOutcomeWithMetrics(
        parsed.data,
        validatedMetrics.filter((metric) => metric.success).map((metric) => metric.data),
      );
      res.status(201).json({ ...outcome, metrics: createdMetrics });
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

      const outcome = await storage.updateBusinessOutcome(routeParam(req.params.id), req.tenantId || "default", updates);
      if (!outcome) return res.status(404).json({ message: "Business outcome not found" });
      res.json({ ...outcome, metrics: await storage.getBusinessOutcomeMetrics(outcome.id, req.tenantId || "default") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/business-outcomes/:id", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      await storage.deleteBusinessOutcome(routeParam(req.params.id), req.tenantId || "default");
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/business-outcomes/:id/metrics", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const outcomeId = routeParam(req.params.id);
      const parsed = insertBusinessOutcomeMetricSchema.safeParse({ ...req.body, tenantId, businessOutcomeId: outcomeId, sortOrder: 0 });
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      const metric = await storage.createBusinessOutcomeMetricAtEnd(parsed.data);
      if (!metric) return res.status(404).json({ message: "Business outcome not found" });
      res.status(201).json(metric);
    } catch (err: unknown) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.patch("/api/business-outcomes/:outcomeId/metrics/:metricId", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const outcomeId = routeParam(req.params.outcomeId);
      const metricId = routeParam(req.params.metricId);
      const existing = (await storage.getBusinessOutcomeMetrics(outcomeId, tenantId)).find((metric) => metric.id === metricId);
      if (!existing) return res.status(404).json({ message: "Business outcome metric not found" });
      const allowed = ["description", "currentValue", "currentValueType", "currentUnit", "expectedValue", "expectedValueType", "expectedUnit", "evaluationPeriod", "evaluationPeriodUnit"] as const;
      const changes = Object.fromEntries(allowed.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
      const parsed = insertBusinessOutcomeMetricSchema.safeParse({
        tenantId,
        businessOutcomeId: outcomeId,
        description: existing.description,
        currentValue: existing.currentValue,
        currentValueType: existing.currentValueType,
        currentUnit: existing.currentUnit,
        expectedValue: existing.expectedValue,
        expectedValueType: existing.expectedValueType,
        expectedUnit: existing.expectedUnit,
        evaluationPeriod: existing.evaluationPeriod,
        evaluationPeriodUnit: existing.evaluationPeriodUnit,
        sortOrder: existing.sortOrder,
        ...changes,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      const metric = await storage.updateBusinessOutcomeMetric(metricId, outcomeId, tenantId, parsed.data);
      if (!metric) return res.status(404).json({ message: "Business outcome metric not found" });
      res.json(metric);
    } catch (err: unknown) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete("/api/business-outcomes/:outcomeId/metrics/:metricId", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const deleted = await storage.deleteBusinessOutcomeMetric(routeParam(req.params.metricId), routeParam(req.params.outcomeId), req.tenantId || "default");
      if (!deleted) return res.status(404).json({ message: "Business outcome metric not found" });
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.post("/api/business-outcomes/:id/metrics/reorder", requireModuleAccess("business_outcomes"), async (req, res) => {
    try {
      const parsed = z.object({ metricIds: z.array(z.string().min(1)) }).strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      const outcomeId = routeParam(req.params.id);
      const reordered = await storage.reorderBusinessOutcomeMetrics(outcomeId, req.tenantId || "default", parsed.data.metricIds);
      if (!reordered) return res.status(400).json({ message: "Metrics must be a complete, unique list belonging to this business outcome" });
      res.json(await storage.getBusinessOutcomeMetrics(outcomeId, req.tenantId || "default"));
    } catch (err: unknown) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });
}
