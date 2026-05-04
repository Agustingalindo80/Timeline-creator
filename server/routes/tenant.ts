import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { eq } from "drizzle-orm";
import { users, userOrgRoles } from "@shared/schema";
import { extractUserId } from "./helpers";

export function registerTenantRoutes(app: Express) {
  app.post("/api/tenant/switch", isAuthenticated, async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const { tenantId } = req.body;
      if (!tenantId) return res.status(400).json({ message: "tenantId required" });
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const [userRecord] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId)).limit(1);
      if (!userRecord?.isSuperAdmin) {
        const membership = await db.select({ tenantId: userOrgRoles.tenantId }).from(userOrgRoles)
          .where(eq(userOrgRoles.userId, userId)).limit(1);
        if (membership.length === 0) return res.status(403).json({ message: "You do not have access to this tenant" });
      }

      (req.session as any).activeTenantId = tenantId;
      res.json({ message: "Switched", tenantId });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/tenant/current", isAuthenticated, async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const tenant = await storage.getTenant(tenantId);
      res.json({ tenantId, tenant: tenant || null, tenantSlug: req.tenantSlug || tenant?.slug || null });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/tenant/by-slug/:slug", isAuthenticated, async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      res.json(tenant);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/tenant/my-tenants", isAuthenticated, async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      // TODO: Remove before commercial launch — Super Admins should not see all tenants in production
      const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
      if (user?.isSuperAdmin) {
        const allTenants = await storage.getTenants();
        return res.json(allTenants);
      }

      const roles = await db.selectDistinct({ tenantId: userOrgRoles.tenantId })
        .from(userOrgRoles)
        .where(eq(userOrgRoles.userId, userId));
      const tenantIds = roles.map(r => r.tenantId);
      if (tenantIds.length === 0) return res.json([]);
      const allTenants = await storage.getTenants();
      const myTenants = allTenants.filter(t => tenantIds.includes(t.id));
      res.json(myTenants);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
