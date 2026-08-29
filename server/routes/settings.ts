import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { extractUserId } from "./helpers";

export type OpportunityStatusValidationResult =
  | { ok: true; statuses: { value: string; label: string }[] }
  | { ok: false; error: string };

export function validateOpportunityStatuses(opts: any): OpportunityStatusValidationResult {
  const valid = Array.isArray(opts) && opts.every(
    (o: any) => o && typeof o.value === "string" && o.value.trim() !== "" && typeof o.label === "string" && o.label.trim() !== ""
  );
  if (!valid) {
    return { ok: false, error: "Opportunity statuses must be a list of options with a value and a label" };
  }
  const normalized = opts.map((o: any) => ({ value: o.value.trim(), label: o.label.trim() }));
  const values = new Set(normalized.map((o) => o.value));
  if (values.size !== normalized.length) {
    return { ok: false, error: "Opportunity status values must be unique" };
  }
  const required = ["qualifying", "won", "lost"];
  const missing = required.filter(v => !values.has(v));
  if (missing.length > 0) {
    return { ok: false, error: `Opportunity statuses must include the system statuses: ${missing.join(", ")}` };
  }
  return { ok: true, statuses: normalized };
}

export function registerSettingsRoutes(app: Express) {
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings(req.tenantId || "default");
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/settings", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const updates: any = {};
      const fields = [
        "riskRegisterEnabled", "opportunitiesEnabled", "minMarginForWon", "taskStatuses", "taskHealthOptions", "taskItemTypes",
        "riskProbabilities", "riskImpacts", "riskStatuses", "projectTypes",
        "engagementModels", "clients", "contactRoles", "industries", "projectStatuses",
        "teamMemberRoles", "regions", "dateFormats", "opportunityStatuses",
      ];
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (updates.opportunityStatuses !== undefined && updates.opportunityStatuses !== null) {
        const result = validateOpportunityStatuses(updates.opportunityStatuses);
        if (!result.ok) {
          return res.status(400).json({ message: result.error });
        }
        updates.opportunityStatuses = result.statuses;
      }

      const settings = await storage.updateSettings(updates, req.tenantId || "default");
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/api-tokens", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const tokens = await storage.getApiTokens(req.tenantId);
      const safe = tokens.map(t => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        expiresAt: t.expiresAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
        createdAt: t.createdAt,
        userId: t.userId,
      }));
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/api-tokens", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const createTokenSchema = z.object({
        name: z.string().min(1, "Token name is required").max(100, "Token name too long"),
        expiresAt: z.string().nullable().optional().refine(val => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime()) && d > new Date();
        }, "Expiration date must be a valid future date"),
      });
      const parsed = createTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { name, expiresAt } = parsed.data;
      const { randomBytes, createHash } = await import("crypto");
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const tokenPrefix = rawToken.slice(0, 8);
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const token = await storage.createApiToken({
        tenantId: req.tenantId,
        userId,
        name: name!.trim(),
        tokenHash,
        tokenPrefix,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.json({
        id: token.id,
        name: token.name,
        tokenPrefix: token.tokenPrefix,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        plainToken: rawToken,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/api-tokens/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const token = await storage.getApiToken(req.params.id, req.tenantId || "default");
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }
      const revoked = await storage.revokeApiToken(req.params.id, req.tenantId || "default");
      res.json({ id: revoked?.id, revokedAt: revoked?.revokedAt });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
