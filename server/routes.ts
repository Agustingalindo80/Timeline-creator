import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import path from "path";
import fs from "fs";
import express from "express";
import OpenAI from "openai";
import { listFilesInFolder, getFileMetadata, getFileContent, extractFolderIdFromUrl } from "./google-drive";
import { storage } from "./storage";
import { db } from "./db";
import { seedFlightpathData } from "./seed-flightpath";
import { provisionTenant } from "./tenant-provisioning";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { requirePermission, requireModuleAccess } from "./middleware/permissions";
import { tenantContext } from "./middleware/tenant";
import { requireSuperAdmin } from "./middleware/superadmin";
import { getEffectivePermissions, invalidatePermissionCache, hasGlobalRecordAccess, getLinkedTeamMemberId, getUserModulePermissions } from "./rbac";
import { eq, and } from "drizzle-orm";
import { ALL_PERMISSIONS, users, timelines, userOrgRoles } from "@shared/schema";
import { calculateEVMForWeek } from "./evm-engine";
import { getPortfolioHealth, getProjectStatusReport, getMilestonesReport, getRaidSummaryReport } from "./reports";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function recalcApprovedBudget(timelineId: string, tenantId: string) {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) return;

  const totalAmount = timeline.milestones
    .filter(m => m.isFinancialObligation && m.amount)
    .reduce((sum, m) => sum + (parseFloat(m.amount!) || 0), 0);

  const budgetStr = totalAmount > 0 ? totalAmount.toFixed(2) : null;
  const cost = parseFloat(timeline.totalRunningCost ?? "0") || 0;
  let grossMargin: string | null = null;
  if (totalAmount > 0 && cost > 0) {
    grossMargin = (((totalAmount - cost) / totalAmount) * 100).toFixed(2);
  } else if (totalAmount > 0) {
    grossMargin = "100.00";
  }

  await storage.updateTimeline(timelineId, tenantId, {
    approvedBudget: budgetStr,
    grossMargin,
  });
}

async function recalcTotalRunningCost(timelineId: string, tenantId: string) {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) return;

  const allocs = await storage.getAllocationsByTimeline(timelineId, tenantId);
  const activeAllocs = allocs.filter(a => a.status === "active");

  let totalCost = 0;

  const now = new Date();
  const projectStart = timeline.startDate ? new Date(timeline.startDate) : null;
  const projectEnd = timeline.endDate ? new Date(timeline.endDate) : null;

  for (const a of activeAllocs) {
    const member = a.teamMember;
    let allocStart = a.startDate ? new Date(a.startDate) : projectStart;
    let allocEnd = a.endDate ? new Date(a.endDate) : projectEnd;

    if (!allocStart || isNaN(allocStart.getTime())) continue;

    if (projectStart && !isNaN(projectStart.getTime()) && allocStart < projectStart) {
      allocStart = projectStart;
    }
    if (projectEnd && !isNaN(projectEnd.getTime()) && allocEnd && allocEnd > projectEnd) {
      allocEnd = projectEnd;
    }

    if (now < allocStart) continue;

    const effectiveEnd = allocEnd && !isNaN(allocEnd.getTime()) && allocEnd < now ? allocEnd : now;
    const diffMs = effectiveEnd.getTime() - allocStart.getTime();
    if (diffMs <= 0) continue;

    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeline.engagementModel === "fixed_bid") {
      const monthlyCost = parseFloat(member.monthlyCost ?? "0") || 0;
      const startYear = allocStart.getFullYear();
      const startMonth = allocStart.getMonth();
      const endYear = effectiveEnd.getFullYear();
      const endMonth = effectiveEnd.getMonth();
      const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      totalCost += monthlyCost * months;
    } else {
      const hourlyCost = parseFloat(member.hourlyCost ?? "0") || 0;
      const weeklyHours = parseFloat(a.weeklyHours ?? "0") || 0;
      const weeks = diffDays / 7;
      totalCost += hourlyCost * weeklyHours * weeks;
    }
  }

  const costStr = totalCost > 0 ? totalCost.toFixed(2) : null;
  const budget = parseFloat(timeline.approvedBudget ?? "0") || 0;
  let grossMargin: string | null = null;
  if (budget > 0 && totalCost > 0) {
    grossMargin = (((budget - totalCost) / budget) * 100).toFixed(2);
  } else if (budget > 0) {
    grossMargin = "100.00";
  }

  await storage.updateTimeline(timelineId, tenantId, {
    totalRunningCost: costStr,
    grossMargin,
  });
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseDateToNum(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 999999;
}

async function recalcPhaseProgress(phaseId: string, tenantId: string) {
  const children = await storage.getTasksByParent(phaseId, tenantId);
  if (children.length === 0) return;

  let totalWeight = 0;
  let weightedSum = 0;
  let anyInProgress = false;
  let allComplete = true;

  for (const child of children) {
    const dur = (child.startDate && child.endDate) ? Math.max(1, parseDateToNum(child.endDate) - parseDateToNum(child.startDate)) : 1;
    totalWeight += dur;
    weightedSum += child.percentComplete * dur;
    if (child.status === "in_progress") anyInProgress = true;
    if (child.status !== "complete") allComplete = false;
  }

  const updates: any = {};
  updates.percentComplete = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const phase = await storage.getTask(phaseId, tenantId);
  if (phase) {
    if (allComplete) {
      updates.status = "complete";
    } else if ((anyInProgress || children.some(c => c.status === "complete")) && phase.status === "not_started") {
      updates.status = "in_progress";
    }
  }

  await storage.updateTask(phaseId, tenantId, updates);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadsDir));

  app.use((req, _res, next) => {
    const match = req.path.match(/^\/t\/([a-z0-9-]+)(\/api\/.*)$/);
    if (match) {
      req.url = match[2];
    }
    next();
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const publicPaths = ["/api/login", "/api/logout", "/api/callback", "/api/auth/user", "/api/branding"];
    if (publicPaths.includes(req.path)) return next();
    return isAuthenticated(req, res, next);
  });

  app.use(tenantContext());

  function extractUserId(req: any): string | null {
    const user = req.user;
    if (!user) return null;
    return user?.claims?.sub || user?.id || null;
  }

  async function getRecordAccessContext(req: any): Promise<{
    userId: string;
    isGlobal: boolean;
    teamMemberId: string | null;
    assignedTimelineIds: string[];
  } | null> {
    const userId = extractUserId(req);
    if (!userId) return null;
    const tenantId = req.tenantId || "default";

    // TODO: Remove before commercial launch — Super Admins get global access in all tenants for testing
    const [superCheck] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
    if (superCheck?.isSuperAdmin) {
      return { userId, isGlobal: true, teamMemberId: null, assignedTimelineIds: [] };
    }

    const isGlobal = await hasGlobalRecordAccess(userId, tenantId);
    if (isGlobal) {
      return { userId, isGlobal: true, teamMemberId: null, assignedTimelineIds: [] };
    }
    const teamMemberId = await getLinkedTeamMemberId(userId);
    const assignedTimelineIds = teamMemberId
      ? await storage.getAssignedTimelineIds(teamMemberId)
      : [];
    return { userId, isGlobal: false, teamMemberId, assignedTimelineIds };
  }

  async function checkTimelineAccess(req: any, res: any, timelineId: string): Promise<boolean> {
    const ctx = await getRecordAccessContext(req);
    if (!ctx) { res.status(401).json({ message: "Authentication required" }); return false; }
    if (ctx.isGlobal) return true;
    if (!ctx.assignedTimelineIds.includes(timelineId)) {
      res.status(403).json({ message: "You don't have access to this project" });
      return false;
    }
    return true;
  }

  // --- BRANDING ROUTES ---

  app.get("/api/branding", async (req, res) => {
    try {
      const branding = await storage.getBranding(req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/branding", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const fields = [
        "appName", "logoUrl", "faviconUrl", "primaryColor",
        "sidebarColor", "sidebarForegroundColor", "sidebarAccentColor", "accentColor",
      ];
      const updates: any = {};
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      const branding = await storage.updateBranding(updates, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/logo", requireModuleAccess("admin"), requirePermission("org.settings.manage"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `logo-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ logoUrl: url }, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/favicon", requireModuleAccess("admin"), requirePermission("org.settings.manage"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `favicon-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ faviconUrl: url }, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- CLIENT ROUTES ---

  app.get("/api/clients", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const clients = await storage.getClients(req.tenantId);
        return res.json(clients);
      }
      const clients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal) {
        const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
        if (!accessibleClients.some(c => c.id === req.params.id)) {
          return res.status(403).json({ message: "You don't have access to this client" });
        }
      }
      const client = await storage.getClientWithProjects(req.params.id, req.tenantId || "default");
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients", requireModuleAccess("clients"), async (req, res) => {
    try {
      const { name, industry, contactPhone, website, address, notes, status } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Client name is required" });
      }
      const client = await storage.createClient({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        industry: industry || null,
        contactPhone: contactPhone || null,
        website: website || null,
        address: address || null,
        notes: notes || null,
        status: status || "active",
      });
      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", requireModuleAccess("clients"), async (req, res) => {
    try {
      const { name, industry, contactPhone, website, address, notes, status } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (industry !== undefined) updates.industry = industry;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (website !== undefined) updates.website = website;
      if (address !== undefined) updates.address = address;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;

      const client = await storage.updateClient(req.params.id, req.tenantId || "default", updates);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/clients/:id", requireModuleAccess("clients"), async (req, res) => {
    try {
      await storage.deleteClient(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- CONTACT ROUTES ---

  app.get("/api/contacts", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const allContacts = await storage.getAllContacts(req.tenantId);
        return res.json(allContacts);
      }
      const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
      const clientIds = accessibleClients.map(c => c.id);
      const contacts = await storage.getContactsByClientIds(clientIds);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:clientId/contacts", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal) {
        const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
        if (!accessibleClients.some(c => c.id === req.params.clientId)) {
          return res.status(403).json({ message: "You don't have access to this client's contacts" });
        }
      }
      const contacts = await storage.getContacts(req.params.clientId, req.tenantId || "default");
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:clientId/contacts", requireModuleAccess("contacts"), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, isLegalRepresentative } = req.body;
      if (!firstName?.trim() || !lastName?.trim()) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const contact = await storage.createContact({
        tenantId: req.tenantId || "default",
        clientId: req.params.clientId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || null,
        phone: phone || null,
        role: role || null,
        isLegalRepresentative: isLegalRepresentative ?? false,
      });
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/contacts/:id", requireModuleAccess("contacts"), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, isLegalRepresentative } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (isLegalRepresentative !== undefined) updates.isLegalRepresentative = isLegalRepresentative;

      const contact = await storage.updateContact(req.params.id, req.tenantId || "default", updates);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", requireModuleAccess("contacts"), async (req, res) => {
    try {
      await storage.deleteContact(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- TIMELINE ROUTES ---

  app.get("/api/timelines", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const timelines = await storage.getTimelines("project", req.tenantId);
        return res.json(timelines);
      }
      const timelines = await storage.getTimelinesByIds(ctx.assignedTimelineIds, "project");
      res.json(timelines);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal && !ctx.assignedTimelineIds.includes(req.params.id)) {
        return res.status(403).json({ message: "You don't have access to this project" });
      }
      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });
      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const createTimelineBody = z.object({
    title: z.string().min(1, "Title is required").trim(),
    description: z.string().nullable().optional(),
    color: z.string().default("#2563eb"),
    milestones: z.array(z.object({
      title: z.string().min(1, "Milestone title is required"),
      description: z.string().nullable().optional(),
      date: z.string().min(1, "Milestone date is required"),
      actualDate: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      sortOrder: z.number().default(0),
    })).optional(),
  });

  // CREATE timeline with milestones
  app.post("/api/timelines", requirePermission("project.create"), async (req, res) => {
    try {
      const parsed = createTimelineBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { title, description, color, milestones: milestonesData } = parsed.data;

      const timeline = await storage.createTimeline({
        tenantId: req.tenantId || "default",
        title,
        description: description || null,
        color,
      });

      if (milestonesData && Array.isArray(milestonesData)) {
        for (const m of milestonesData) {
          await storage.createMilestone({
            tenantId: req.tenantId || "default",
            timelineId: timeline.id,
            title: m.title,
            description: m.description || null,
            date: m.date,
            actualDate: m.actualDate || null,
            color: m.color || null,
            icon: m.icon || null,
            sortOrder: m.sortOrder ?? 0,
          });
        }
      }

      const full = await storage.getTimeline(timeline.id, req.tenantId || "default");
      res.status(201).json(full);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE timeline
  app.patch("/api/timelines/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      const updates: any = {};
      const timelineFields = [
        "title", "description", "color", "healthOverall", "scopeHealth", "budgetHealth",
        "teamHealth", "projectType", "engagementModel", "client", "clientId",
        "approvedBudget", "totalRunningCost", "grossMargin", "projectStatus", "region",
        "startDate", "endDate", "docRepositoryType", "docRepositoryUrl",
      ];
      for (const field of timelineFields) {
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
      if (req.body.docRepositoryFolderId !== undefined && updates.docRepositoryFolderId === undefined) {
        updates.docRepositoryFolderId = req.body.docRepositoryFolderId;
      }

      if (updates.approvedBudget !== undefined || updates.totalRunningCost !== undefined) {
        const existing = await storage.getTimeline(req.params.id, req.tenantId || "default");
        if (existing) {
          const budget = parseFloat(updates.approvedBudget !== undefined ? updates.approvedBudget : existing.approvedBudget ?? "0") || 0;
          const cost = parseFloat(updates.totalRunningCost !== undefined ? updates.totalRunningCost : existing.totalRunningCost ?? "0") || 0;
          if (budget > 0) {
            updates.grossMargin = (((budget - cost) / budget) * 100).toFixed(2);
          } else {
            updates.grossMargin = null;
          }
        }
      }

      const timeline = await storage.updateTimeline(req.params.id, req.tenantId || "default", updates);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      if (updates.engagementModel !== undefined || updates.startDate !== undefined || updates.endDate !== undefined) {
        await recalcTotalRunningCost(req.params.id, req.tenantId || "default");
        const refreshed = await storage.getTimeline(req.params.id, req.tenantId || "default");
        if (refreshed) return res.json(refreshed);
      }

      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE timeline
  app.delete("/api/timelines/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.deleteTimeline(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/milestones", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { title, description, date, actualDate, color, icon, sortOrder, isFinancialObligation, amount } = req.body;
      if (!title || !date) {
        return res.status(400).json({ message: "Title and date are required" });
      }

      const milestone = await storage.createMilestone({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        title,
        description: description || null,
        date,
        actualDate: actualDate || null,
        color: color || null,
        icon: icon || null,
        sortOrder: sortOrder ?? 0,
        isFinancialObligation: isFinancialObligation ?? false,
        amount: amount || null,
      });
      if (isFinancialObligation && amount) {
        await recalcApprovedBudget(req.params.id, req.tenantId || "default");
      }
      res.status(201).json(milestone);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE milestone
  app.patch("/api/milestones/:id", async (req, res) => {
    try {
      const { title, description, date, actualDate, color, icon, sortOrder, isFinancialObligation, amount } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (date !== undefined) updates.date = date;
      if (actualDate !== undefined) updates.actualDate = actualDate;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isFinancialObligation !== undefined) updates.isFinancialObligation = isFinancialObligation;
      if (amount !== undefined) updates.amount = amount;

      const milestone = await storage.updateMilestone(req.params.id, req.tenantId || "default", updates);
      if (!milestone) return res.status(404).json({ message: "Milestone not found" });

      if (isFinancialObligation !== undefined || amount !== undefined) {
        await recalcApprovedBudget(milestone.timelineId, req.tenantId || "default");
      }
      res.json(milestone);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE milestone
  app.delete("/api/milestones/:id", async (req, res) => {
    try {
      const { milestones: milestonesTable } = await import("@shared/schema");
      const { eq: eqOp, and: andOp } = await import("drizzle-orm");
      const [existing] = await db.select({ timelineId: milestonesTable.timelineId, isFinancialObligation: milestonesTable.isFinancialObligation }).from(milestonesTable).where(andOp(eqOp(milestonesTable.id, req.params.id), eqOp(milestonesTable.tenantId, req.tenantId || "default")));
      await storage.deleteMilestone(req.params.id, req.tenantId || "default");
      if (existing?.isFinancialObligation) {
        await recalcApprovedBudget(existing.timelineId, req.tenantId || "default");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id/tasks", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const taskList = await storage.getTasksByTimeline(req.params.id, req.tenantId || "default");
      res.json(taskList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ADD task to timeline
  app.post("/api/timelines/:id/tasks", requireModuleAccess("projects"), async (req, res) => {
    try {
      const { title, description, startDate, endDate, actualStartDate, actualEndDate, color, sortOrder, status, health, itemType, parentTaskId, estimatedHours, confidenceLevel, taskType, assignedRoleId, durationWeeks } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const parentTimeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (parentTimeline && parentTimeline.recordType === "project" && (!startDate || !endDate)) {
        return res.status(400).json({ message: "Start date and end date are required for project tasks" });
      }

      if (startDate && endDate && parentTaskId && (itemType || "workstream") === "workstream") {
        const parentPhase = await storage.getTask(parentTaskId, req.tenantId || "default");
        if (parentPhase && parentPhase.startDate && parentPhase.endDate) {
          const phaseStart = parseDateToNum(parentPhase.startDate);
          const phaseEnd = parseDateToNum(parentPhase.endDate);
          const wsStart = parseDateToNum(startDate);
          const wsEnd = parseDateToNum(endDate);
          if (wsStart < phaseStart || wsEnd > phaseEnd) {
            return res.status(400).json({ message: `Workstream dates must fall within the parent Phase date range (${parentPhase.startDate} — ${parentPhase.endDate})` });
          }
        }
      }

      const { percentComplete } = req.body;
      const clampedPercent = Math.max(0, Math.min(100, parseInt(percentComplete) || 0));
      const task = await storage.createTask({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        title,
        description: description || null,
        startDate: startDate || null,
        endDate: endDate || null,
        actualStartDate: actualStartDate || null,
        actualEndDate: actualEndDate || null,
        color: color || null,
        percentComplete: clampedPercent,
        sortOrder: sortOrder ?? 0,
        status: status || "not_started",
        health: health || "green",
        itemType: itemType || "workstream",
        parentTaskId: parentTaskId || null,
        estimatedHours: estimatedHours || null,
        confidenceLevel: confidenceLevel || null,
        taskType: taskType || null,
        assignedRoleId: assignedRoleId || null,
        durationWeeks: durationWeeks || null,
      });

      if (parentTaskId) {
        await recalcPhaseProgress(parentTaskId, req.tenantId || "default");
      }

      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const { title, description, startDate, endDate, actualStartDate, actualEndDate, color, percentComplete, sortOrder, status, health, itemType, parentTaskId, estimatedHours, confidenceLevel, taskType, assignedRoleId, durationWeeks } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      if (actualStartDate !== undefined) updates.actualStartDate = actualStartDate;
      if (actualEndDate !== undefined) updates.actualEndDate = actualEndDate;
      if (color !== undefined) updates.color = color;
      if (percentComplete !== undefined) updates.percentComplete = Math.max(0, Math.min(100, parseInt(percentComplete) || 0));
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (status !== undefined) updates.status = status;
      if (health !== undefined) updates.health = health;
      if (itemType !== undefined) updates.itemType = itemType;
      if (parentTaskId !== undefined) updates.parentTaskId = parentTaskId;
      if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours;
      if (confidenceLevel !== undefined) updates.confidenceLevel = confidenceLevel;
      if (taskType !== undefined) updates.taskType = taskType;
      if (assignedRoleId !== undefined) updates.assignedRoleId = assignedRoleId;
      if (durationWeeks !== undefined) updates.durationWeeks = durationWeeks;

      const currentTask = await storage.getTask(req.params.id, req.tenantId || "default");
      if (currentTask) {
        const resolvedParentId = parentTaskId !== undefined ? parentTaskId : currentTask.parentTaskId;
        const resolvedType = itemType !== undefined ? itemType : currentTask.itemType;
        const resolvedStartDate = startDate !== undefined ? startDate : currentTask.startDate;
        const resolvedEndDate = endDate !== undefined ? endDate : currentTask.endDate;
        if (resolvedParentId && resolvedType === "workstream" && resolvedStartDate && resolvedEndDate) {
          const parentPhase = await storage.getTask(resolvedParentId, req.tenantId || "default");
          if (parentPhase && parentPhase.startDate && parentPhase.endDate) {
            const wsStart = parseDateToNum(resolvedStartDate);
            const wsEnd = parseDateToNum(resolvedEndDate);
            const phaseStart = parseDateToNum(parentPhase.startDate);
            const phaseEnd = parseDateToNum(parentPhase.endDate);
            if (wsStart < phaseStart || wsEnd > phaseEnd) {
              return res.status(400).json({ message: `Workstream dates must fall within the parent Phase date range (${parentPhase.startDate} — ${parentPhase.endDate})` });
            }
          }
        }
      }

      const task = await storage.updateTask(req.params.id, req.tenantId || "default", updates);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const resolvedParentId = parentTaskId !== undefined ? parentTaskId : currentTask?.parentTaskId;
      if (resolvedParentId) {
        await recalcPhaseProgress(resolvedParentId, req.tenantId || "default");
      }
      if (task.itemType === "phase") {
        await recalcPhaseProgress(task.id, req.tenantId || "default");
      }

      res.json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const taskToDelete = await storage.getTask(req.params.id, req.tenantId || "default");
      await storage.deleteTask(req.params.id, req.tenantId || "default");
      if (taskToDelete?.parentTaskId) {
        await recalcPhaseProgress(taskToDelete.parentTaskId, req.tenantId || "default");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== TIMESHEET ENTRIES =====

  app.get("/api/timesheets", async (req, res) => {
    try {
      const { timelineId, teamMemberId, weekEnding } = req.query;
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });

      if (!ctx.isGlobal) {
        const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
          timelineId: timelineId as string | undefined,
          teamMemberId: ctx.teamMemberId || undefined,
          weekEnding: weekEnding as string | undefined,
        });
        return res.json(entries);
      }

      const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
        timelineId: timelineId as string | undefined,
        teamMemberId: teamMemberId as string | undefined,
        weekEnding: weekEnding as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id/timesheets", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { weekEnding, teamMemberId } = req.query;
      const entries = await storage.getTimesheetEntries(req.tenantId || "default", {
        timelineId: req.params.id,
        weekEnding: weekEnding as string | undefined,
        teamMemberId: teamMemberId as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timesheets", async (req, res) => {
    try {
      const { timelineId, teamMemberId, taskId, weekEnding, dayDate, hours, billableType, notes } = req.body;
      if (!timelineId || !teamMemberId || !weekEnding || hours === undefined) {
        return res.status(400).json({ message: "timelineId, teamMemberId, weekEnding, and hours are required" });
      }
      const allAllocations = await storage.getAllocations(teamMemberId, req.tenantId || "default");
      const hasActiveAllocation = allAllocations.some(a => a.timelineId === timelineId && a.status === "active");
      if (!hasActiveAllocation) {
        return res.status(403).json({ message: "Team member does not have an active allocation to this project" });
      }
      const entry = await storage.createTimesheetEntry({
        tenantId: req.tenantId || "default",
        timelineId,
        teamMemberId,
        taskId: taskId || null,
        weekEnding,
        dayDate: dayDate || null,
        hours: String(hours),
        billableType: billableType || "billable",
        notes: notes || null,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/timesheets/:entryId", async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.hours !== undefined) updates.hours = String(req.body.hours);
      if (req.body.taskId !== undefined) updates.taskId = req.body.taskId;
      if (req.body.weekEnding !== undefined) updates.weekEnding = req.body.weekEnding;
      if (req.body.dayDate !== undefined) updates.dayDate = req.body.dayDate;
      if (req.body.billableType !== undefined) updates.billableType = req.body.billableType;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.teamMemberId !== undefined) updates.teamMemberId = req.body.teamMemberId;
      if (req.body.timelineId !== undefined) updates.timelineId = req.body.timelineId;
      const entry = await storage.updateTimesheetEntry(req.params.entryId, req.tenantId || "default", updates);
      if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/timesheets/:entryId", async (req, res) => {
    try {
      await storage.deleteTimesheetEntry(req.params.entryId, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== PROGRESS ENTRIES =====

  app.get("/api/timelines/:id/progress", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { weekEnding, taskId } = req.query;
      const entries = await storage.getProgressEntries(req.tenantId || "default", {
        timelineId: req.params.id,
        weekEnding: weekEnding as string | undefined,
        taskId: taskId as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/progress", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { taskId, weekEnding, percentComplete, notes } = req.body;
      if (!taskId || !weekEnding || percentComplete === undefined) {
        return res.status(400).json({ message: "taskId, weekEnding, and percentComplete are required" });
      }
      const pct = Math.max(0, Math.min(100, parseInt(percentComplete) || 0));

      const task = await storage.getTask(taskId, req.tenantId || "default");
      if (!task || task.timelineId !== req.params.id) {
        return res.status(400).json({ message: "Task not found in this project" });
      }
      if (task.itemType !== "workstream") {
        return res.status(400).json({ message: "Progress can only be entered for workstreams" });
      }

      const entry = await storage.createProgressEntry({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        taskId,
        weekEnding,
        percentComplete: pct,
        notes: notes || null,
      });

      await storage.updateTask(taskId, req.tenantId || "default", { percentComplete: pct });
      if (task.parentTaskId) {
        await recalcPhaseProgress(task.parentTaskId, req.tenantId || "default");
      }

      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/progress/:entryId", async (req, res) => {
    try {
      const existing = await storage.getProgressEntry(req.params.entryId, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Progress entry not found" });

      const updates: any = {};
      if (req.body.percentComplete !== undefined) updates.percentComplete = Math.max(0, Math.min(100, parseInt(req.body.percentComplete) || 0));
      if (req.body.weekEnding !== undefined) updates.weekEnding = req.body.weekEnding;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const entry = await storage.updateProgressEntry(req.params.entryId, req.tenantId || "default", updates);
      if (!entry) return res.status(404).json({ message: "Progress entry not found" });

      if (updates.percentComplete !== undefined) {
        const task = await storage.getTask(existing.taskId, req.tenantId || "default");
        if (task) {
          await storage.updateTask(existing.taskId, req.tenantId || "default", { percentComplete: updates.percentComplete });
          if (task.parentTaskId) {
            await recalcPhaseProgress(task.parentTaskId, req.tenantId || "default");
          }
        }
      }

      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/progress/:entryId", async (req, res) => {
    try {
      await storage.deleteProgressEntry(req.params.entryId, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET risks for timeline
  app.get("/api/timelines/:id/risks", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const risks = await storage.getRisks(req.params.id, req.tenantId || "default");
      res.json(risks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ADD risk to timeline
  app.post("/api/timelines/:id/risks", requirePermission("raid.edit"), async (req, res) => {
    try {
      const { title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const risk = await storage.createRisk({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        title,
        description: description || null,
        category: category || null,
        owner: owner || null,
        probability: probability || "medium",
        impact: impact || "medium",
        mitigation: mitigation || null,
        contingency: contingency || null,
        status: status || "open",
        dueDate: dueDate || null,
        sortOrder: sortOrder ?? 0,
      });
      res.status(201).json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE risk
  app.patch("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      const { title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (owner !== undefined) updates.owner = owner;
      if (probability !== undefined) updates.probability = probability;
      if (impact !== undefined) updates.impact = impact;
      if (mitigation !== undefined) updates.mitigation = mitigation;
      if (contingency !== undefined) updates.contingency = contingency;
      if (status !== undefined) updates.status = status;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const risk = await storage.updateRisk(req.params.id, req.tenantId || "default", updates);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      res.json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE risk
  app.delete("/api/risks/:id", requirePermission("raid.edit"), async (req, res) => {
    try {
      await storage.deleteRisk(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- TEAM MEMBER ROUTES ---

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

  // --- RATE CARD ROUTES ---

  app.get("/api/rate-cards", async (req, res) => {
    try {
      const cards = await storage.getRateCards(req.tenantId);
      res.json(cards);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rate-cards", requirePermission("rates.edit"), async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const card = await storage.createRateCard({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        role: role || null,
        region: region || null,
        costRate: costRate || null,
        billRate: billRate || null,
      });
      res.status(201).json(card);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/rate-cards/:id", requirePermission("rates.edit"), async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (region !== undefined) updates.region = region;
      if (costRate !== undefined) updates.costRate = costRate;
      if (billRate !== undefined) updates.billRate = billRate;
      const card = await storage.updateRateCard(req.params.id, req.tenantId || "default", updates);
      if (!card) return res.status(404).json({ message: "Rate card not found" });
      res.json(card);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rate-cards/:id", requirePermission("rates.edit"), async (req, res) => {
    try {
      await storage.deleteRateCard(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- PROJECT TEAM MEMBER ROUTES ---

  app.get("/api/timelines/:id/team", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const members = await storage.getProjectTeamMembers(req.params.id, req.tenantId || "default");
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/team", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      const parentTimeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (parentTimeline && parentTimeline.recordType === "project" && !teamMemberId) {
        return res.status(400).json({ message: "Team member is required for projects" });
      }
      if (!teamMemberId && !rateCardId) {
        return res.status(400).json({ message: "Either a team member or a role (rate card) is required" });
      }
      const assignment = await storage.createProjectTeamMember({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        teamMemberId: teamMemberId || null,
        rateCardId: rateCardId || null,
        monthlyCost: monthlyCost || null,
        hourlyCost: hourlyCost || null,
        allocation: allocation ?? 100,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      res.status(201).json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/team/sync-from-estimate", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const timelineId = req.params.id;
      const timeline = await storage.getTimeline(timelineId, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });
      if (timeline.recordType !== "opportunity") {
        return res.status(400).json({ message: "Sync from estimate is only available for opportunities" });
      }

      const allResources = await storage.getWorkstreamResourcesByTimeline(timelineId, req.tenantId || "default");
      const allTasks = await storage.getTasksByTimeline(timelineId, req.tenantId || "default");
      const existingTeam = await storage.getProjectTeamMembers(timelineId, req.tenantId || "default");
      const allRateCards = await storage.getRateCards(req.tenantId);
      const rateCardMap = new Map(allRateCards.map(rc => [rc.id, rc]));
      const taskMap = new Map(allTasks.map(t => [t.id, t]));

      const existingCountByCard: Record<string, number> = {};
      for (const t of existingTeam) {
        if (t.rateCardId) {
          existingCountByCard[t.rateCardId] = (existingCountByCard[t.rateCardId] || 0) + 1;
        }
      }

      const resourcesByCard: Record<string, Array<{ hoursPerWeek: string; taskId: string }>> = {};
      for (const r of allResources) {
        if (!resourcesByCard[r.rateCardId]) resourcesByCard[r.rateCardId] = [];
        resourcesByCard[r.rateCardId].push({ hoursPerWeek: r.hoursPerWeek, taskId: r.taskId });
      }

      const created: any[] = [];
      const FTE_HOURS = 40;

      for (const [rateCardId, resources] of Object.entries(resourcesByCard)) {
        const rc = rateCardMap.get(rateCardId);
        if (!rc) continue;

        const intervals: Array<{ start: number; end: number; hpw: number }> = [];
        for (const r of resources) {
          const ws = taskMap.get(r.taskId);
          if (!ws) continue;
          const startStr = ws.startDate;
          const endStr = ws.endDate;
          const start = startStr ? new Date(startStr).getTime() : 0;
          const durationWeeks = parseFloat(ws.durationWeeks || "0") || 0;
          const end = endStr ? new Date(endStr).getTime() : (start + durationWeeks * 7 * 24 * 60 * 60 * 1000);
          intervals.push({ start, end, hpw: parseFloat(r.hoursPerWeek || "0") || 0 });
        }

        let requiredFTEs = 1;
        if (intervals.length > 0) {
          const events: Array<{ time: number; hpw: number }> = [];
          for (const iv of intervals) {
            events.push({ time: iv.start, hpw: iv.hpw });
            events.push({ time: iv.end, hpw: -iv.hpw });
          }
          events.sort((a, b) => a.time - b.time || a.hpw - b.hpw);

          let currentHpw = 0;
          let peakHpw = 0;
          for (const ev of events) {
            currentHpw += ev.hpw;
            peakHpw = Math.max(peakHpw, currentHpw);
          }
          requiredFTEs = Math.max(1, Math.ceil(peakHpw / FTE_HOURS));
        }

        const existingCount = existingCountByCard[rateCardId] || 0;
        const toCreate = Math.max(0, requiredFTEs - existingCount);

        for (let i = 0; i < toCreate; i++) {
          const entry = await storage.createProjectTeamMember({
            tenantId: req.tenantId || "default",
            timelineId,
            teamMemberId: null,
            rateCardId,
            monthlyCost: rc.costRate || null,
            hourlyCost: rc.billRate || null,
            allocation: 100,
            startDate: null,
            endDate: null,
          });
          created.push(entry);
        }
      }

      res.json({ created: created.length, entries: created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/project-team/:id", async (req, res) => {
    try {
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      const updates: any = {};
      if (teamMemberId !== undefined) updates.teamMemberId = teamMemberId || null;
      if (rateCardId !== undefined) updates.rateCardId = rateCardId || null;
      if (monthlyCost !== undefined) updates.monthlyCost = monthlyCost;
      if (hourlyCost !== undefined) updates.hourlyCost = hourlyCost;
      if (allocation !== undefined) updates.allocation = allocation;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;

      const existing = await storage.getProjectTeamMemberById(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Assignment not found" });
      const finalTeamMemberId = updates.teamMemberId !== undefined ? updates.teamMemberId : existing.teamMemberId;
      const finalRateCardId = updates.rateCardId !== undefined ? updates.rateCardId : existing.rateCardId;
      const parentTimeline = await storage.getTimeline(existing.timelineId, req.tenantId || "default");
      if (parentTimeline && parentTimeline.recordType === "project" && !finalTeamMemberId) {
        return res.status(400).json({ message: "Team member is required for projects" });
      }
      if (!finalTeamMemberId && !finalRateCardId) {
        return res.status(400).json({ message: "Either a team member or a role (rate card) is required" });
      }

      const assignment = await storage.updateProjectTeamMember(req.params.id, req.tenantId || "default", updates);
      if (!assignment) return res.status(404).json({ message: "Assignment not found" });
      res.json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/project-team/:id", async (req, res) => {
    try {
      await storage.deleteProjectTeamMember(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET allocations for a timeline/project (with team member details)
  app.get("/api/timelines/:id/allocations", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const allocs = await storage.getAllocationsByTimeline(req.params.id, req.tenantId || "default");
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/allocations", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const allocs = await storage.getAllAllAllocations(req.tenantId);
      if (ctx.isGlobal) {
        return res.json(allocs);
      }
      const filtered = allocs.filter(a =>
        (ctx.teamMemberId && a.teamMemberId === ctx.teamMemberId) ||
        ctx.assignedTimelineIds.includes(a.timelineId)
      );
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET allocations for a team member
  app.get("/api/team-members/:id/allocations", async (req, res) => {
    try {
      const allocs = await storage.getAllocations(req.params.id, req.tenantId || "default");
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // CREATE allocation for a team member
  app.post("/api/team-members/:id/allocations", async (req, res) => {
    try {
      const data = {
        tenantId: req.tenantId || "default",
        teamMemberId: req.params.id,
        timelineId: req.body.timelineId,
        weeklyHours: req.body.weeklyHours || null,
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        status: req.body.status || "active",
        notes: req.body.notes || null,
      };
      if (!data.timelineId) {
        return res.status(400).json({ message: "timelineId is required" });
      }
      const allocation = await storage.createAllocation(data);
      await recalcTotalRunningCost(data.timelineId, req.tenantId || "default");
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE allocation
  app.patch("/api/allocations/:id", async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id, req.tenantId || "default");
      if (!existing) return res.status(404).json({ message: "Allocation not found" });

      const updates: any = {};
      if (req.body.timelineId !== undefined) updates.timelineId = req.body.timelineId;
      if (req.body.weeklyHours !== undefined) updates.weeklyHours = req.body.weeklyHours;
      if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
      if (req.body.endDate !== undefined) updates.endDate = req.body.endDate;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      const allocation = await storage.updateAllocation(req.params.id, req.tenantId || "default", updates);
      if (!allocation) return res.status(404).json({ message: "Allocation not found" });

      await recalcTotalRunningCost(allocation.timelineId, req.tenantId || "default");
      if (existing.timelineId !== allocation.timelineId) {
        await recalcTotalRunningCost(existing.timelineId, req.tenantId || "default");
      }
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE allocation
  app.delete("/api/allocations/:id", async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id, req.tenantId || "default");
      await storage.deleteAllocation(req.params.id, req.tenantId || "default");
      if (existing) {
        await recalcTotalRunningCost(existing.timelineId, req.tenantId || "default");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET app settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings(req.tenantId || "default");
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE app settings
  app.patch("/api/settings", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const updates: any = {};
      const fields = [
        "riskRegisterEnabled", "opportunitiesEnabled", "taskStatuses", "taskHealthOptions", "taskItemTypes",
        "riskProbabilities", "riskImpacts", "riskStatuses", "projectTypes",
        "engagementModels", "clients", "contactRoles", "industries", "projectStatuses",
        "teamMemberRoles", "regions", "dateFormats",
      ];
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
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

  app.get("/api/estimate-template", async (req, res) => {
    try {
      const allRateCards = await storage.getRateCards(req.tenantId);
      const templateData = [
        { Phase: "Discovery", Workstream: "Requirements Gathering", "Duration (Weeks)": 4, Confidence: "high", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Functional" },
        { Phase: "Discovery", Workstream: "Requirements Gathering", "Duration (Weeks)": 4, Confidence: "high", "Role / Rate Card": "Business Analyst", "Hours Per Week": 20, "Task Type": "Functional" },
        { Phase: "Build", Workstream: "Backend Development", "Duration (Weeks)": 8, Confidence: "medium", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Technical" },
        { Phase: "Build", Workstream: "Frontend Development", "Duration (Weeks)": 6, Confidence: "medium", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Technical" },
        { Phase: "Build", Workstream: "QA & Testing", "Duration (Weeks)": 4, Confidence: "low", "Role / Rate Card": "QA Engineer", "Hours Per Week": 30, "Task Type": "QA" },
        { Phase: "Deployment", Workstream: "Go-Live Support", "Duration (Weeks)": 2, Confidence: "medium", "Role / Rate Card": "Project Manager", "Hours Per Week": 20, "Task Type": "PM" },
      ];

      const rateCardRef = allRateCards.map(rc => ({
        Name: rc.name,
        Role: rc.role || "",
        Region: rc.region || "",
        "Cost Rate ($/hr)": rc.costRate || "",
        "Bill Rate ($/hr)": rc.billRate || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(templateData);
      ws1["!cols"] = [
        { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Estimate Template");

      const ws2 = XLSX.utils.json_to_sheet(rateCardRef.length > 0 ? rateCardRef : [{ Name: "(No rate cards configured yet)", Role: "", Region: "", "Cost Rate ($/hr)": "", "Bill Rate ($/hr)": "" }]);
      ws2["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Rate Cards (Reference)");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", 'attachment; filename="estimate-template.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/import-estimate", requirePermission("estimate.edit"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const timelineId = req.params.id;
      const timeline = await storage.getTimeline(timelineId, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return res.status(400).json({ message: "No data found in file" });

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) return res.status(400).json({ message: "Template is empty" });

      const allRateCards = await storage.getRateCards(req.tenantId);
      const rcByName = new Map<string, any>();
      for (const rc of allRateCards) {
        if (rc.name) rcByName.set(rc.name.toLowerCase().trim(), rc);
        if (rc.role) rcByName.set(rc.role.toLowerCase().trim(), rc);
      }

      const existingTasks = await storage.getTasksByTimeline(timelineId, req.tenantId || "default");
      const existingPhases = existingTasks.filter(t => t.itemType === "phase");
      const existingWorkstreams = existingTasks.filter(t => t.itemType === "workstream");

      const phaseMap = new Map<string, string>();
      for (const p of existingPhases) {
        phaseMap.set(p.title.toLowerCase().trim(), p.id);
      }

      const wsMap = new Map<string, string>();
      for (const ws of existingWorkstreams) {
        const key = `${ws.parentTaskId}::${ws.title.toLowerCase().trim()}`;
        wsMap.set(key, ws.id);
      }

      let phasesCreated = 0, workstreamsCreated = 0, resourcesCreated = 0, rowsSkipped = 0;
      let phaseSortOrder = existingPhases.length;

      const wsCountByPhase = new Map<string, number>();
      for (const ws of existingWorkstreams) {
        if (ws.parentTaskId) {
          wsCountByPhase.set(ws.parentTaskId, (wsCountByPhase.get(ws.parentTaskId) || 0) + 1);
        }
      }

      for (const row of rows) {
        const phaseName = String(row["Phase"] || "").trim();
        const wsName = String(row["Workstream"] || "").trim();
        const roleName = String(row["Role / Rate Card"] || "").trim();

        if (!phaseName || !wsName) { rowsSkipped++; continue; }

        let phaseId = phaseMap.get(phaseName.toLowerCase());
        if (!phaseId) {
          const phase = await storage.createTask({
            tenantId: req.tenantId || "default",
            timelineId,
            title: phaseName,
            itemType: "phase",
            sortOrder: phaseSortOrder++,
          });
          phaseId = phase.id;
          phaseMap.set(phaseName.toLowerCase(), phaseId);
          wsCountByPhase.set(phaseId, 0);
          phasesCreated++;
        }

        const wsKey = `${phaseId}::${wsName.toLowerCase()}`;
        let wsId = wsMap.get(wsKey);
        if (!wsId) {
          const duration = parseFloat(String(row["Duration (Weeks)"] || "0")) || null;
          const confidence = String(row["Confidence"] || "medium").toLowerCase().trim();
          const validConfidence = ["high", "medium", "low"].includes(confidence) ? confidence : "medium";
          const count = wsCountByPhase.get(phaseId) || 0;
          const ws = await storage.createTask({
            tenantId: req.tenantId || "default",
            timelineId,
            title: wsName,
            itemType: "workstream",
            parentTaskId: phaseId,
            sortOrder: count,
            durationWeeks: duration ? String(duration) : null,
            confidenceLevel: validConfidence,
          });
          wsId = ws.id;
          wsMap.set(wsKey, wsId);
          wsCountByPhase.set(phaseId, count + 1);
          workstreamsCreated++;
        }

        if (roleName) {
          const rc = rcByName.get(roleName.toLowerCase().trim());
          if (rc) {
            const hpw = parseFloat(String(row["Hours Per Week"] || "0")) || 0;
            const taskType = String(row["Task Type"] || "technical").toLowerCase().trim();
            const validTaskType = ["pm", "functional", "technical", "qa"].includes(taskType) ? taskType : "technical";
            if (hpw > 0) {
              await storage.createWorkstreamResource({
                tenantId: req.tenantId || "default",
                taskId: wsId,
                rateCardId: rc.id,
                hoursPerWeek: String(hpw),
                taskType: validTaskType,
                teamMemberId: null,
                notes: null,
              });
              resourcesCreated++;
            } else {
              rowsSkipped++;
            }
          } else {
            rowsSkipped++;
          }
        }
      }

      res.json({
        phasesCreated,
        workstreamsCreated,
        resourcesCreated,
        rowsSkipped,
        totalRows: rows.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PARSE Excel/CSV file
  app.post("/api/parse-excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Empty spreadsheet" });
      }

      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        return res.status(400).json({ message: "No data rows found" });
      }

      const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());

      const titleCol = headers.find((h) =>
        ["title", "name", "milestone", "stage", "event", "phase"].includes(h)
      );
      const dateCol = headers.find((h) =>
        ["date", "time", "when", "start", "start date", "start_date", "period"].includes(h)
      );
      const descCol = headers.find((h) =>
        ["description", "desc", "details", "notes", "note", "info"].includes(h)
      );

      if (!titleCol && !dateCol) {
        return res.status(400).json({
          message: "Could not find Title or Date columns. Expected column headers like: Title, Date, Description",
        });
      }

      const originalHeaders = Object.keys(rows[0]);
      const getOriginalHeader = (lowerKey: string | undefined) => {
        if (!lowerKey) return undefined;
        return originalHeaders.find((h) => h.toLowerCase().trim() === lowerKey);
      };

      const titleHeader = getOriginalHeader(titleCol);
      const dateHeader = getOriginalHeader(dateCol);
      const descHeader = getOriginalHeader(descCol);

      const parsedMilestones = rows
        .map((row) => ({
          title: titleHeader ? String(row[titleHeader] || "").trim() : "",
          date: dateHeader ? String(row[dateHeader] || "").trim() : "",
          description: descHeader ? String(row[descHeader] || "").trim() : "",
        }))
        .filter((m) => m.title || m.date);

      res.json({
        title: sheetName !== "Sheet1" ? sheetName : undefined,
        milestones: parsedMilestones,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to parse file: " + err.message });
    }
  });

  // ── FlightPath Stages ──
  app.get("/api/flightpath-stages", async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const stages = await storage.getFlightpathStages(tenantId);
      const sorted = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const result = [];
      for (const stage of sorted) {
        const deliverables = await storage.getStageDeliverables(stage.id, tenantId);
        result.push({ ...stage, deliverables: deliverables.sort((a, b) => a.sortOrder - b.sortOrder) });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages", async (req, res) => {
    try {
      const stage = await storage.createFlightpathStage({ ...req.body, tenantId: req.tenantId || "default" });
      res.status(201).json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-stages/:id", async (req, res) => {
    try {
      const stage = await storage.updateFlightpathStage(req.params.id, req.tenantId || "default", req.body);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-stages/:id", async (req, res) => {
    try {
      await storage.deleteFlightpathStage(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FlightPath Deliverables ──
  app.get("/api/flightpath-stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getStageDeliverables(req.params.stageId, req.tenantId || "default");
      res.json(deliverables.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverable = await storage.createDeliverable({ ...req.body, stageId: req.params.stageId, tenantId: req.tenantId || "default" });
      res.status(201).json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-deliverables/:id", async (req, res) => {
    try {
      const deliverable = await storage.updateDeliverable(req.params.id, req.tenantId || "default", req.body);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      res.json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-deliverables/:id", async (req, res) => {
    try {
      await storage.deleteDeliverable(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Governance Model API Aliases (canonical endpoints, same handlers) ──
  app.get("/api/governance-model/stages", async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const stages = await storage.getFlightpathStages(tenantId);
      const sorted = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const result = [];
      for (const stage of sorted) {
        const deliverables = await storage.getStageDeliverables(stage.id, tenantId);
        result.push({ ...stage, deliverables: deliverables.sort((a, b) => a.sortOrder - b.sortOrder) });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/governance-model/stages", async (req, res) => {
    try {
      const stage = await storage.createFlightpathStage({ ...req.body, tenantId: req.tenantId || "default" });
      res.status(201).json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.patch("/api/governance-model/stages/:id", async (req, res) => {
    try {
      const stage = await storage.updateFlightpathStage(req.params.id, req.tenantId || "default", req.body);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/governance-model/stages/:id", async (req, res) => {
    try {
      await storage.deleteFlightpathStage(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.get("/api/governance-model/stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getStageDeliverables(req.params.stageId, req.tenantId || "default");
      res.json(deliverables.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/governance-model/stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverable = await storage.createDeliverable({ ...req.body, stageId: req.params.stageId, tenantId: req.tenantId || "default" });
      res.status(201).json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.patch("/api/governance-model/deliverables/:id", async (req, res) => {
    try {
      const deliverable = await storage.updateDeliverable(req.params.id, req.tenantId || "default", req.body);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      res.json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/governance-model/deliverables/:id", async (req, res) => {
    try {
      await storage.deleteDeliverable(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Project Checkpoints ──
  app.get("/api/timelines/:id/checkpoints", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const stageId = req.query.stageId as string | undefined;
      const checkpoints = stageId
        ? await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default")
        : await storage.getProjectCheckpoints(req.params.id, req.tenantId || "default");
      res.json(checkpoints);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/checkpoints", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const checkpoint = await storage.createProjectCheckpoint({ ...req.body, timelineId: req.params.id, tenantId: req.tenantId || "default" });
      res.status(201).json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/checkpoints/:id", async (req, res) => {
    try {
      const data = { ...req.body };
      if (typeof data.completedAt === "string") {
        data.completedAt = new Date(data.completedAt);
      }
      if (typeof data.artifactVerifiedAt === "string") {
        data.artifactVerifiedAt = new Date(data.artifactVerifiedAt);
      }
      const checkpoint = await storage.updateProjectCheckpoint(req.params.id, req.tenantId || "default", data);
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });
      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/checkpoints/:id", async (req, res) => {
    try {
      await storage.deleteProjectCheckpoint(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Project Gates ──
  app.get("/api/timelines/:id/gates", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
      res.json(gates);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/gates", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const gate = await storage.createProjectGate({ ...req.body, timelineId: req.params.id, tenantId: req.tenantId || "default" });
      res.status(201).json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/gates/:id", requirePermission("gate.approve"), async (req, res) => {
    try {
      const gate = await storage.updateProjectGate(req.params.id, req.tenantId || "default", req.body);
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      res.json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/request-exception", requirePermission("gate.submit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId, notes } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });
      if (!notes || !notes.trim()) return res.status(400).json({ message: "Justification notes are required" });
      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      if (!allStages.some(s => s.id === stageId)) return res.status(400).json({ message: "Invalid stageId for this governance model" });
      let gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) {
        gate = await storage.createProjectGate({ timelineId: req.params.id, stageId, status: "exception_requested", notes: notes.trim(), tenantId: req.tenantId || "default" });
      } else {
        gate = await storage.updateProjectGate(gate.id, req.tenantId || "default", { status: "exception_requested", notes: notes.trim() }) || gate;
      }
      res.json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/approve-exception", requirePermission("gate.approve"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId, approved, notes } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });
      if (typeof approved !== "boolean") return res.status(400).json({ message: "approved (boolean) is required" });
      const gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      if (gate.status !== "exception_requested") return res.status(400).json({ message: "Gate is not in exception_requested status" });
      const updatedGate = await storage.updateProjectGate(gate.id, req.tenantId || "default", {
        status: approved ? "exception" : "failed",
        notes: notes ? `${gate.notes || ""}\n---\nReviewer: ${approved ? "Approved" : "Rejected"}${notes ? ` — ${notes}` : ""}`.trim() : gate.notes,
      });
      res.json(updatedGate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Stage initialization: auto-create checkpoints from deliverables ──
  app.post("/api/timelines/:id/initialize-stage", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const existing = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      if (existing.length > 0) {
        return res.json({ message: "Stage already initialized", checkpoints: existing });
      }

      const deliverables = await storage.getStageDeliverables(stageId, req.tenantId || "default");
      const checkpoints = [];
      for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const cp = await storage.createProjectCheckpoint({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          stageId,
          deliverableId: d.id,
          checkpointName: d.name,
          completed: false,
        });
        checkpoints.push(cp);
      }

      res.status(201).json({ message: "Stage initialized", checkpoints });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Advance Stage (gate-enforced) ──
  app.post("/api/timelines/:id/advance-stage", requirePermission("gate.submit"), async (req, res) => {
    try {
      const { nextStageId } = req.body;
      if (!nextStageId) return res.status(400).json({ message: "nextStageId is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = allStages.sort((a, b) => a.stageNumber - b.stageNumber);
      const nextStage = sortedStages.find(s => s.id === nextStageId);
      if (!nextStage) return res.status(400).json({ message: "Invalid stage" });

      if (!timeline.flightpathStageId) {
        if (nextStage.stageNumber !== sortedStages[0]?.stageNumber) {
          return res.status(400).json({ message: "Must start at the first stage" });
        }
      } else {
        const currentStage = sortedStages.find(s => s.id === timeline.flightpathStageId);
        if (!currentStage) return res.status(400).json({ message: "Current stage not found" });

        if (nextStage.stageNumber !== currentStage.stageNumber + 1) {
          return res.status(400).json({ message: "Can only advance to the next sequential stage" });
        }

        const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
        const currentGate = gates.find(g => g.stageId === timeline.flightpathStageId);
        if (!currentGate || (currentGate.status !== "passed" && currentGate.status !== "exception")) {
          return res.status(400).json({ message: "Gate for the current stage must be passed or have an approved exception before advancing" });
        }
      }

      const updated = await storage.updateTimeline(req.params.id, req.tenantId || "default", { flightpathStageId: nextStageId });

      try {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 0 : 7 - day;
        const weekEndDate = new Date(now);
        weekEndDate.setDate(weekEndDate.getDate() + diff);
        const weekEnding = weekEndDate.toISOString().slice(0, 10);

        const currentStage = sortedStages.find(s => s.id === timeline.flightpathStageId);
        const stageName = currentStage ? `Stage ${currentStage.stageNumber}` : "Stage";

        const evmResult = await calculateEVMForWeek(req.params.id, weekEnding, req.tenantId || "default");
        await storage.createEvmSnapshot({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          weekEnding,
          mode: "gate_freeze",
          bac: String(evmResult.bac),
          plannedValue: String(evmResult.plannedValue),
          actualCost: String(evmResult.actualCost),
          earnedValue: String(evmResult.earnedValue),
          scheduleVariance: String(evmResult.scheduleVariance),
          costVariance: String(evmResult.costVariance),
          spiValue: String(evmResult.spiValue),
          cpiValue: String(evmResult.cpiValue),
          eacValue: String(evmResult.eacValue),
          etcValue: String(evmResult.etcValue),
          vacValue: String(evmResult.vacValue),
          weeklyPv: String(evmResult.weeklyPv),
          weeklyAc: String(evmResult.weeklyAc),
          weeklyEv: String(evmResult.weeklyEv),
          workstreamBreakdown: evmResult.workstreamBreakdown,
          inputsHash: evmResult.inputsHash,
          notes: `Auto-generated on ${stageName} gate approval`,
          generatedBy: (req as any).user?.id || null,
          generatedAt: new Date(),
        });

        await storage.createAuditEntry({
          tenantId: req.tenantId || "default",
          actorUserId: (req as any).user?.id || "system",
          action: "evm.snapshot_generated",
          objectType: "project",
          objectId: req.params.id,
          metadata: { weekEnding, mode: "gate_freeze", stageName },
        });
      } catch (evmErr: any) {
        console.error("Gate auto-freeze EVM snapshot failed (non-blocking):", evmErr.message);
      }

      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Gate Evaluator ──
  app.post("/api/timelines/:id/evaluate-gate", requirePermission("gate.submit"), async (req, res) => {
    try {
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const stage = await storage.getFlightpathStage(stageId, req.tenantId || "default");
      if (!stage) return res.status(404).json({ message: "Stage not found" });

      const allCheckpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      const optionalCount = allCheckpoints.filter(c => c.optional).length;
      const checkpoints = allCheckpoints.filter(c => !c.optional);
      const totalCheckpoints = checkpoints.length;
      const completedCheckpoints = checkpoints.filter(c => c.completed).length;
      const missingItems = checkpoints.filter(c => !c.completed).map(c => c.checkpointName);

      const raidItems = await storage.getRisks(req.params.id, req.tenantId || "default");
      const stageRaidItems = raidItems.filter(r => r.relatedStageId === stageId || !r.relatedStageId);
      const openRisks = stageRaidItems.filter(r => r.itemType === "risk" && r.status === "open");
      const openIssues = stageRaidItems.filter(r => r.itemType === "issue" && r.status === "open");
      const unresolvedDeps = stageRaidItems.filter(r => r.itemType === "dependency" && r.status === "open");
      const unvalidatedAssumptions = stageRaidItems.filter(r => r.itemType === "assumption" && r.status === "open" && !r.validatedDate);

      const raidFlags: string[] = [];
      if (openRisks.length > 0) raidFlags.push(`${openRisks.length} open risk(s) require attention`);
      if (openIssues.length > 0) raidFlags.push(`${openIssues.length} open issue(s) need resolution`);
      if (unresolvedDeps.length > 0) raidFlags.push(`${unresolvedDeps.length} unresolved dependency(ies)`);
      if (unvalidatedAssumptions.length > 0) raidFlags.push(`${unvalidatedAssumptions.length} unvalidated assumption(s)`);

      const evmFlags: string[] = [];
      if (stage.stageNumber >= 2) {
        try {
          const allAllocations = await storage.getAllocationsByTimeline(req.params.id, req.tenantId || "default");
          const tsEntries = await storage.getTimesheetEntries(req.tenantId || "default", { timelineId: req.params.id });
          if (allAllocations.length > 0 && tsEntries.length > 0) {
            evmFlags.push("EVM data available — review SPI/CPI indicators in the EVM tab");
          }
        } catch {}
      }

      const completionPercentage = totalCheckpoints > 0 ? Math.round((completedCheckpoints / totalCheckpoints) * 100) : 0;

      const artifactFlags: string[] = [];
      const checkpointsWithArtifacts = checkpoints.filter(c => c.artifactFileName);
      const verifiedArtifacts = checkpoints.filter(c => c.artifactVerified);
      const checkpointsWithoutArtifacts = checkpoints.filter(c => !c.artifactFileName);

      if (checkpoints.length > 0) {
        artifactFlags.push(`${checkpointsWithArtifacts.length} of ${checkpoints.length} deliverables have linked artifacts`);
        artifactFlags.push(`${verifiedArtifacts.length} of ${checkpointsWithArtifacts.length} linked artifacts verified by AI`);
      }
      for (const cp of checkpointsWithoutArtifacts) {
        artifactFlags.push(`"${cp.checkpointName}": no artifact linked`);
      }
      for (const cp of checkpointsWithArtifacts.filter(c => !c.artifactVerified)) {
        artifactFlags.push(`"${cp.checkpointName}": artifact linked (${cp.artifactFileName}) but not verified`);
      }
      for (const cp of verifiedArtifacts) {
        if (cp.artifactSummary) {
          artifactFlags.push(`"${cp.checkpointName}": verified — ${cp.artifactSummary.substring(0, 200)}`);
        }
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const evalPrompt = `You are a project governance evaluator. Assess whether this project stage gate should pass or fail based on three dimensions: checkpoint completion, artifact presence/quality, and RAID status.

Stage: ${stage.name} (Stage ${stage.stageNumber})
Gate: ${stage.gateName}
Gate Criteria: ${stage.gateDescription}

## Dimension 1: Checkpoint Completion
Status: ${completedCheckpoints}/${totalCheckpoints} required deliverables complete (${completionPercentage}%)${optionalCount > 0 ? `\n(${optionalCount} deliverable(s) marked optional and excluded from assessment)` : ""}
Missing Items: ${missingItems.length > 0 ? missingItems.join(", ") : "None"}

## Dimension 2: Artifact Coverage
${artifactFlags.length > 0 ? artifactFlags.join("\n") : "No artifact data available"}

## Dimension 3: RAID Status
- Open Risks: ${openRisks.length}${openRisks.length > 0 ? ` (${openRisks.map(r => r.title).join(", ")})` : ""}
- Open Issues: ${openIssues.length}${openIssues.length > 0 ? ` (${openIssues.map(r => r.title).join(", ")})` : ""}
- Unresolved Dependencies: ${unresolvedDeps.length}${unresolvedDeps.length > 0 ? ` (${unresolvedDeps.map(r => r.title).join(", ")})` : ""}
- Unvalidated Assumptions: ${unvalidatedAssumptions.length}${unvalidatedAssumptions.length > 0 ? ` (${unvalidatedAssumptions.map(r => r.title).join(", ")})` : ""}

${evmFlags.length > 0 ? `## EVM Notes\n${evmFlags.join("; ")}` : ""}

Consider all three dimensions. A gate should fail if:
- Key deliverables are incomplete
- Critical deliverables lack linked artifacts (documents not uploaded to the repository)
- Linked artifacts have not been verified or raise quality concerns
- Significant RAID items remain unresolved

Respond ONLY with valid JSON in this exact format:
{
  "status": "pass" or "fail",
  "completionPercentage": <number>,
  "missingItems": [<list of incomplete checkpoint names>],
  "artifactFlags": [<list of artifact concerns — missing docs, unverified artifacts, quality issues>],
  "raidFlags": [<list of RAID concerns>],
  "evmFlags": [<list of EVM observations>],
  "recommendations": [<list of specific recommended actions>]
}`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: evalPrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      let evaluatorResult;
      try {
        evaluatorResult = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");
      } catch {
        evaluatorResult = {
          status: completionPercentage >= 100 && raidFlags.length === 0 ? "pass" : "fail",
          completionPercentage,
          missingItems,
          artifactFlags,
          raidFlags,
          evmFlags,
          recommendations: ["AI evaluation parsing failed — review manually"],
        };
      }

      let gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) {
        gate = await storage.createProjectGate({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          stageId,
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
        });
      } else {
        gate = await storage.updateProjectGate(gate.id, req.tenantId || "default", {
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
          approvedAt: evaluatorResult.status === "pass" ? new Date() : null,
        });
      }

      res.json({ gate, evaluatorResult });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Document Repository / Artifact Routes ──

  app.get("/api/timelines/:id/artifacts", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      if (!timeline.docRepositoryType || !timeline.docRepositoryFolderId) {
        return res.status(400).json({ message: "No document repository configured for this project" });
      }

      if (timeline.docRepositoryType === "google_drive") {
        const files = await listFilesInFolder(timeline.docRepositoryFolderId);
        return res.json(files);
      }

      return res.status(400).json({ message: `Unsupported repository type: ${timeline.docRepositoryType}` });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/link-artifact", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { checkpointId, fileId, fileName, fileUrl } = req.body;
      if (!checkpointId || !fileName) {
        return res.status(400).json({ message: "checkpointId and fileName are required" });
      }

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, req.tenantId || "default", {
        artifactUrl: fileUrl || null,
        artifactFileId: fileId || null,
        artifactFileName: fileName,
        artifactVerified: false,
        artifactVerifiedAt: null,
        artifactSummary: null,
      });
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/timelines/:id/unlink-artifact", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { checkpointId } = req.body;
      if (!checkpointId) return res.status(400).json({ message: "checkpointId is required" });

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, req.tenantId || "default", {
        artifactUrl: null,
        artifactFileId: null,
        artifactFileName: null,
        artifactVerified: false,
        artifactVerifiedAt: null,
        artifactSummary: null,
      });
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/verify-artifacts", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const checkpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      const checkpointsWithArtifacts = checkpoints.filter(c => c.artifactFileId || c.artifactUrl || c.artifactFileName);

      if (checkpointsWithArtifacts.length === 0) {
        return res.json({ verified: 0, total: checkpoints.length, results: [] });
      }

      const stage = await storage.getFlightpathStage(stageId, req.tenantId || "default");
      const deliverables = await storage.getStageDeliverables(stageId, req.tenantId || "default");

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const results: Array<{ checkpointId: string; checkpointName: string; verified: boolean; summary: string }> = [];

      for (const cp of checkpointsWithArtifacts) {
        let fileContent: string | null = null;
        let fileMetadata: any = null;

        if (timeline.docRepositoryType === "google_drive") {
          const fId = cp.artifactFileId || null;
          if (fId) {
            try {
              fileMetadata = await getFileMetadata(fId);
              fileContent = await getFileContent(fId, fileMetadata.mimeType);
            } catch (e) {
              console.error(`Failed to read file for checkpoint ${cp.id}:`, e);
            }
          }
        }

        const deliverable = deliverables.find(d => d.id === cp.deliverableId);

        const verifyPrompt = `You are a governance artifact reviewer. Evaluate whether this document satisfies the deliverable requirement.

Deliverable: ${cp.checkpointName}
${deliverable?.description ? `Description: ${deliverable.description}` : ""}
Stage: ${stage?.name || "Unknown"} (Stage ${stage?.stageNumber ?? "?"})

Artifact File: ${cp.artifactFileName || "Unknown"}
${fileMetadata ? `File Type: ${fileMetadata.mimeType}` : ""}
${fileMetadata ? `Last Modified: ${fileMetadata.modifiedTime}` : ""}
${fileContent ? `\nFile Content (excerpt):\n${fileContent.substring(0, 5000)}` : "\n(File content not accessible — evaluate based on file name and metadata only)"}

Assess:
1. Does the file name and type seem appropriate for this deliverable?
2. If content is available, does it adequately cover the deliverable requirements?
3. Provide a brief summary of what the artifact contains or appears to contain.

Respond ONLY with valid JSON:
{
  "verified": true or false,
  "summary": "Brief assessment of the artifact (2-3 sentences)",
  "concerns": ["any specific concerns or gaps"] 
}`;

        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [{ role: "user", content: verifyPrompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          });

          let result;
          try {
            result = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");
          } catch {
            result = { verified: false, summary: "AI verification parsing failed", concerns: [] };
          }

          const summary = result.summary + (result.concerns?.length > 0 ? `\nConcerns: ${result.concerns.join("; ")}` : "");

          await storage.updateProjectCheckpoint(cp.id, req.tenantId || "default", {
            artifactVerified: result.verified === true,
            artifactVerifiedAt: new Date(),
            artifactSummary: summary,
          });

          results.push({
            checkpointId: cp.id,
            checkpointName: cp.checkpointName,
            verified: result.verified === true,
            summary,
          });
        } catch (e: any) {
          results.push({
            checkpointId: cp.id,
            checkpointName: cp.checkpointName,
            verified: false,
            summary: `Verification failed: ${e.message}`,
          });
        }
      }

      res.json({
        verified: results.filter(r => r.verified).length,
        total: checkpoints.length,
        withArtifacts: checkpointsWithArtifacts.length,
        results,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Coach Chat API ──
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array is required" });
      }

      const stages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const tenantSettings = await storage.getSettings(req.tenantId || "default");
      const tenantLocale = tenantSettings?.locale || "en";
      const { getGovernanceLabel } = await import("@shared/terminology");
      const govLabel = getGovernanceLabel(tenantSettings?.governanceModelLabel, tenantLocale as "en" | "es" | "pt");
      const localeInstruction = tenantLocale !== "en" ? `\nIMPORTANT: Respond in ${tenantLocale === "es" ? "Spanish" : "Portuguese"}. The tenant's language is set to ${tenantLocale}.\n` : "";
      let frameworkContext = `You are the ${govLabel} Governance Coach — an AI assistant that helps project managers navigate the ${govLabel} governance framework.\n${localeInstruction}\n`;
      frameworkContext += `IMPORTANT: In all user-facing responses, refer to the governance lifecycle as "${govLabel}". Do not use the term "FlightPath".\n\n`;
      frameworkContext += `## ${govLabel} Framework Overview\n`;
      frameworkContext += `The ${govLabel} is a 5-stage project governance framework (Stage 0 through Stage 4) that guides projects from initial value framing through to value realization and evolution.\n\n`;

      for (const stage of sortedStages) {
        const deliverables = await storage.getStageDeliverables(stage.id, req.tenantId || "default");
        frameworkContext += `### Stage ${stage.stageNumber}: ${stage.name}\n`;
        frameworkContext += `- **Goal**: ${stage.goal}\n`;
        if (stage.description) frameworkContext += `- **Description**: ${stage.description}\n`;
        frameworkContext += `- **Gate**: ${stage.gateName}\n`;
        if (stage.gateDescription) frameworkContext += `- **Gate Criteria**: ${stage.gateDescription}\n`;
        if (stage.playbookPurpose) frameworkContext += `- **Playbook Purpose**: ${stage.playbookPurpose}\n`;
        if (stage.playbookExitBundle) frameworkContext += `- **Exit Bundle**: ${stage.playbookExitBundle}\n`;

        if (deliverables.length > 0) {
          frameworkContext += `- **Deliverables** (${deliverables.length}):\n`;
          for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
            frameworkContext += `  - ${d.name}`;
            if (d.description) frameworkContext += `: ${d.description}`;
            if (d.raciData && Object.keys(d.raciData).length > 0) {
              const raciStr = Object.entries(d.raciData).map(([role, resp]) => `${role}=${resp}`).join(", ");
              frameworkContext += ` [RACI: ${raciStr}]`;
            }
            frameworkContext += "\n";
          }
        }
        frameworkContext += "\n";
      }

      frameworkContext += `## Your Role
- Answer questions about the ${govLabel} framework, stages, gates, deliverables, and RACI responsibilities
- Guide PMs through their current stage and explain what's needed
- Recommend next actions and warn about common failure modes
- Explain gate criteria and what it takes to pass each gate
- Help PMs understand RACI roles and accountability
- Be specific, actionable, and reference actual framework deliverables and stages
- Keep responses focused and practical — you're a governance coach, not a general assistant
- Always refer to the governance framework as "${govLabel}" — never use the term "FlightPath" in your responses`;

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: frameworkContext },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_completion_tokens: 8192,
      });

      const reply = response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      res.json({ response: reply });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Workstream Resources CRUD ──

  app.get("/api/tasks/:taskId/resources", async (req, res) => {
    try {
      const resources = await storage.getWorkstreamResources(req.params.taskId, req.tenantId || "default");
      res.json(resources);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/tasks/:taskId/resources", requirePermission("estimate.edit"), async (req, res) => {
    try {
      const { rateCardId, teamMemberId, hoursPerWeek, taskType, notes } = req.body;
      if (!rateCardId) return res.status(400).json({ message: "Rate card is required" });
      if (!hoursPerWeek && hoursPerWeek !== 0) return res.status(400).json({ message: "Hours per week is required" });
      const resource = await storage.createWorkstreamResource({
        tenantId: req.tenantId || "default",
        taskId: req.params.taskId,
        rateCardId,
        teamMemberId: teamMemberId || null,
        hoursPerWeek: String(hoursPerWeek),
        taskType: taskType || null,
        notes: notes || null,
      });
      res.status(201).json(resource);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/workstream-resources/:id", requirePermission("estimate.edit"), async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.rateCardId !== undefined) updates.rateCardId = req.body.rateCardId;
      if (req.body.teamMemberId !== undefined) updates.teamMemberId = req.body.teamMemberId;
      if (req.body.hoursPerWeek !== undefined) updates.hoursPerWeek = String(req.body.hoursPerWeek);
      if (req.body.taskType !== undefined) updates.taskType = req.body.taskType;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      const resource = await storage.updateWorkstreamResource(req.params.id, req.tenantId || "default", updates);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/workstream-resources/:id", requirePermission("estimate.edit"), async (req, res) => {
    try {
      await storage.deleteWorkstreamResource(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:timelineId/workstream-resources", async (req, res) => {
    try {
      const resources = await storage.getWorkstreamResourcesByTimeline(req.params.timelineId, req.tenantId || "default");
      res.json(resources);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Opportunities CRUD ──

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

  // ── Convert Opportunity to Project ──
  app.post("/api/opportunities/:id/convert", async (req, res) => {
    try {
      const opp = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });
      if (opp.recordType !== "opportunity") return res.status(400).json({ message: "Not an opportunity" });
      if (opp.opportunityStatus !== "won") return res.status(400).json({ message: "Opportunity must have status 'won' before converting to a project" });

      if (opp.convertedAt) {
        return res.status(400).json({ message: "This opportunity has already been converted to a project" });
      }
      const existingProject = await storage.getTimelinesBySource(opp.id, req.tenantId || "default");
      if (existingProject) {
        return res.status(400).json({ message: "A project already exists for this opportunity" });
      }

      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = allStages.sort((a, b) => a.stageNumber - b.stageNumber);
      const stage0 = sortedStages.find(s => s.stageNumber === 0);
      const stage1 = sortedStages.find(s => s.stageNumber === 1);

      if (stage0 && opp.flightpathStageId === stage0.id) {
        const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
        const stage0Gate = gates.find(g => g.stageId === stage0.id);
        if (!stage0Gate || (stage0Gate.status !== "passed" && stage0Gate.status !== "exception")) {
          return res.status(400).json({ message: "Stage 0 gate must be passed or have an approved exception before converting to a project" });
        }
      }

      const project = await storage.createTimeline({
        tenantId: req.tenantId || "default",
        title: opp.title,
        description: opp.description,
        color: opp.color,
        clientId: opp.clientId,
        region: opp.region,
        dateFormat: opp.dateFormat,
        engagementModel: opp.engagementModel,
        projectType: opp.projectType,
        approvedBudget: opp.approvedBudget,
        estimatedRevenue: opp.estimatedRevenue,
        grossMargin: opp.grossMargin,
        riskFactorPercent: opp.riskFactorPercent,
        bufferPercent: opp.bufferPercent,
        startDate: opp.startDate,
        endDate: opp.endDate,
        currency: opp.currency,
        docRepositoryType: opp.docRepositoryType,
        docRepositoryUrl: opp.docRepositoryUrl,
        docRepositoryFolderId: opp.docRepositoryFolderId,
        recordType: "project",
        projectStatus: "not_started",
        sourceOpportunityId: opp.id,
        flightpathStageId: stage1?.id || null,
      });

      const oppTasks = opp.tasks || [];
      const taskIdMap = new Map<string, string>();

      const phases = oppTasks.filter(t => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
      for (const phase of phases) {
        const newPhase = await storage.createTask({
          tenantId: req.tenantId || "default",
          timelineId: project.id,
          title: phase.title,
          description: phase.description,
          startDate: phase.startDate,
          endDate: phase.endDate,
          color: phase.color,
          sortOrder: phase.sortOrder,
          status: "not_started",
          health: "green",
          itemType: "phase",
          estimatedHours: phase.estimatedHours,
          confidenceLevel: phase.confidenceLevel,
          taskType: phase.taskType,
          assignedRoleId: phase.assignedRoleId,
          durationWeeks: phase.durationWeeks,
        });
        taskIdMap.set(phase.id, newPhase.id);
      }

      const workstreams = oppTasks.filter(t => t.itemType === "workstream").sort((a, b) => a.sortOrder - b.sortOrder);
      for (const ws of workstreams) {
        const newParentId = ws.parentTaskId ? taskIdMap.get(ws.parentTaskId) || null : null;
        const newWs = await storage.createTask({
          tenantId: req.tenantId || "default",
          timelineId: project.id,
          title: ws.title,
          description: ws.description,
          startDate: ws.startDate,
          endDate: ws.endDate,
          color: ws.color,
          sortOrder: ws.sortOrder,
          status: "not_started",
          health: "green",
          itemType: "workstream",
          parentTaskId: newParentId,
          estimatedHours: ws.estimatedHours,
          confidenceLevel: ws.confidenceLevel,
          taskType: ws.taskType,
          assignedRoleId: ws.assignedRoleId,
          durationWeeks: ws.durationWeeks,
        });
        taskIdMap.set(ws.id, newWs.id);
      }

      let resourcesCopied = 0;
      const taskIdEntries = Array.from(taskIdMap.entries());
      for (const [oldTaskId, newTaskId] of taskIdEntries) {
        const resources = await storage.getWorkstreamResources(oldTaskId, req.tenantId || "default");
        for (const resource of resources) {
          await storage.createWorkstreamResource({
            tenantId: req.tenantId || "default",
            taskId: newTaskId,
            rateCardId: resource.rateCardId,
            teamMemberId: resource.teamMemberId,
            hoursPerWeek: resource.hoursPerWeek,
            taskType: resource.taskType,
            notes: resource.notes,
          });
          resourcesCopied++;
        }
      }

      const oppTeamMembers = await storage.getProjectTeamMembers(opp.id, req.tenantId || "default");
      for (const ptm of oppTeamMembers) {
        await storage.createProjectTeamMember({
          tenantId: req.tenantId || "default",
          timelineId: project.id,
          teamMemberId: ptm.teamMemberId,
          rateCardId: ptm.rateCardId,
          monthlyCost: ptm.monthlyCost,
          hourlyCost: ptm.hourlyCost,
          allocation: ptm.allocation,
          startDate: ptm.startDate,
          endDate: ptm.endDate,
        });
      }

      const oppAllocations = await storage.getAllocationsByTimeline(opp.id, req.tenantId || "default");
      for (const alloc of oppAllocations) {
        await storage.createAllocation({
          tenantId: req.tenantId || "default",
          teamMemberId: alloc.teamMemberId,
          timelineId: project.id,
          weeklyHours: alloc.weeklyHours,
          startDate: alloc.startDate,
          endDate: alloc.endDate,
          status: alloc.status,
          notes: alloc.notes,
        });
      }

      const oppRisks = await storage.getRisks(opp.id, req.tenantId || "default");
      for (const risk of oppRisks) {
        await storage.createRisk({
          tenantId: req.tenantId || "default",
          timelineId: project.id,
          title: risk.title,
          description: risk.description,
          category: risk.category,
          owner: risk.owner,
          probability: risk.probability,
          impact: risk.impact,
          mitigation: risk.mitigation,
          contingency: risk.contingency,
          status: risk.status,
          dueDate: risk.dueDate,
          itemType: risk.itemType,
          raisedDate: risk.raisedDate,
          dependencySource: risk.dependencySource,
          requiredByDate: risk.requiredByDate,
          validationCriteria: risk.validationCriteria,
        });
      }

      let milestonesCopied = 0;
      const oppMilestones = opp.milestones || [];
      for (const m of oppMilestones) {
        await storage.createMilestone({
          tenantId: req.tenantId || "default",
          timelineId: project.id,
          title: m.title,
          description: m.description,
          date: m.date,
          actualDate: m.actualDate,
          color: m.color,
          icon: m.icon,
          sortOrder: m.sortOrder,
          isFinancialObligation: m.isFinancialObligation,
          amount: m.amount,
        });
        milestonesCopied++;
      }

      if (stage1) {
        const deliverables = await storage.getStageDeliverables(stage1.id, req.tenantId || "default");
        for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
          await storage.createProjectCheckpoint({
            tenantId: req.tenantId || "default",
            timelineId: project.id,
            stageId: stage1.id,
            deliverableId: d.id,
            checkpointName: d.name,
            completed: false,
          });
        }
      }

      await storage.updateTimeline(opp.id, req.tenantId || "default", {
        opportunityStatus: "won",
        convertedAt: new Date(),
      });

      const fullProject = await storage.getTimeline(project.id, req.tenantId || "default");
      res.status(201).json({
        project: fullProject,
        summary: {
          tasksCreated: taskIdMap.size,
          resourcesCopied,
          teamMembersCopied: oppTeamMembers.length,
          allocationsCopied: oppAllocations.length,
          raidItemsCopied: oppRisks.length,
          milestonesCopied,
          governanceStage: stage1 ? `Stage 1: ${stage1.name}` : "None",
        },
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── RBAC API Routes ──

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

      const tm = await storage.getTeamMemberByUserId(req.params.userId as string);
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
      await storage.linkTeamMemberToUser(teamMemberId, req.params.userId as string);
      invalidatePermissionCache(req.params.userId as string);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/rbac/users/:userId/unlink-team-member", requireModuleAccess("admin"), requirePermission("users.manage"), async (req, res) => {
    try {
      const tm = await storage.getTeamMemberByUserId(req.params.userId as string);
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

  // ── EVM Snapshots ──
  app.post("/api/timelines/:id/freeze-week", requirePermission("project.edit"), async (req, res) => {
    try {
      const { weekEnding, notes } = req.body;
      if (!weekEnding) return res.status(400).json({ message: "weekEnding is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const evmResult = await calculateEVMForWeek(req.params.id, weekEnding, req.tenantId || "default");

      const snapshot = await storage.createEvmSnapshot({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        weekEnding,
        mode: "manual_freeze",
        bac: String(evmResult.bac),
        plannedValue: String(evmResult.plannedValue),
        actualCost: String(evmResult.actualCost),
        earnedValue: String(evmResult.earnedValue),
        scheduleVariance: String(evmResult.scheduleVariance),
        costVariance: String(evmResult.costVariance),
        spiValue: String(evmResult.spiValue),
        cpiValue: String(evmResult.cpiValue),
        eacValue: String(evmResult.eacValue),
        etcValue: String(evmResult.etcValue),
        vacValue: String(evmResult.vacValue),
        weeklyPv: String(evmResult.weeklyPv),
        weeklyAc: String(evmResult.weeklyAc),
        weeklyEv: String(evmResult.weeklyEv),
        workstreamBreakdown: evmResult.workstreamBreakdown,
        inputsHash: evmResult.inputsHash,
        notes: notes || null,
        generatedBy: (req as any).user?.id || null,
        generatedAt: new Date(),
      });

      await storage.createAuditEntry({
        tenantId: req.tenantId || "default",
        actorUserId: (req as any).user?.id || "system",
        action: "evm.snapshot_generated",
        objectType: "project",
        objectId: req.params.id,
        metadata: { weekEnding, version: snapshot.version, mode: "manual_freeze" },
      });

      res.json(snapshot);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const snapshots = await storage.getEvmSnapshots(req.params.id, req.tenantId || "default");
      res.json(snapshots);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots/:weekEnding", async (req, res) => {
    try {
      const snapshot = await storage.getEvmSnapshot(req.params.id, req.params.weekEnding, req.tenantId || "default");
      if (!snapshot) return res.status(404).json({ message: "Snapshot not found" });
      res.json(snapshot);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots/:weekEnding/versions", async (req, res) => {
    try {
      const versions = await storage.getEvmSnapshotAllVersions(req.params.id, req.params.weekEnding, req.tenantId || "default");
      res.json(versions);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/timelines/:id/evm-snapshots/:snapshotId", requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteEvmSnapshot(req.params.snapshotId, req.tenantId || "default");

      await storage.createAuditEntry({
        tenantId: req.tenantId || "default",
        actorUserId: (req as any).user?.id || "system",
        action: "evm.snapshot_deleted",
        objectType: "project",
        objectId: req.params.id,
        metadata: { snapshotId: req.params.snapshotId },
      });

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/audit-log", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const action = req.query.action as string | undefined;
      const entries = await storage.getAuditLog(req.tenantId || "default", { action, limit, offset });
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Tenant Switch ──
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
          .where(and(eq(userOrgRoles.userId, userId), eq(userOrgRoles.tenantId, tenantId))).limit(1);
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

  // ── Global Admin API (Super Admin only) ──
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

  // ── REPORT ROUTES ──

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

  // ── Seed FlightPath on startup ──
  seedFlightpathData().catch(err => console.error("FlightPath seed error:", err));

  return httpServer;
}
