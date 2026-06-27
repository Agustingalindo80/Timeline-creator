import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { extractFolderIdFromUrl } from "../google-drive";
import { getRecordAccessContext, checkTimelineAccess, parseHealthHistoryRange } from "./helpers";
import { recalcApprovedBudget } from "../services/financials";
import { recalcTotalRunningCost } from "../services/financials";
import { parseDateToNum, recalcPhaseProgress } from "../services/project-progress";

export function registerTimelineRoutes(app: Express) {
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

  app.get("/api/timelines/:id/health-history", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const range = parseHealthHistoryRange(req.query.from, req.query.to);
      const history = await storage.getHealthHistory(req.params.id, req.tenantId || "default", range);
      res.json(history);
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

      if (timeline.recordType === "project") {
        await storage.createHealthHistory({
          tenantId: req.tenantId || "default",
          timelineId: timeline.id,
          healthOverall: timeline.healthOverall,
          scopeHealth: timeline.scopeHealth,
          budgetHealth: timeline.budgetHealth,
          teamHealth: timeline.teamHealth,
        });
      }

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

      const healthFields = ["healthOverall", "scopeHealth", "budgetHealth", "teamHealth"] as const;
      const healthInUpdate = healthFields.some((f) => updates[f] !== undefined);
      let existingForHealth: any;
      if (healthInUpdate) {
        existingForHealth = await storage.getTimeline(req.params.id, req.tenantId || "default");
      }

      const timeline = await storage.updateTimeline(req.params.id, req.tenantId || "default", updates);
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      if (healthInUpdate && existingForHealth && timeline.recordType === "project") {
        const changed = healthFields.some((f) => existingForHealth[f] !== (timeline as any)[f]);
        if (changed) {
          await storage.createHealthHistory({
            tenantId: req.tenantId || "default",
            timelineId: timeline.id,
            healthOverall: timeline.healthOverall,
            scopeHealth: timeline.scopeHealth,
            budgetHealth: timeline.budgetHealth,
            teamHealth: timeline.teamHealth,
          });
        }
      }

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

  app.delete("/api/timelines/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.deleteTimeline(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/milestones", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
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

  app.patch("/api/milestones/:id", requirePermission("project.edit"), async (req, res) => {
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

  app.delete("/api/milestones/:id", requirePermission("project.edit"), async (req, res) => {
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

  app.post("/api/timelines/:id/tasks", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
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

  app.patch("/api/tasks/:id", requirePermission("project.edit"), async (req, res) => {
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

  app.delete("/api/tasks/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id, req.tenantId || "default");
      await storage.deleteTask(req.params.id, req.tenantId || "default");
      if (task?.parentTaskId) {
        await recalcPhaseProgress(task.parentTaskId, req.tenantId || "default");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
