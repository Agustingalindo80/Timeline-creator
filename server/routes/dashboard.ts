import type { Express } from "express";
import { db } from "../db";
import { timelines, milestones, risks, projectGates, businessOutcomes } from "@shared/schema";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import { getRecordAccessContext } from "./helpers";

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/summary", async (req, res) => {
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

      const pipelineValue = accessibleOpportunities
        .filter(o => o.opportunityStatus !== "won" && o.opportunityStatus !== "lost")
        .reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue || "0") || 0), 0);

      const projectIds = accessibleProjects.map(p => p.id);

      let overdueMilestones: any[] = [];
      let upcomingMilestones: any[] = [];
      if (projectIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const allMilestones = await db.select().from(milestones)
          .where(sql`${milestones.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)})`);

        overdueMilestones = allMilestones
          .filter(m => m.date < today && !m.actualDate)
          .map(m => {
            const proj = accessibleProjects.find(p => p.id === m.timelineId);
            return { ...m, projectTitle: proj?.title || "" };
          })
          .slice(0, 10);

        upcomingMilestones = allMilestones
          .filter(m => m.date >= today && m.date <= twoWeeksLater && !m.actualDate)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(m => {
            const proj = accessibleProjects.find(p => p.id === m.timelineId);
            return { ...m, projectTitle: proj?.title || "" };
          })
          .slice(0, 10);
      }

      let criticalRaidItems: any[] = [];
      if (projectIds.length > 0) {
        const allRisks = await db.select().from(risks)
          .where(sql`${risks.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)}) AND ${risks.status} = 'open'`);

        criticalRaidItems = allRisks
          .filter(r => r.impact === "high" || r.impact === "very_high" || r.probability === "high" || r.probability === "very_high")
          .map(r => {
            const proj = accessibleProjects.find(p => p.id === r.timelineId);
            return { ...r, projectTitle: proj?.title || "" };
          })
          .slice(0, 10);
      }

      let gateExceptions: any[] = [];
      if (projectIds.length > 0) {
        const gates = await db.select().from(projectGates)
          .where(sql`${projectGates.timelineId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`,`)}) AND (${projectGates.status} = 'exception' OR ${projectGates.status} = 'exception_requested')`);

        gateExceptions = gates.map(g => {
          const proj = accessibleProjects.find(p => p.id === g.timelineId);
          return { ...g, projectTitle: proj?.title || "" };
        }).slice(0, 10);
      }

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
        atRiskCount: atRiskProjects.length,
        atRiskProjects: atRiskProjects.map(p => ({ id: p.id, title: p.title, healthOverall: p.healthOverall })),
        overdueMilestones,
        upcomingMilestones,
        criticalRaidItems,
        gateExceptions,
        healthHeatmap,
      });
    } catch (err: any) {
      console.error("Dashboard summary error:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
