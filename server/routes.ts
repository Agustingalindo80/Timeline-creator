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
import { seedFlightpathData } from "./seed-flightpath";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function recalcApprovedBudget(timelineId: string) {
  const timeline = await storage.getTimeline(timelineId);
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

  await storage.updateTimeline(timelineId, {
    approvedBudget: budgetStr,
    grossMargin,
  });
}

async function recalcTotalRunningCost(timelineId: string) {
  const timeline = await storage.getTimeline(timelineId);
  if (!timeline) return;

  const allocs = await storage.getAllocationsByTimeline(timelineId);
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

  await storage.updateTimeline(timelineId, {
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

async function recalcPhaseProgress(phaseId: string) {
  const children = await storage.getTasksByParent(phaseId);
  if (children.length === 0) return;

  let totalWeight = 0;
  let weightedSum = 0;
  let anyInProgress = false;
  let allComplete = true;

  for (const child of children) {
    const dur = Math.max(1, parseDateToNum(child.endDate) - parseDateToNum(child.startDate));
    totalWeight += dur;
    weightedSum += child.percentComplete * dur;
    if (child.status === "in_progress") anyInProgress = true;
    if (child.status !== "complete") allComplete = false;
  }

  const updates: any = {};
  updates.percentComplete = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const phase = await storage.getTask(phaseId);
  if (phase) {
    if (allComplete) {
      updates.status = "complete";
    } else if ((anyInProgress || children.some(c => c.status === "complete")) && phase.status === "not_started") {
      updates.status = "in_progress";
    }
  }

  await storage.updateTask(phaseId, updates);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadsDir));

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const publicPaths = ["/api/login", "/api/logout", "/api/callback", "/api/auth/user", "/api/branding"];
    if (publicPaths.includes(req.path)) return next();
    return isAuthenticated(req, res, next);
  });

  // --- BRANDING ROUTES ---

  app.get("/api/branding", async (_req, res) => {
    try {
      const branding = await storage.getBranding();
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/branding", async (req, res) => {
    try {
      const fields = [
        "appName", "logoUrl", "faviconUrl", "primaryColor",
        "sidebarColor", "sidebarForegroundColor", "sidebarAccentColor", "accentColor",
      ];
      const updates: any = {};
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      const branding = await storage.updateBranding(updates);
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/logo", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `logo-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ logoUrl: url });
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/favicon", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `favicon-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ faviconUrl: url });
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- CLIENT ROUTES ---

  app.get("/api/clients", async (_req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClientWithProjects(req.params.id);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const { name, industry, contactPhone, website, address, notes, status } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Client name is required" });
      }
      const client = await storage.createClient({
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

  app.patch("/api/clients/:id", async (req, res) => {
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

      const client = await storage.updateClient(req.params.id, updates);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- CONTACT ROUTES ---

  app.get("/api/contacts", async (_req, res) => {
    const allContacts = await storage.getAllContacts();
    res.json(allContacts);
  });

  app.get("/api/clients/:clientId/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts(req.params.clientId);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:clientId/contacts", async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, isLegalRepresentative } = req.body;
      if (!firstName?.trim() || !lastName?.trim()) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const contact = await storage.createContact({
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

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, isLegalRepresentative } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (isLegalRepresentative !== undefined) updates.isLegalRepresentative = isLegalRepresentative;

      const contact = await storage.updateContact(req.params.id, updates);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      await storage.deleteContact(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- TIMELINE ROUTES ---

  // GET all timelines
  app.get("/api/timelines", async (_req, res) => {
    try {
      const timelines = await storage.getTimelines();
      res.json(timelines);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET single timeline
  app.get("/api/timelines/:id", async (req, res) => {
    try {
      const timeline = await storage.getTimeline(req.params.id);
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
  app.post("/api/timelines", async (req, res) => {
    try {
      const parsed = createTimelineBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { title, description, color, milestones: milestonesData } = parsed.data;

      const timeline = await storage.createTimeline({
        title,
        description: description || null,
        color,
      });

      if (milestonesData && Array.isArray(milestonesData)) {
        for (const m of milestonesData) {
          await storage.createMilestone({
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

      const full = await storage.getTimeline(timeline.id);
      res.status(201).json(full);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE timeline
  app.patch("/api/timelines/:id", async (req, res) => {
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
        const existing = await storage.getTimeline(req.params.id);
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

      const timeline = await storage.updateTimeline(req.params.id, updates);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      if (updates.engagementModel !== undefined || updates.startDate !== undefined || updates.endDate !== undefined) {
        await recalcTotalRunningCost(req.params.id);
        const refreshed = await storage.getTimeline(req.params.id);
        if (refreshed) return res.json(refreshed);
      }

      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE timeline
  app.delete("/api/timelines/:id", async (req, res) => {
    try {
      await storage.deleteTimeline(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ADD milestone to timeline
  app.post("/api/timelines/:id/milestones", async (req, res) => {
    try {
      const { title, description, date, actualDate, color, icon, sortOrder, isFinancialObligation, amount } = req.body;
      if (!title || !date) {
        return res.status(400).json({ message: "Title and date are required" });
      }

      const milestone = await storage.createMilestone({
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
        await recalcApprovedBudget(req.params.id);
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

      const milestone = await storage.updateMilestone(req.params.id, updates);
      if (!milestone) return res.status(404).json({ message: "Milestone not found" });

      if (isFinancialObligation !== undefined || amount !== undefined) {
        await recalcApprovedBudget(milestone.timelineId);
      }
      res.json(milestone);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE milestone
  app.delete("/api/milestones/:id", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { milestones: milestonesTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [existing] = await db.select({ timelineId: milestonesTable.timelineId, isFinancialObligation: milestonesTable.isFinancialObligation }).from(milestonesTable).where(eq(milestonesTable.id, req.params.id));
      await storage.deleteMilestone(req.params.id);
      if (existing?.isFinancialObligation) {
        await recalcApprovedBudget(existing.timelineId);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/timelines/:id/tasks", async (req, res) => {
    try {
      const taskList = await storage.getTasksByTimeline(req.params.id);
      res.json(taskList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ADD task to timeline
  app.post("/api/timelines/:id/tasks", async (req, res) => {
    try {
      const { title, description, startDate, endDate, actualStartDate, actualEndDate, color, sortOrder, status, health, itemType, parentTaskId } = req.body;
      if (!title || !startDate || !endDate) {
        return res.status(400).json({ message: "Title, start date, and end date are required" });
      }

      if (parentTaskId && (itemType || "workstream") === "workstream") {
        const parentPhase = await storage.getTask(parentTaskId);
        if (parentPhase) {
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
        timelineId: req.params.id,
        title,
        description: description || null,
        startDate,
        endDate,
        actualStartDate: actualStartDate || null,
        actualEndDate: actualEndDate || null,
        color: color || null,
        percentComplete: clampedPercent,
        sortOrder: sortOrder ?? 0,
        status: status || "not_started",
        health: health || "green",
        itemType: itemType || "workstream",
        parentTaskId: parentTaskId || null,
      });

      if (parentTaskId) {
        await recalcPhaseProgress(parentTaskId);
      }

      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const { title, description, startDate, endDate, actualStartDate, actualEndDate, color, percentComplete, sortOrder, status, health, itemType, parentTaskId } = req.body;
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

      const currentTask = await storage.getTask(req.params.id);
      if (currentTask) {
        const resolvedParentId = parentTaskId !== undefined ? parentTaskId : currentTask.parentTaskId;
        const resolvedType = itemType !== undefined ? itemType : currentTask.itemType;
        if (resolvedParentId && resolvedType === "workstream") {
          const parentPhase = await storage.getTask(resolvedParentId);
          if (parentPhase) {
            const wsStart = parseDateToNum(startDate !== undefined ? startDate : currentTask.startDate);
            const wsEnd = parseDateToNum(endDate !== undefined ? endDate : currentTask.endDate);
            const phaseStart = parseDateToNum(parentPhase.startDate);
            const phaseEnd = parseDateToNum(parentPhase.endDate);
            if (wsStart < phaseStart || wsEnd > phaseEnd) {
              return res.status(400).json({ message: `Workstream dates must fall within the parent Phase date range (${parentPhase.startDate} — ${parentPhase.endDate})` });
            }
          }
        }
      }

      const task = await storage.updateTask(req.params.id, updates);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const resolvedParentId = parentTaskId !== undefined ? parentTaskId : currentTask?.parentTaskId;
      if (resolvedParentId) {
        await recalcPhaseProgress(resolvedParentId);
      }
      if (task.itemType === "phase") {
        await recalcPhaseProgress(task.id);
      }

      res.json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const taskToDelete = await storage.getTask(req.params.id);
      await storage.deleteTask(req.params.id);
      if (taskToDelete?.parentTaskId) {
        await recalcPhaseProgress(taskToDelete.parentTaskId);
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
      const entries = await storage.getTimesheetEntries({
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
      const { weekEnding, teamMemberId } = req.query;
      const entries = await storage.getTimesheetEntries({
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
      const allAllocations = await storage.getAllocations(teamMemberId);
      const hasActiveAllocation = allAllocations.some(a => a.timelineId === timelineId && a.status === "active");
      if (!hasActiveAllocation) {
        return res.status(403).json({ message: "Team member does not have an active allocation to this project" });
      }
      const entry = await storage.createTimesheetEntry({
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
      const entry = await storage.updateTimesheetEntry(req.params.entryId, updates);
      if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/timesheets/:entryId", async (req, res) => {
    try {
      await storage.deleteTimesheetEntry(req.params.entryId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== PROGRESS ENTRIES =====

  app.get("/api/timelines/:id/progress", async (req, res) => {
    try {
      const { weekEnding, taskId } = req.query;
      const entries = await storage.getProgressEntries({
        timelineId: req.params.id,
        weekEnding: weekEnding as string | undefined,
        taskId: taskId as string | undefined,
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/progress", async (req, res) => {
    try {
      const { taskId, weekEnding, percentComplete, notes } = req.body;
      if (!taskId || !weekEnding || percentComplete === undefined) {
        return res.status(400).json({ message: "taskId, weekEnding, and percentComplete are required" });
      }
      const pct = Math.max(0, Math.min(100, parseInt(percentComplete) || 0));

      const task = await storage.getTask(taskId);
      if (!task || task.timelineId !== req.params.id) {
        return res.status(400).json({ message: "Task not found in this project" });
      }
      if (task.itemType !== "workstream") {
        return res.status(400).json({ message: "Progress can only be entered for workstreams" });
      }

      const entry = await storage.createProgressEntry({
        timelineId: req.params.id,
        taskId,
        weekEnding,
        percentComplete: pct,
        notes: notes || null,
      });

      await storage.updateTask(taskId, { percentComplete: pct });
      if (task.parentTaskId) {
        await recalcPhaseProgress(task.parentTaskId);
      }

      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/progress/:entryId", async (req, res) => {
    try {
      const existing = await storage.getProgressEntry(req.params.entryId);
      if (!existing) return res.status(404).json({ message: "Progress entry not found" });

      const updates: any = {};
      if (req.body.percentComplete !== undefined) updates.percentComplete = Math.max(0, Math.min(100, parseInt(req.body.percentComplete) || 0));
      if (req.body.weekEnding !== undefined) updates.weekEnding = req.body.weekEnding;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const entry = await storage.updateProgressEntry(req.params.entryId, updates);
      if (!entry) return res.status(404).json({ message: "Progress entry not found" });

      if (updates.percentComplete !== undefined) {
        const task = await storage.getTask(existing.taskId);
        if (task) {
          await storage.updateTask(existing.taskId, { percentComplete: updates.percentComplete });
          if (task.parentTaskId) {
            await recalcPhaseProgress(task.parentTaskId);
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
      await storage.deleteProgressEntry(req.params.entryId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET risks for timeline
  app.get("/api/timelines/:id/risks", async (req, res) => {
    try {
      const risks = await storage.getRisks(req.params.id);
      res.json(risks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ADD risk to timeline
  app.post("/api/timelines/:id/risks", async (req, res) => {
    try {
      const { title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const risk = await storage.createRisk({
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
  app.patch("/api/risks/:id", async (req, res) => {
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

      const risk = await storage.updateRisk(req.params.id, updates);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      res.json(risk);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE risk
  app.delete("/api/risks/:id", async (req, res) => {
    try {
      await storage.deleteRisk(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- TEAM MEMBER ROUTES ---

  app.get("/api/team-members", async (_req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) return res.status(404).json({ message: "Team member not found" });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/team-members", async (req, res) => {
    try {
      const { name, email, role, department, monthlyCost, hourlyCost } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const member = await storage.createTeamMember({
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

  app.patch("/api/team-members/:id", async (req, res) => {
    try {
      const { name, email, role, department, monthlyCost, hourlyCost } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;
      if (department !== undefined) updates.department = department;
      if (monthlyCost !== undefined) updates.monthlyCost = monthlyCost;
      if (hourlyCost !== undefined) updates.hourlyCost = hourlyCost;
      const member = await storage.updateTeamMember(req.params.id, updates);
      if (!member) return res.status(404).json({ message: "Team member not found" });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/team-members/:id", async (req, res) => {
    try {
      await storage.deleteTeamMember(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- RATE CARD ROUTES ---

  app.get("/api/rate-cards", async (_req, res) => {
    try {
      const cards = await storage.getRateCards();
      res.json(cards);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rate-cards", async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const card = await storage.createRateCard({
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

  app.patch("/api/rate-cards/:id", async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (region !== undefined) updates.region = region;
      if (costRate !== undefined) updates.costRate = costRate;
      if (billRate !== undefined) updates.billRate = billRate;
      const card = await storage.updateRateCard(req.params.id, updates);
      if (!card) return res.status(404).json({ message: "Rate card not found" });
      res.json(card);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rate-cards/:id", async (req, res) => {
    try {
      await storage.deleteRateCard(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- PROJECT TEAM MEMBER ROUTES ---

  app.get("/api/timelines/:id/team", async (req, res) => {
    try {
      const members = await storage.getProjectTeamMembers(req.params.id);
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/team", async (req, res) => {
    try {
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      if (!teamMemberId) return res.status(400).json({ message: "Team member is required" });
      const assignment = await storage.createProjectTeamMember({
        timelineId: req.params.id,
        teamMemberId,
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

  app.patch("/api/project-team/:id", async (req, res) => {
    try {
      const { teamMemberId, rateCardId, monthlyCost, hourlyCost, allocation, startDate, endDate } = req.body;
      const updates: any = {};
      if (teamMemberId !== undefined) updates.teamMemberId = teamMemberId;
      if (rateCardId !== undefined) updates.rateCardId = rateCardId;
      if (monthlyCost !== undefined) updates.monthlyCost = monthlyCost;
      if (hourlyCost !== undefined) updates.hourlyCost = hourlyCost;
      if (allocation !== undefined) updates.allocation = allocation;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      const assignment = await storage.updateProjectTeamMember(req.params.id, updates);
      if (!assignment) return res.status(404).json({ message: "Assignment not found" });
      res.json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/project-team/:id", async (req, res) => {
    try {
      await storage.deleteProjectTeamMember(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET allocations for a timeline/project (with team member details)
  app.get("/api/timelines/:id/allocations", async (req, res) => {
    try {
      const allocs = await storage.getAllocationsByTimeline(req.params.id);
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET all allocations (with team member and project details)
  app.get("/api/allocations", async (req, res) => {
    try {
      const allocs = await storage.getAllAllAllocations();
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET allocations for a team member
  app.get("/api/team-members/:id/allocations", async (req, res) => {
    try {
      const allocs = await storage.getAllocations(req.params.id);
      res.json(allocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // CREATE allocation for a team member
  app.post("/api/team-members/:id/allocations", async (req, res) => {
    try {
      const data = {
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
      await recalcTotalRunningCost(data.timelineId);
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE allocation
  app.patch("/api/allocations/:id", async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Allocation not found" });

      const updates: any = {};
      if (req.body.timelineId !== undefined) updates.timelineId = req.body.timelineId;
      if (req.body.weeklyHours !== undefined) updates.weeklyHours = req.body.weeklyHours;
      if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
      if (req.body.endDate !== undefined) updates.endDate = req.body.endDate;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      const allocation = await storage.updateAllocation(req.params.id, updates);
      if (!allocation) return res.status(404).json({ message: "Allocation not found" });

      await recalcTotalRunningCost(allocation.timelineId);
      if (existing.timelineId !== allocation.timelineId) {
        await recalcTotalRunningCost(existing.timelineId);
      }
      res.json(allocation);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE allocation
  app.delete("/api/allocations/:id", async (req, res) => {
    try {
      const existing = await storage.getAllocation(req.params.id);
      await storage.deleteAllocation(req.params.id);
      if (existing) {
        await recalcTotalRunningCost(existing.timelineId);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET app settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE app settings
  app.patch("/api/settings", async (req, res) => {
    try {
      const updates: any = {};
      const fields = [
        "riskRegisterEnabled", "taskStatuses", "taskHealthOptions", "taskItemTypes",
        "riskProbabilities", "riskImpacts", "riskStatuses", "projectTypes",
        "engagementModels", "clients", "contactRoles", "industries", "projectStatuses",
        "teamMemberRoles", "regions", "dateFormats",
      ];
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      const settings = await storage.updateSettings(updates);
      res.json(settings);
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
      const tenantId = (req.query.tenantId as string) || "default";
      const stages = await storage.getFlightpathStages(tenantId);
      const sorted = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const result = [];
      for (const stage of sorted) {
        const deliverables = await storage.getStageDeliverables(stage.id);
        result.push({ ...stage, deliverables: deliverables.sort((a, b) => a.sortOrder - b.sortOrder) });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages", async (req, res) => {
    try {
      const stage = await storage.createFlightpathStage(req.body);
      res.status(201).json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-stages/:id", async (req, res) => {
    try {
      const stage = await storage.updateFlightpathStage(req.params.id, req.body);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-stages/:id", async (req, res) => {
    try {
      await storage.deleteFlightpathStage(req.params.id);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FlightPath Deliverables ──
  app.get("/api/flightpath-stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getStageDeliverables(req.params.stageId);
      res.json(deliverables.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverable = await storage.createDeliverable({ ...req.body, stageId: req.params.stageId });
      res.status(201).json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-deliverables/:id", async (req, res) => {
    try {
      const deliverable = await storage.updateDeliverable(req.params.id, req.body);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      res.json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-deliverables/:id", async (req, res) => {
    try {
      await storage.deleteDeliverable(req.params.id);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Project Checkpoints ──
  app.get("/api/timelines/:id/checkpoints", async (req, res) => {
    try {
      const stageId = req.query.stageId as string | undefined;
      const checkpoints = stageId
        ? await storage.getProjectCheckpointsByStage(req.params.id, stageId)
        : await storage.getProjectCheckpoints(req.params.id);
      res.json(checkpoints);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/checkpoints", async (req, res) => {
    try {
      const checkpoint = await storage.createProjectCheckpoint({ ...req.body, timelineId: req.params.id });
      res.status(201).json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/checkpoints/:id", async (req, res) => {
    try {
      const checkpoint = await storage.updateProjectCheckpoint(req.params.id, req.body);
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });
      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/checkpoints/:id", async (req, res) => {
    try {
      await storage.deleteProjectCheckpoint(req.params.id);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Project Gates ──
  app.get("/api/timelines/:id/gates", async (req, res) => {
    try {
      const gates = await storage.getProjectGates(req.params.id);
      res.json(gates);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/gates", async (req, res) => {
    try {
      const gate = await storage.createProjectGate({ ...req.body, timelineId: req.params.id });
      res.status(201).json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/gates/:id", async (req, res) => {
    try {
      const gate = await storage.updateProjectGate(req.params.id, req.body);
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      res.json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Stage initialization: auto-create checkpoints from deliverables ──
  app.post("/api/timelines/:id/initialize-stage", async (req, res) => {
    try {
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const existing = await storage.getProjectCheckpointsByStage(req.params.id, stageId);
      if (existing.length > 0) {
        return res.json({ message: "Stage already initialized", checkpoints: existing });
      }

      const deliverables = await storage.getStageDeliverables(stageId);
      const checkpoints = [];
      for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const cp = await storage.createProjectCheckpoint({
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
  app.post("/api/timelines/:id/advance-stage", async (req, res) => {
    try {
      const { nextStageId } = req.body;
      if (!nextStageId) return res.status(400).json({ message: "nextStageId is required" });

      const timeline = await storage.getTimeline(req.params.id);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const allStages = await storage.getFlightpathStages();
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

        const gates = await storage.getProjectGates(req.params.id);
        const currentGate = gates.find(g => g.stageId === timeline.flightpathStageId);
        if (!currentGate || (currentGate.status !== "passed" && currentGate.status !== "exception")) {
          return res.status(400).json({ message: "Gate for the current stage must be passed or have an approved exception before advancing" });
        }
      }

      const updated = await storage.updateTimeline(req.params.id, { flightpathStageId: nextStageId });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Gate Evaluator ──
  app.post("/api/timelines/:id/evaluate-gate", async (req, res) => {
    try {
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const stage = await storage.getFlightpathStage(stageId);
      if (!stage) return res.status(404).json({ message: "Stage not found" });

      const allCheckpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId);
      const optionalCount = allCheckpoints.filter(c => c.optional).length;
      const checkpoints = allCheckpoints.filter(c => !c.optional);
      const totalCheckpoints = checkpoints.length;
      const completedCheckpoints = checkpoints.filter(c => c.completed).length;
      const missingItems = checkpoints.filter(c => !c.completed).map(c => c.checkpointName);

      const raidItems = await storage.getRisks(req.params.id);
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
          const allAllocations = await storage.getAllocationsByTimeline(req.params.id);
          const tsEntries = await storage.getTimesheetEntries({ timelineId: req.params.id });
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

      let gate = await storage.getProjectGate(req.params.id, stageId);
      if (!gate) {
        gate = await storage.createProjectGate({
          timelineId: req.params.id,
          stageId,
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
        });
      } else {
        gate = await storage.updateProjectGate(gate.id, {
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
          approvedAt: evaluatorResult.status === "pass" ? new Date().toISOString() : null,
        });
      }

      res.json({ gate, evaluatorResult });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Document Repository / Artifact Routes ──

  app.get("/api/timelines/:id/artifacts", async (req, res) => {
    try {
      const timeline = await storage.getTimeline(req.params.id);
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

  app.post("/api/timelines/:id/link-artifact", async (req, res) => {
    try {
      const { checkpointId, fileId, fileName, fileUrl } = req.body;
      if (!checkpointId || !fileName) {
        return res.status(400).json({ message: "checkpointId and fileName are required" });
      }

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, {
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

  app.delete("/api/timelines/:id/unlink-artifact", async (req, res) => {
    try {
      const { checkpointId } = req.body;
      if (!checkpointId) return res.status(400).json({ message: "checkpointId is required" });

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, {
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

  app.post("/api/timelines/:id/verify-artifacts", async (req, res) => {
    try {
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const timeline = await storage.getTimeline(req.params.id);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const checkpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId);
      const checkpointsWithArtifacts = checkpoints.filter(c => c.artifactFileId || c.artifactUrl || c.artifactFileName);

      if (checkpointsWithArtifacts.length === 0) {
        return res.json({ verified: 0, total: checkpoints.length, results: [] });
      }

      const stage = await storage.getFlightpathStage(stageId);
      const deliverables = await storage.getStageDeliverables(stageId);

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

          await storage.updateProjectCheckpoint(cp.id, {
            artifactVerified: result.verified === true,
            artifactVerifiedAt: new Date().toISOString(),
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

      const stages = await storage.getFlightpathStages("default");
      const sortedStages = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      let frameworkContext = "You are the FlightPath Governance Coach — an AI assistant that helps project managers navigate the FlightPath governance framework.\n\n";
      frameworkContext += "## FlightPath Framework Overview\n";
      frameworkContext += "FlightPath is a 5-stage project governance framework (Stage 0 through Stage 4) that guides projects from initial value framing through to value realization and evolution.\n\n";

      for (const stage of sortedStages) {
        const deliverables = await storage.getStageDeliverables(stage.id);
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
- Answer questions about the FlightPath framework, stages, gates, deliverables, and RACI responsibilities
- Guide PMs through their current stage and explain what's needed
- Recommend next actions and warn about common failure modes
- Explain gate criteria and what it takes to pass each gate
- Help PMs understand RACI roles and accountability
- Be specific, actionable, and reference actual framework deliverables and stages
- Keep responses focused and practical — you're a governance coach, not a general assistant`;

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

  // ── Seed FlightPath on startup ──
  seedFlightpathData().catch(err => console.error("FlightPath seed error:", err));

  return httpServer;
}
