import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { storage } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
      const { title, description, color } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;

      const timeline = await storage.updateTimeline(req.params.id, updates);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });
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
      const {
        riskRegisterEnabled,
        taskStatuses,
        taskHealthOptions,
        taskItemTypes,
        riskProbabilities,
        riskImpacts,
        riskStatuses,
      } = req.body;
      const updates: any = {};
      if (riskRegisterEnabled !== undefined) updates.riskRegisterEnabled = riskRegisterEnabled;
      if (taskStatuses !== undefined) updates.taskStatuses = taskStatuses;
      if (taskHealthOptions !== undefined) updates.taskHealthOptions = taskHealthOptions;
      if (taskItemTypes !== undefined) updates.taskItemTypes = taskItemTypes;
      if (riskProbabilities !== undefined) updates.riskProbabilities = riskProbabilities;
      if (riskImpacts !== undefined) updates.riskImpacts = riskImpacts;
      if (riskStatuses !== undefined) updates.riskStatuses = riskStatuses;

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
