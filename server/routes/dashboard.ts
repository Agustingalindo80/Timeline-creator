import type { Express } from "express";
import { db } from "../db";
import { timelines, milestones, risks, projectGates, businessOutcomes } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireModuleAccess } from "../middleware/permissions";
import { storage } from "../storage";
import { getRecordAccessContext, parseHealthHistoryRange } from "./helpers";
import { getPortfolioHealth, getPortfolioOverview } from "../reports";
import { mergeHealthHistory } from "@shared/health-trend";
import { buildPortfolioTrend } from "@shared/portfolio-trends";

type PortfolioRollup = {
  key: string;
  label: string;
  total: number;
  green: number;
  amber: number;
  red: number;
  totalBudget: number;
};

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/summary", requireModuleAccess("dashboard"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";

      const allProjects = await db.select().from(timelines)
        .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "project")));

      const allOpportunities = await db.select().from(timelines)
        .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "opportunity")));

      const accessibleProjects = ctx.isGlobal
        ? allProjects
        : allProjects.filter(p => ctx.assignedTimelineIds.includes(p.id));

      const accessibleOpportunities = ctx.isGlobal
        ? allOpportunities
        : allOpportunities.filter(o => ctx.assignedTimelineIds.includes(o.id));

      const activeProjects = accessibleProjects.filter(p => p.projectStatus !== "completed");

      const healthSummary = { green: 0, amber: 0, red: 0 };
      activeProjects.forEach(p => {
        const h = p.healthOverall || "green";
        if (h in healthSummary) healthSummary[h as keyof typeof healthSummary]++;
      });

      const totalBudget = activeProjects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || "0") || 0), 0);
      const totalCost = activeProjects.reduce((sum, p) => sum + (parseFloat(p.totalRunningCost || "0") || 0), 0);
      const forecastedRevenue = activeProjects.reduce((sum, p) => sum + (parseFloat(p.estimatedRevenue || "0") || parseFloat(p.approvedBudget || "0") || 0), 0);
      const grossMarginPercent = forecastedRevenue > 0 ? ((forecastedRevenue - totalCost) / forecastedRevenue * 100) : 0;

      const atRiskProjects = activeProjects.filter(p => p.healthOverall === "red" || p.healthOverall === "amber");

      const openOpps = accessibleOpportunities.filter(o => o.opportunityStatus !== "won" && o.opportunityStatus !== "lost");
      const pipelineValue = openOpps.reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0);
      const weightedPipelineValue = openOpps.reduce((sum, o) => {
        const syncedPrice = parseFloat(o.approvedBudget || "0") || 0;
        const initialEstimate = parseFloat(o.initialEstimate || "0") || 0;
        const riskPct = parseFloat(o.riskFactorPercent || "0") || 0;
        const bufferPct = parseFloat(o.bufferPercent || "0") || 0;
        const bufferedPrice = syncedPrice > 0
          ? syncedPrice
          : initialEstimate * (1 + riskPct / 100) * (1 + bufferPct / 100);
        const confidence = o.confidencePercent != null ? (parseFloat(o.confidencePercent) || 0) : 100;
        return sum + bufferedPrice * (confidence / 100);
      }, 0);

      const wonOpps = accessibleOpportunities.filter(o => o.opportunityStatus === "won");
      const lostOpps = accessibleOpportunities.filter(o => o.opportunityStatus === "lost");
      const closedCount = wonOpps.length + lostOpps.length;
      const conversionRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
      const convertedRevenue = wonOpps.reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0);

      const projectIds = accessibleProjects.map(p => p.id);

      let overdueMilestones: Array<{ id: string; title: string; date: string; projectTitle: string; timelineId: string }> = [];
      let upcomingMilestones: Array<{ id: string; title: string; date: string; projectTitle: string; timelineId: string }> = [];
      if (projectIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const allMilestones = await db.select().from(milestones)
          .where(sql`${milestones.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)})`);

        overdueMilestones = allMilestones
          .filter(m => m.date < today && !m.actualDate)
          .map(m => {
            const proj = accessibleProjects.find(p => p.id === m.timelineId);
            return { id: m.id, title: m.title, date: m.date, projectTitle: proj?.title || "", timelineId: m.timelineId };
          })
          .slice(0, 10);

        upcomingMilestones = allMilestones
          .filter(m => m.date >= today && m.date <= twoWeeksLater && !m.actualDate)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(m => {
            const proj = accessibleProjects.find(p => p.id === m.timelineId);
            return { id: m.id, title: m.title, date: m.date, projectTitle: proj?.title || "", timelineId: m.timelineId };
          })
          .slice(0, 10);
      }

      let criticalRaidItems: Array<{ id: string; title: string; itemType: string; impact: string; probability: string; projectTitle: string; timelineId: string }> = [];
      if (projectIds.length > 0) {
        const allRisks = await db.select().from(risks)
          .where(sql`${risks.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)}) AND ${risks.status} = 'open'`);

        criticalRaidItems = allRisks
          .filter(r => r.impact === "high" || r.impact === "very_high" || r.probability === "high" || r.probability === "very_high")
          .map(r => {
            const proj = accessibleProjects.find(p => p.id === r.timelineId);
            return { id: r.id, title: r.title, itemType: r.itemType || "risk", impact: r.impact || "", probability: r.probability || "", projectTitle: proj?.title || "", timelineId: r.timelineId };
          })
          .slice(0, 10);
      }

      let gateExceptions: Array<{ id: string; status: string; projectTitle: string; timelineId: string; stageName?: string }> = [];
      if (projectIds.length > 0) {
        const gates = await db.select().from(projectGates)
          .where(sql`${projectGates.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)}) AND (${projectGates.status} = 'exception' OR ${projectGates.status} = 'exception_requested')`);

        gateExceptions = gates.map(g => {
          const proj = accessibleProjects.find(p => p.id === g.timelineId);
          return {
            id: g.id,
            status: g.status,
            projectTitle: proj?.title || "",
            timelineId: g.timelineId,
            stageName: g.stageName || undefined,
          };
        }).slice(0, 10);
      }

      const allOutcomes = await db.select().from(businessOutcomes)
        .where(eq(businessOutcomes.tenantId, tenantId));

      const accessibleProjectIdSet = new Set(accessibleProjects.map(p => p.id));
      const accessibleOppIdSet = new Set(accessibleOpportunities.map(o => o.id));

      const accessibleOutcomes = ctx.isGlobal
        ? allOutcomes
        : allOutcomes.filter(o => {
            const projOk = !o.projectId || accessibleProjectIdSet.has(o.projectId);
            const oppOk = !o.opportunityId || accessibleOppIdSet.has(o.opportunityId);
            return projOk && oppOk;
          });

      const outcomeStatusCounts = { draft: 0, active: 0, achieved: 0, at_risk: 0, cancelled: 0 };
      accessibleOutcomes.forEach(o => {
        const s = o.status || "draft";
        if (s in outcomeStatusCounts) outcomeStatusCounts[s as keyof typeof outcomeStatusCounts]++;
      });
      const totalOutcomes = accessibleOutcomes.length;

      const atRiskOutcomes = accessibleOutcomes
        .filter(o => o.status === "at_risk")
        .map(o => {
          const proj = accessibleProjects.find(p => p.id === o.projectId);
          const opp = accessibleOpportunities.find(op => op.id === o.opportunityId);
          return {
            id: o.id,
            title: o.title,
            linkedTitle: proj?.title || opp?.title || "",
            timelineId: o.projectId || o.opportunityId || null,
          };
        })
        .slice(0, 10);

      const businessOutcomesSummary = {
        total: totalOutcomes,
        byStatus: outcomeStatusCounts,
        achievementRate: totalOutcomes > 0 ? Math.round((outcomeStatusCounts.achieved / totalOutcomes) * 100) : 0,
        atRiskOutcomes,
      };

      const openEscalations = gateExceptions.length + criticalRaidItems.filter(r => r.impact === "very_high").length;

      const healthHeatmap = activeProjects.map(p => ({
        id: p.id,
        title: p.title,
        healthOverall: p.healthOverall,
        scopeHealth: p.scopeHealth,
        budgetHealth: p.budgetHealth,
        teamHealth: p.teamHealth,
        projectStatus: p.projectStatus,
      }));

      res.json({
        portfolioHealth: healthSummary,
        totalProjects: accessibleProjects.length,
        activeProjects: activeProjects.length,
        totalBudget,
        totalCost,
        forecastedRevenue,
        grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
        pipelineValue,
        weightedPipelineValue,
        conversionRate,
        convertedRevenue,
        totalOpportunities: accessibleOpportunities.length,
        wonOpportunities: wonOpps.length,
        atRiskCount: atRiskProjects.length,
        openEscalations,
        atRiskProjects: atRiskProjects.map(p => ({ id: p.id, title: p.title, healthOverall: p.healthOverall })),
        overdueMilestones,
        upcomingMilestones,
        criticalRaidItems,
        gateExceptions,
        healthHeatmap,
        businessOutcomes: businessOutcomesSummary,
      });
    } catch (err: unknown) {
      console.error("Dashboard summary error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/dashboard/health-history", requireModuleAccess("dashboard"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";

      const allProjects = await db.select({ id: timelines.id }).from(timelines)
        .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "project")));

      const accessibleIds = ctx.isGlobal
        ? allProjects.map(p => p.id)
        : allProjects.filter(p => ctx.assignedTimelineIds.includes(p.id)).map(p => p.id);

      const range = parseHealthHistoryRange(req.query.from, req.query.to);
      const history = await storage.getHealthHistoryByTimelineIds(accessibleIds, tenantId, range);
      res.json(history);
    } catch (err: unknown) {
      console.error("Dashboard health-history error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/dashboard/portfolio-health", requireModuleAccess("reports"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";

      const allProjects = await getPortfolioHealth(tenantId, {});

      const projects = ctx.isGlobal
        ? allProjects
        : allProjects.filter(p => ctx.assignedTimelineIds.includes(p.id));

      const buildRollups = (keyFor: (p: typeof projects[number]) => { key: string; label: string }): PortfolioRollup[] => {
        const map = new Map<string, PortfolioRollup>();
        for (const p of projects) {
          const { key, label } = keyFor(p);
          let r = map.get(key);
          if (!r) {
            r = { key, label, total: 0, green: 0, amber: 0, red: 0, totalBudget: 0 };
            map.set(key, r);
          }
          r.total++;
          const h = (p.healthOverall || "green") as "green" | "amber" | "red";
          if (h === "green" || h === "amber" || h === "red") r[h]++;
          r.totalBudget += parseFloat(p.approvedBudget || "0") || 0;
        }
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
      };

      const byClient = buildRollups(p => ({
        key: p.clientId || "__unassigned__",
        label: p.clientName || "Unassigned",
      }));

      const byRegion = buildRollups(p => ({
        key: p.region || "__unassigned__",
        label: p.region || "Unassigned",
      }));

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);
      const timelineIds = projects.map(p => p.id);
      const [windowHistory, baseline] = await Promise.all([
        storage.getHealthHistoryByTimelineIds(timelineIds, tenantId, { from: fromDate }),
        storage.getHealthHistoryBaseline(timelineIds, tenantId, fromDate),
      ]);

      const history = mergeHealthHistory(baseline, windowHistory);

      res.json({ projects, rollups: { byClient, byRegion }, history, historyFrom: fromDate.toISOString() });
    } catch (err: unknown) {
      console.error("Dashboard portfolio-health error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/dashboard/portfolio-overview", requireModuleAccess("reports"), async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const tenantId = req.tenantId || "default";

      const str = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t.length > 0 ? t : undefined;
      };
      const filters = {
        clientId: str(req.query.clientId),
        stageId: str(req.query.stageId),
        rag: str(req.query.rag),
        status: str(req.query.status),
        search: str(req.query.search),
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
      };

      const overview = await getPortfolioOverview(tenantId, ctx, filters);
      res.json(overview);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-overview error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });

  // ---- Portfolio governance data endpoints (read-only, access-filtered) ----

  const accessibleProjectIds = async (req: Parameters<typeof getRecordAccessContext>[0], tenantId: string) => {
    const ctx = await getRecordAccessContext(req);
    if (!ctx) return null;
    const rows = await db.select({ id: timelines.id }).from(timelines)
      .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "project")));
    const ids = ctx.isGlobal ? rows.map(r => r.id) : rows.filter(r => ctx.assignedTimelineIds.includes(r.id)).map(r => r.id);
    return ids;
  };

  app.get("/api/dashboard/portfolio-quality", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });
      const data = await storage.getQualityMetricsByTimelineIds(ids, tenantId);
      res.json(data);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-quality error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.get("/api/dashboard/portfolio-scope-changes", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });
      const data = await storage.getScopeChangeRequestsByTimelineIds(ids, tenantId);
      res.json(data);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-scope-changes error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.get("/api/dashboard/portfolio-attention", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });
      const data = await storage.getExecutiveAttentionItemsByTimelineIds(ids, tenantId);
      res.json(data);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-attention error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.get("/api/dashboard/portfolio-stage-entries", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });
      const data = await storage.getStageEntriesByTimelineIds(ids, tenantId);
      res.json(data);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-stage-entries error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.get("/api/dashboard/portfolio-snapshots", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });
      const range = parseHealthHistoryRange(req.query.from, req.query.to);
      const data = await storage.getPortfolioSnapshotsByTimelineIds(ids, tenantId, range);
      res.json(data);
    } catch (err: unknown) {
      console.error("Dashboard portfolio-snapshots error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  // Aggregated weekly portfolio trend series for the executive Trends view.
  app.get("/api/dashboard/portfolio-trends", requireModuleAccess("reports"), async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const ids = await accessibleProjectIds(req, tenantId);
      if (ids === null) return res.status(401).json({ message: "Authentication required" });

      // Honor an explicit date range; otherwise default to the last 90 days so
      // the view opens on a sensible recent window.
      let range = parseHealthHistoryRange(req.query.from, req.query.to);
      if (!range) {
        const from = new Date();
        from.setDate(from.getDate() - 90);
        range = { from };
      }

      const snapshots = await storage.getPortfolioSnapshotsByTimelineIds(ids, tenantId, range);
      const points = buildPortfolioTrend(snapshots);
      res.json({
        points,
        projectCount: ids.length,
        from: range.from ? range.from.toISOString() : null,
        to: range.to ? range.to.toISOString() : null,
      });
    } catch (err: unknown) {
      console.error("Dashboard portfolio-trends error:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });
}
