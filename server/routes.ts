import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { storage } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function recalcTotalRunningCost(timelineId: string) {
  const timeline = await storage.getTimeline(timelineId);
  if (!timeline) return;

  const allocs = await storage.getAllocationsByTimeline(timelineId);
  const activeAllocs = allocs.filter(a => a.status === "active");

  let totalCost = 0;

  const now = new Date();

  for (const a of activeAllocs) {
    const member = a.teamMember;
    const start = a.startDate ? new Date(a.startDate) : null;
    const end = a.endDate ? new Date(a.endDate) : null;

    if (!start || isNaN(start.getTime())) continue;
    if (now < start) continue;

    const effectiveEnd = end && !isNaN(end.getTime()) && end < now ? end : now;
    const diffMs = effectiveEnd.getTime() - start.getTime();
    if (diffMs <= 0) continue;

    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeline.engagementModel === "fixed_bid") {
      const monthlyCost = parseFloat(member.monthlyCost ?? "0") || 0;
      const months = diffDays / 30.44;
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      ];
      for (const field of timelineFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
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

      if (updates.engagementModel !== undefined) {
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
      const { title, description, date, actualDate, color, icon, sortOrder } = req.body;
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
      });
      res.status(201).json(milestone);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // UPDATE milestone
  app.patch("/api/milestones/:id", async (req, res) => {
    try {
      const { title, description, date, actualDate, color, icon, sortOrder } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (date !== undefined) updates.date = date;
      if (actualDate !== undefined) updates.actualDate = actualDate;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const milestone = await storage.updateMilestone(req.params.id, updates);
      if (!milestone) return res.status(404).json({ message: "Milestone not found" });
      res.json(milestone);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE milestone
  app.delete("/api/milestones/:id", async (req, res) => {
    try {
      await storage.deleteMilestone(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
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
        "teamMemberRoles", "regions",
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

  return httpServer;
}
