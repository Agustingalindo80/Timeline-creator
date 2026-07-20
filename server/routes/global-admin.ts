import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { requireSuperAdmin } from "../middleware/superadmin";
import { eq } from "drizzle-orm";
import { users, timelines } from "@shared/schema";
import { extractUserId, getRecordAccessContext } from "./helpers";
import { provisionTenant } from "../tenant-provisioning";
import { getPortfolioHealth, getProjectStatusReport, getMilestonesReport, getRaidSummaryReport, getBusinessOutcomesReport, getOpportunityPipelineReport } from "../reports";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";

export function registerGlobalAdminRoutes(app: Express) {
  app.get("/api/global-admin/tenants", requireSuperAdmin(), async (req, res) => {
    try {
      const allTenants = await storage.getTenants();
      const result = [];
      for (const tenant of allTenants) {
        const usage = await storage.getTenantUsage(tenant.id);
        result.push({ ...tenant, ...usage });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/global-admin/tenants", requireSuperAdmin(), async (req, res) => {
    try {
      const { name, slug, plan, maxUsers, maxProjects, storageLimit, billingEmail, adminEmail, adminFirstName, adminLastName, locale } = req.body;
      if (!name || !slug) return res.status(400).json({ message: "name and slug required" });
      if (!adminEmail || !adminFirstName || !adminLastName) return res.status(400).json({ message: "Tenant Admin details (adminEmail, adminFirstName, adminLastName) are required" });
      const existing = (await storage.getTenants()).find(t => t.slug === slug);
      if (existing) return res.status(409).json({ message: "Slug already taken" });
      const userId = extractUserId(req);
      const tenant = await storage.createTenant({
        name, slug,
        plan: plan || "free",
        maxUsers: maxUsers || 10,
        maxProjects: maxProjects || 25,
        storageLimit: storageLimit || 1024,
        billingEmail: billingEmail || null,
        createdBy: userId,
      });
      await provisionTenant(tenant.id, { email: adminEmail, firstName: adminFirstName, lastName: adminLastName }, undefined, locale || "en");
      res.status(201).json(tenant);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/global-admin/tenants/:id", requireSuperAdmin(), async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      const usage = await storage.getTenantUsage(tenant.id);
      res.json({ ...tenant, ...usage });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/global-admin/tenants/:id", requireSuperAdmin(), async (req, res) => {
    try {
      const { name, status, plan, maxUsers, maxProjects, storageLimit, billingEmail } = req.body;
      const updated = await storage.updateTenant(req.params.id, {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(plan !== undefined && { plan }),
        ...(maxUsers !== undefined && { maxUsers }),
        ...(maxProjects !== undefined && { maxProjects }),
        ...(storageLimit !== undefined && { storageLimit }),
        ...(billingEmail !== undefined && { billingEmail }),
      });
      if (!updated) return res.status(404).json({ message: "Tenant not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/global-admin/tenants/:id", requireSuperAdmin(), async (req, res) => {
    try {
      const updated = await storage.updateTenant(req.params.id, { status: "suspended" });
      if (!updated) return res.status(404).json({ message: "Tenant not found" });
      res.json({ message: "Tenant suspended", tenant: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/global-admin/tenants/:id/permanent", requireSuperAdmin(), async (req, res) => {
    try {
      if (req.params.id === "default") {
        return res.status(400).json({ message: "The default tenant cannot be deleted" });
      }
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      if (tenant.slug !== req.body?.confirmSlug) {
        return res.status(400).json({ message: "Slug confirmation does not match" });
      }
      const deleted = await storage.deleteTenant(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Tenant not found" });
      res.json({ message: "Tenant permanently deleted", tenantId: req.params.id });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/global-admin/tenants/:id/usage", requireSuperAdmin(), async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      const usage = await storage.getTenantUsage(req.params.id);
      res.json({ tenant, usage });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/global-admin/tenants/:id/users", requireSuperAdmin(), async (req, res) => {
    try {
      const usersList = await storage.getUsersByTenant(req.params.id);
      res.json(usersList);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/global-admin/stats", requireSuperAdmin(), async (req, res) => {
    try {
      const allTenants = await storage.getTenants();
      const allUsers = await db.select({ id: users.id }).from(users);
      const allProjects = await db.select({ id: timelines.id }).from(timelines).where(eq(timelines.recordType, "project"));
      const allOpportunities = await db.select({ id: timelines.id }).from(timelines).where(eq(timelines.recordType, "opportunity"));
      res.json({
        totalTenants: allTenants.length,
        activeTenants: allTenants.filter(t => t.status === "active").length,
        totalUsers: allUsers.length,
        totalProjects: allProjects.length,
        totalOpportunities: allOpportunities.length,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/global-admin/check", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.json({ isSuperAdmin: false });
      const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
      res.json({ isSuperAdmin: user?.isSuperAdmin || false });
    } catch (err: any) { res.json({ isSuperAdmin: false }); }
  });

  app.get("/api/reports/portfolio-health", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const data = await getPortfolioHealth(tenantId, {
        clientId: req.query.clientId as string | undefined,
        region: req.query.region as string | undefined,
        status: req.query.status as string | undefined,
        healthFilter: req.query.healthFilter as string | undefined,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/project-status/:id", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const data = await getProjectStatusReport(tenantId, req.params.id);
      if (!data) return res.status(404).json({ message: "Project not found" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/milestones", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const data = await getMilestonesReport(tenantId, {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        financialOnly: req.query.financialOnly === "true",
        projectId: req.query.projectId as string | undefined,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/raid-summary", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const data = await getRaidSummaryReport(tenantId, {
        itemType: req.query.itemType as string | undefined,
        status: req.query.status as string | undefined,
        projectId: req.query.projectId as string | undefined,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/business-outcomes", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";
      const data = await getBusinessOutcomesReport(tenantId, ctx, {
        status: req.query.status as string | undefined,
        projectId: req.query.projectId as string | undefined,
        opportunityId: req.query.opportunityId as string | undefined,
        clientId: req.query.clientId as string | undefined,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/opportunity-pipeline", requireModuleAccess("reports"), requirePermission("reports.view"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";
      const data = await getOpportunityPipelineReport(tenantId, ctx, {
        clientId: req.query.clientId as string | undefined,
        region: req.query.region as string | undefined,
        industry: req.query.industry as string | undefined,
        cloud: req.query.cloud as string | undefined,
        status: req.query.status as string | undefined,
        segment: req.query.segment as string | undefined,
        country: req.query.country as string | undefined,
        strategicAccount: req.query.strategicAccount === "true",
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
