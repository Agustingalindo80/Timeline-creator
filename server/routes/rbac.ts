import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { getEffectivePermissions, invalidatePermissionCache, hasGlobalRecordAccess, getLinkedTeamMemberId, getUserModulePermissions } from "../rbac";
import { eq, and } from "drizzle-orm";
import { ALL_PERMISSIONS, users, orgRoles } from "@shared/schema";

export function registerRbacRoutes(app: Express) {
  app.get("/api/rbac/roles", async (req, res) => {
    try {
      const roles = await storage.getOrgRoles(req.tenantId || "default");
      res.json(roles);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/users", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const usersList = await storage.getUsersByTenant(req.tenantId || "default");
      res.json(usersList);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/users", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const { email, firstName, lastName, roleId } = req.body;
      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ message: "A valid email is required" });
      }
      if (!roleId) return res.status(400).json({ message: "roleId is required" });

      const tenantId = req.tenantId || "default";
      const [role] = await db.select().from(orgRoles).where(and(eq(orgRoles.id, roleId), eq(orgRoles.tenantId, tenantId)));
      if (!role) return res.status(400).json({ message: "Role not found in this tenant" });

      const normalizedEmail = email.trim().toLowerCase();
      const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail));

      let user = existingUser;
      if (!user) {
        const [created] = await db.insert(users).values({
          email: normalizedEmail,
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
        }).returning();
        user = created;
      }

      await storage.assignUserOrgRole(user.id, roleId, tenantId);
      invalidatePermissionCache(user.id);
      res.status(201).json({ user, created: !existingUser });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/users/:userId/roles", requireModuleAccess("admin"), requirePermission("roles.manage"), async (req, res) => {
    try {
      const { roleId } = req.body;
      if (!roleId) return res.status(400).json({ message: "roleId is required" });
      await storage.assignUserOrgRole(req.params.userId as string, roleId, req.tenantId || "default");
      invalidatePermissionCache(req.params.userId as string);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/rbac/users/:userId/roles/:roleId", requireModuleAccess("admin"), requirePermission("roles.manage"), async (req, res) => {
    try {
      await storage.removeUserOrgRole(req.params.userId as string, req.params.roleId as string, req.tenantId || "default");
      invalidatePermissionCache(req.params.userId as string);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/rbac/users/:userId", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      const updated = await storage.updateUserDemographics(req.params.userId as string, { firstName, lastName, email });
      if (!updated) return res.status(404).json({ message: "User not found" });

      const tm = await storage.getTeamMemberByUserId(req.params.userId as string, req.tenantId || "default");
      if (tm) {
        const syncData: Record<string, any> = {};
        const newName = [firstName ?? updated.firstName, lastName ?? updated.lastName].filter(Boolean).join(" ");
        if (newName) syncData.name = newName;
        if (email !== undefined) syncData.email = email;
        if (Object.keys(syncData).length > 0) {
          await storage.updateTeamMember(tm.id, req.tenantId || "default", syncData);
        }
      }

      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/users/:userId/link-team-member", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const { teamMemberId } = req.body;
      if (!teamMemberId) return res.status(400).json({ message: "teamMemberId is required" });
      const member = await storage.getTeamMember(teamMemberId, req.tenantId || "default");
      if (!member) return res.status(404).json({ message: "Team member not found in this tenant" });
      if (member.userId && member.userId !== req.params.userId) {
        return res.status(400).json({ message: "This team member is already linked to another user" });
      }
      await storage.linkTeamMemberToUser(teamMemberId, req.params.userId as string);
      invalidatePermissionCache(req.params.userId as string);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/users/:userId/unlink-team-member", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const tm = await storage.getTeamMemberByUserId(req.params.userId as string, req.tenantId || "default");
      if (!tm) return res.status(404).json({ message: "No linked team member found" });
      await storage.unlinkTeamMemberFromUser(tm.id);
      invalidatePermissionCache(req.params.userId as string);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/objects/:objectType/:objectId/assignments", async (req, res) => {
    try {
      const assignments = await storage.getObjectAssignments(req.params.objectType, req.params.objectId, req.tenantId || "default");
      res.json(assignments);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/objects/:objectType/:objectId/assignments", requirePermission("project.edit", "opp.edit"), async (req, res) => {
    try {
      const { userId, objectRole } = req.body;
      if (!userId || !objectRole) return res.status(400).json({ message: "userId and objectRole are required" });
      const assignment = await storage.assignObjectRole(req.params.objectType as string, req.params.objectId as string, userId, objectRole, req.tenantId || "default");
      invalidatePermissionCache(userId);
      res.json(assignment);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/rbac/assignments/:assignmentId", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.removeObjectAssignment(req.params.assignmentId, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/permissions", async (_req, res) => {
    try {
      res.json(ALL_PERMISSIONS);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/my-permissions", async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || user?.id;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      // TODO: Remove before commercial launch — Super Admins get all permissions in every tenant for testing
      const [userRecord] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
      if (userRecord?.isSuperAdmin) {
        return res.json({ permissions: ALL_PERMISSIONS.map((p) => p.key) });
      }

      const perms = await getEffectivePermissions(userId, req.tenantId || "default");
      res.json({ permissions: Array.from(perms) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/my-assignments", async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || user?.id;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const assignments = await storage.getObjectAssignmentsByUser(userId, req.tenantId || "default");
      res.json(assignments);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/my-modules", async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || user?.id;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      // TODO: Remove before commercial launch — Super Admins see all modules for testing
      const [userRecord] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
      if (userRecord?.isSuperAdmin) {
        const allModules = [
          "module.dashboard", "module.coach", "module.projects", "module.opportunities",
          "module.clients", "module.contacts", "module.allocations", "module.timesheets",
          "module.team_members", "module.reports", "module.admin"
        ];
        const teamMemberId = await getLinkedTeamMemberId(userId);
        return res.json({ modules: allModules, isGlobalAccess: true, teamMemberId });
      }

      const modules = await getUserModulePermissions(userId, req.tenantId || "default");
      const isGlobal = await hasGlobalRecordAccess(userId, req.tenantId || "default");
      const teamMemberId = await getLinkedTeamMemberId(userId);
      res.json({ modules, isGlobalAccess: isGlobal, teamMemberId });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/roles", requireModuleAccess("admin"), requirePermission("roles.manage"), async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });
      const role = await storage.createOrgRole({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        description: description || null,
        isSystem: false,
      });
      if (permissions && Array.isArray(permissions)) {
        await storage.setOrgRolePermissions(role.id, req.tenantId || "default", permissions);
      }
      invalidatePermissionCache();
      res.json(role);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/rbac/roles/:id", requireModuleAccess("admin"), requirePermission("roles.manage"), async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      const existingRoles = await storage.getOrgRoles(req.tenantId || "default");
      const role = existingRoles.find(r => r.id === req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isSystem && name && name !== role.name) {
        return res.status(400).json({ message: "Cannot rename system roles" });
      }
      const updateData: any = {};
      if (name && !role.isSystem) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description;
      if (Object.keys(updateData).length > 0) {
        await storage.updateOrgRole(req.params.id, req.tenantId || "default", updateData);
      }
      if (permissions && Array.isArray(permissions)) {
        await storage.setOrgRolePermissions(req.params.id, req.tenantId || "default", permissions);
      }
      invalidatePermissionCache();
      const updated = await storage.getOrgRoles(req.tenantId || "default");
      const result = updated.find(r => r.id === req.params.id);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/rbac/roles/:id", requireModuleAccess("admin"), requirePermission("roles.manage"), async (req, res) => {
    try {
      const existingRoles = await storage.getOrgRoles(req.tenantId || "default");
      const role = existingRoles.find(r => r.id === req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isSystem) return res.status(400).json({ message: "Cannot delete system roles" });
      const userCount = await storage.getOrgRoleUserCount(req.params.id, req.tenantId || "default");
      if (userCount > 0) return res.status(400).json({ message: `Cannot delete role with ${userCount} assigned user(s). Remove assignments first.` });
      await storage.deleteOrgRole(req.params.id, req.tenantId || "default");
      invalidatePermissionCache();
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/rbac/roles/:id/permissions", async (req, res) => {
    try {
      const permissions = await storage.getOrgRolePermissions(req.params.id, req.tenantId || "default");
      res.json({ permissions });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/team-members/:id/enable-access", requirePermission("users.manage"), async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id, req.tenantId || "default");
      if (!member) return res.status(404).json({ message: "Team member not found" });
      if (!member.email) return res.status(400).json({ message: "Team member has no email address" });
      const user = await storage.createUserFromTeamMember(member.email, req.params.id);
      res.json(user);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/team-members/:id/disable-access", requirePermission("users.manage"), async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id, req.tenantId || "default");
      if (!member) return res.status(404).json({ message: "Team member not found" });
      await storage.unlinkTeamMemberFromUser(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
