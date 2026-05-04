import type { Express } from "express";
import { db } from "../db";
import { timelines, milestones, risks, projectGates, businessOutcomes, tenants } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and, sql, lte, gte, ne } from "drizzle-orm";
import { requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext, extractUserId } from "./helpers";

type TenantPerformance = {
  tenantId: string;
  tenantName: string;
  activeProjects: number;
  totalBudget: number;
  atRiskCount: number;
  health: { green: number; amber: number; red: number };
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

      let tenantPerformance: TenantPerformance[] | null = null;
      const userId = extractUserId(req);
      if (userId) {
        const [userRecord] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
        if (userRecord?.isSuperAdmin) {
          const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants)
            .where(eq(tenants.status, "active"));

          const allTenantProjects = await db.select().from(timelines)
            .where(eq(timelines.recordType, "project"));

          tenantPerformance = allTenants.map(t => {
            const tProjects = allTenantProjects.filter(p => p.tenantId === t.id && p.projectStatus !== "completed");
            const tHealth = { green: 0, amber: 0, red: 0 };
            tProjects.forEach(p => {
              const h = p.healthOverall || "green";
              if (h in tHealth) tHealth[h as keyof typeof tHealth]++;
            });
            const tBudget = tProjects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || "0") || 0), 0);
            const tAtRisk = tProjects.filter(p => p.healthOverall === "red" || p.healthOverall === "amber").length;
            return { tenantId: t.id, tenantName: t.name, activeProjects: tProjects.length, totalBudget: tBudget, atRiskCount: tAtRisk, health: tHealth };
          }).filter(t => t.activeProjects > 0);
        }
      }

      res.json({
        portfolioHealth: healthSummary,
        totalProjects: accessibleProjects.length,
        activeProjects: activeProjects.length,
        totalBudget,
        totalCost,
        forecastedRevenue,
        grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
        pipelineValue,
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
        tenantPerformance,
      });
    } catch (err: unknown) {
      console.error("Dashboard summary error:", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ message });
    }
  });
}
