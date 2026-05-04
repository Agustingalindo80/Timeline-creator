import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext } from "./helpers";

export function registerTeamMemberRoutes(app: Express) {
  app.get("/api/team-members", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const members = await storage.getTeamMembers(req.tenantId);
        return res.json(members);
      }
      const members = await storage.getTeamMembersByTimelineIds(ctx.assignedTimelineIds);
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id, req.tenantId || "default");
      if (!member) return res.status(404).json({ message: "Team member not found" });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/team-members", requireModuleAccess("team_members"), async (req, res) => {
    try {
      const { name, email, role, department, monthlyCost, hourlyCost } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const member = await storage.createTeamMember({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        email: email || null,
        role: role || null,
        department: department || null,
        monthlyCost: monthlyCost || null,
        hourlyCost: hourlyCost || null,
      });
      res.status(201).json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/team-members/:id", requireModuleAccess("team_members"), async (req, res) => {
    try {
      const { name, email, role, department, monthlyCost, hourlyCost } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;
      if (department !== undefined) updates.department = department;
      if (monthlyCost !== undefined) updates.monthlyCost = monthlyCost;
      if (hourlyCost !== undefined) updates.hourlyCost = hourlyCost;
      const member = await storage.updateTeamMember(req.params.id, req.tenantId || "default", updates);
      if (!member) return res.status(404).json({ message: "Team member not found" });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/team-members/:id", requireModuleAccess("team_members"), async (req, res) => {
    try {
      await storage.deleteTeamMember(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
