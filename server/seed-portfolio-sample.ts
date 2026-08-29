import { db } from "./db";
import {
  timelines,
  clients,
  teamMembers,
  risks,
  projectGates,
  evmSnapshots,
  businessOutcomes,
  businessOutcomeMetrics,
  flightpathStages,
  projectQualityMetrics,
  scopeChangeRequests,
  executiveAttentionItems,
  projectStageEntries,
  portfolioSnapshots,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";

const TENANT = "default";

type Rag = "green" | "amber" | "red";
type Profile = "healthy" | "watch" | "at_risk" | "critical";

const DIMENSION_KEYS = ["schedule", "financial", "scope", "quality", "risk", "governance", "outcome"] as const;

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function ragForScore(score: number): Rag {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

interface SampleProject {
  title: string;
  description: string;
  clientName: string;
  industry: string;
  subsidiary: string;
  region: string;
  profile: Profile;
  pm: string;
  approvedBudget: number;
  contractedRevenue: number;
  targetMarginPct: number;
  strategicAccount: boolean;
  stageIndex: number; // index into ordered stages = current stage
  baseScore: number; // current overall score
  trend: number; // weekly score delta over history
}

const SAMPLE_CLIENTS: { name: string; industry: string }[] = [
  { name: "Northwind Logistics", industry: "Transportation" },
  { name: "Helios Energy Group", industry: "Energy & Utilities" },
  { name: "Meridian Health Systems", industry: "Healthcare" },
  { name: "Apex Financial Partners", industry: "Financial Services" },
  { name: "Verdant Retail Co.", industry: "Retail" },
  { name: "Orbital Telecom", industry: "Telecommunications" },
];

const SAMPLE_PMS = [
  { name: "Dana Whitfield", role: "Engagement Manager", department: "Delivery" },
  { name: "Marcus Lim", role: "Engagement Manager", department: "Delivery" },
  { name: "Priya Nair", role: "Senior Project Manager", department: "Delivery" },
  { name: "Tomás Herrera", role: "Project Manager", department: "Delivery" },
];

const SAMPLE_PROJECTS: SampleProject[] = [
  {
    title: "Northwind Fleet Optimization Platform",
    description: "Cloud platform to optimize fleet routing, fuel usage, and driver scheduling.",
    clientName: "Northwind Logistics", industry: "Transportation",
    subsidiary: "Vogara North America", region: "North America",
    profile: "healthy", pm: "Dana Whitfield",
    approvedBudget: 1850000, contractedRevenue: 2300000, targetMarginPct: 32,
    strategicAccount: true, stageIndex: 3, baseScore: 86, trend: 1.5,
  },
  {
    title: "Helios Grid Modernization",
    description: "Smart-grid telemetry and demand-response analytics rollout across 4 regions.",
    clientName: "Helios Energy Group", industry: "Energy & Utilities",
    subsidiary: "Vogara EMEA", region: "EMEA",
    profile: "watch", pm: "Marcus Lim",
    approvedBudget: 3200000, contractedRevenue: 3950000, targetMarginPct: 28,
    strategicAccount: true, stageIndex: 4, baseScore: 72, trend: -0.8,
  },
  {
    title: "Meridian Patient 360 Rollout",
    description: "Unified patient record and care-coordination workspace for 12 hospitals.",
    clientName: "Meridian Health Systems", industry: "Healthcare",
    subsidiary: "Vogara North America", region: "North America",
    profile: "at_risk", pm: "Priya Nair",
    approvedBudget: 2750000, contractedRevenue: 3100000, targetMarginPct: 24,
    strategicAccount: false, stageIndex: 4, baseScore: 54, trend: -2.2,
  },
  {
    title: "Apex Wealth Onboarding Modernization",
    description: "Digital client onboarding and KYC automation for wealth advisory.",
    clientName: "Apex Financial Partners", industry: "Financial Services",
    subsidiary: "Vogara North America", region: "North America",
    profile: "healthy", pm: "Tomás Herrera",
    approvedBudget: 1450000, contractedRevenue: 1820000, targetMarginPct: 35,
    strategicAccount: false, stageIndex: 5, baseScore: 83, trend: 0.6,
  },
  {
    title: "Verdant Unified Commerce",
    description: "Headless commerce replatform unifying online and in-store experiences.",
    clientName: "Verdant Retail Co.", industry: "Retail",
    subsidiary: "Vogara EMEA", region: "EMEA",
    profile: "critical", pm: "Marcus Lim",
    approvedBudget: 4100000, contractedRevenue: 4300000, targetMarginPct: 20,
    strategicAccount: true, stageIndex: 3, baseScore: 41, trend: -3.0,
  },
  {
    title: "Orbital Billing Transformation",
    description: "Convergent billing and revenue assurance migration for telecom subscribers.",
    clientName: "Orbital Telecom", industry: "Telecommunications",
    subsidiary: "Vogara APAC", region: "APAC",
    profile: "watch", pm: "Priya Nair",
    approvedBudget: 5200000, contractedRevenue: 6100000, targetMarginPct: 26,
    strategicAccount: true, stageIndex: 2, baseScore: 68, trend: 0.4,
  },
  {
    title: "Northwind Warehouse Automation",
    description: "Robotics integration and WMS uplift for three distribution centers.",
    clientName: "Northwind Logistics", industry: "Transportation",
    subsidiary: "Vogara APAC", region: "APAC",
    profile: "healthy", pm: "Dana Whitfield",
    approvedBudget: 2200000, contractedRevenue: 2750000, targetMarginPct: 30,
    strategicAccount: false, stageIndex: 1, baseScore: 88, trend: 0.9,
  },
  {
    title: "Helios Customer Self-Service Portal",
    description: "Self-service account, outage, and payments portal for residential customers.",
    clientName: "Helios Energy Group", industry: "Energy & Utilities",
    subsidiary: "Vogara EMEA", region: "EMEA",
    profile: "at_risk", pm: "Tomás Herrera",
    approvedBudget: 980000, contractedRevenue: 1150000, targetMarginPct: 22,
    strategicAccount: false, stageIndex: 2, baseScore: 58, trend: -1.4,
  },
];

const HISTORY_WEEKS = 10;

export async function seedPortfolioSampleData(): Promise<void> {
  // Idempotency guard: if sample quality metrics already exist, assume seeded.
  const existing = await db.select({ id: projectQualityMetrics.id })
    .from(projectQualityMetrics)
    .where(eq(projectQualityMetrics.tenantId, TENANT))
    .limit(1);
  if (existing.length > 0) return;

  // Requires flightpath stages to exist (seeded earlier in startup).
  const stages = await db.select().from(flightpathStages)
    .where(eq(flightpathStages.tenantId, TENANT))
    .orderBy(flightpathStages.sortOrder);
  if (stages.length === 0) {
    console.warn("[seed-portfolio-sample] No flightpath stages for default tenant; skipping portfolio sample seed.");
    return;
  }

  // Run the entire seed in a single transaction so a mid-run failure rolls back
  // completely, keeping the simple "any quality metric exists" guard correct.
  await db.transaction(async (tx) => {
  // Ensure sample clients.
  const clientIdByName = new Map<string, string>();
  for (const c of SAMPLE_CLIENTS) {
    const found = await tx.select().from(clients)
      .where(and(eq(clients.tenantId, TENANT), eq(clients.name, c.name))).limit(1);
    if (found.length > 0) {
      clientIdByName.set(c.name, found[0].id);
    } else {
      const [row] = await tx.insert(clients).values({
        tenantId: TENANT, name: c.name, industry: c.industry, status: "active",
      }).returning();
      clientIdByName.set(c.name, row.id);
    }
  }

  // Ensure sample engagement managers (team members).
  const pmIdByName = new Map<string, string>();
  for (const m of SAMPLE_PMS) {
    const found = await tx.select().from(teamMembers)
      .where(and(eq(teamMembers.tenantId, TENANT), eq(teamMembers.name, m.name))).limit(1);
    if (found.length > 0) {
      pmIdByName.set(m.name, found[0].id);
    } else {
      const [row] = await tx.insert(teamMembers).values({
        tenantId: TENANT, name: m.name, role: m.role, department: m.department,
      }).returning();
      pmIdByName.set(m.name, row.id);
    }
  }

  for (const p of SAMPLE_PROJECTS) {
    const clientId = clientIdByName.get(p.clientName)!;
    const pmId = pmIdByName.get(p.pm) ?? null;
    const currentStage = stages[Math.min(p.stageIndex, stages.length - 1)];

    const overallRag = ragForScore(p.baseScore);
    const totalRunningCost = Math.round(p.approvedBudget * (p.profile === "critical" ? 0.92 : p.profile === "at_risk" ? 0.78 : 0.55));
    const realizedMargin = p.profile === "critical" ? p.targetMarginPct - 14
      : p.profile === "at_risk" ? p.targetMarginPct - 7
      : p.profile === "watch" ? p.targetMarginPct - 2
      : p.targetMarginPct + 1;
    const startDate = daysAgo(180);
    const endDate = daysAgo(-120);
    const goLive = daysAgo(-90);

    const projectHealth: Rag = overallRag;
    const scopeHealth: Rag = p.profile === "critical" ? "red" : p.profile === "at_risk" ? "amber" : "green";
    const budgetHealth: Rag = realizedMargin < 10 ? "red" : realizedMargin < 22 ? "amber" : "green";
    const teamHealth: Rag = p.profile === "critical" ? "amber" : "green";

    const [project] = await tx.insert(timelines).values({
      tenantId: TENANT,
      title: p.title,
      description: p.description,
      recordType: "project",
      client: p.clientName,
      clientId,
      region: p.region,
      subsidiary: p.subsidiary,
      engagementManagerId: pmId,
      projectStatus: "in_progress",
      healthOverall: projectHealth,
      scopeHealth,
      budgetHealth,
      teamHealth,
      approvedBudget: p.approvedBudget.toFixed(2),
      totalRunningCost: totalRunningCost.toFixed(2),
      grossMargin: realizedMargin.toFixed(2),
      estimatedRevenue: p.contractedRevenue.toFixed(2),
      contractedRevenue: p.contractedRevenue.toFixed(2),
      targetMarginPct: p.targetMarginPct.toFixed(2),
      targetGoLiveDate: isoDate(goLive),
      strategicAccount: p.strategicAccount,
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      flightpathStageId: currentStage.id,
    }).returning();

    const timelineId = project.id;

    // ---- Stage entries: prior stages + current stage ----
    for (let i = 0; i <= p.stageIndex && i < stages.length; i++) {
      const enteredAt = daysAgo(180 - i * 30);
      await tx.insert(projectStageEntries).values({
        tenantId: TENANT,
        timelineId,
        stageId: stages[i].id,
        enteredAt,
        notes: i === p.stageIndex ? "Current stage" : "Promoted on gate approval",
      });
    }

    // ---- Gates: approved for prior stages, current depends on profile ----
    for (let i = 0; i < p.stageIndex && i < stages.length; i++) {
      await tx.insert(projectGates).values({
        tenantId: TENANT,
        timelineId,
        stageId: stages[i].id,
        status: "approved",
        approvedAt: daysAgo(180 - i * 30 - 1),
        approvedBy: p.pm,
        notes: "Gate cleared.",
      });
    }
    if (p.stageIndex < stages.length) {
      const currentGateStatus = p.profile === "critical" ? "rejected"
        : p.profile === "at_risk" ? "exception_requested"
        : p.profile === "watch" ? "in_review"
        : "pending";
      await tx.insert(projectGates).values({
        tenantId: TENANT,
        timelineId,
        stageId: currentStage.id,
        status: currentGateStatus,
        notes: currentGateStatus === "rejected" ? "Gate rejected pending remediation."
          : currentGateStatus === "exception_requested" ? "Conditional exception requested."
          : "Awaiting governance review.",
      });
    }

    // ---- RAID items (risk / issue / assumption / dependency) ----
    const raidCount = p.profile === "critical" ? 5 : p.profile === "at_risk" ? 4 : 2;
    const raidTemplates = [
      { itemType: "risk", title: "Integration complexity may delay delivery", category: "Technical", probability: "high", impact: "high" },
      { itemType: "issue", title: "Key SME unavailable during UAT window", category: "Resourcing", probability: "high", impact: "medium" },
      { itemType: "dependency", title: "Client must provision production environment", category: "External", probability: "medium", impact: "high" },
      { itemType: "assumption", title: "Data migration scope limited to active records", category: "Scope", probability: "medium", impact: "medium" },
      { itemType: "risk", title: "Third-party API rate limits constrain throughput", category: "Technical", probability: "medium", impact: "high" },
    ];
    for (let i = 0; i < raidCount; i++) {
      const t = raidTemplates[i % raidTemplates.length];
      const isCritical = i === 0 && (p.profile === "critical" || p.profile === "at_risk");
      await tx.insert(risks).values({
        tenantId: TENANT,
        timelineId,
        title: t.title,
        description: `${t.title} — captured during delivery governance review.`,
        category: t.category,
        owner: p.pm,
        probability: isCritical ? "high" : t.probability,
        impact: isCritical ? "high" : t.impact,
        status: "open",
        itemType: t.itemType,
        raisedDate: isoDate(daysAgo(60 - i * 5)),
        sortOrder: i,
      });
    }

    // ---- Business outcomes ----
    const outcomeStatus = p.profile === "critical" ? "at_risk"
      : p.profile === "at_risk" ? "at_risk"
      : p.profile === "watch" ? "active"
      : "active";
    const [costOutcome] = await tx.insert(businessOutcomes).values({
      tenantId: TENANT,
      title: `${p.clientName}: realize target operating margin`,
      strategicObjective: "Improve operational efficiency and reduce run cost.",
      successMetric: "Operating cost reduction (%)",
      baseline: "0%",
      target: "15%",
      currentValue: p.profile === "healthy" ? "11%" : p.profile === "watch" ? "7%" : "3%",
      status: outcomeStatus,
      clientId,
      projectId: timelineId,
      stageId: currentStage.id,
      targetDate: isoDate(daysAgo(-90)),
    }).returning();
    await tx.insert(businessOutcomeMetrics).values({
      tenantId: TENANT,
      businessOutcomeId: costOutcome.id,
      description: "Operating cost reduction (%)",
      currentValue: p.profile === "healthy" ? "11" : p.profile === "watch" ? "7" : "3",
      currentValueType: "percentage",
      currentUnit: "%",
      expectedValue: "15",
      expectedValueType: "percentage",
      expectedUnit: "%",
      evaluationPeriod: 1,
      evaluationPeriodUnit: "months",
      sortOrder: 0,
    });
    const [adoptionOutcome] = await tx.insert(businessOutcomes).values({
      tenantId: TENANT,
      title: `${p.clientName}: adoption of new platform`,
      strategicObjective: "Drive user adoption and time-to-value.",
      successMetric: "Active user adoption (%)",
      baseline: "0%",
      target: "80%",
      currentValue: p.profile === "healthy" ? "62%" : p.profile === "watch" ? "45%" : "20%",
      status: p.profile === "critical" ? "at_risk" : "active",
      clientId,
      projectId: timelineId,
      stageId: currentStage.id,
      targetDate: isoDate(daysAgo(-120)),
    }).returning();
    await tx.insert(businessOutcomeMetrics).values({
      tenantId: TENANT,
      businessOutcomeId: adoptionOutcome.id,
      description: "Active user adoption (%)",
      currentValue: p.profile === "healthy" ? "62" : p.profile === "watch" ? "45" : "20",
      currentValueType: "percentage",
      currentUnit: "%",
      expectedValue: "80",
      expectedValueType: "percentage",
      expectedUnit: "%",
      evaluationPeriod: 1,
      evaluationPeriodUnit: "months",
      sortOrder: 0,
    });

    // ---- EVM snapshots (last 6 weeks; latest is current) ----
    const bac = p.approvedBudget;
    const cpiTarget = p.profile === "critical" ? 0.82 : p.profile === "at_risk" ? 0.91 : p.profile === "watch" ? 0.98 : 1.06;
    const spiTarget = p.profile === "critical" ? 0.79 : p.profile === "at_risk" ? 0.9 : p.profile === "watch" ? 0.97 : 1.03;
    for (let w = 5; w >= 0; w--) {
      const weekEnding = daysAgo(w * 7);
      const progress = 0.45 + (5 - w) * 0.04;
      const plannedValue = bac * progress;
      const cpi = cpiTarget + (w * 0.01);
      const spi = spiTarget + (w * 0.008);
      const earnedValue = plannedValue * spi;
      const actualCost = earnedValue / cpi;
      const eac = bac / cpi;
      await tx.insert(evmSnapshots).values({
        tenantId: TENANT,
        timelineId,
        weekEnding: isoDate(weekEnding),
        version: 1,
        isCurrent: w === 0,
        mode: "manual_freeze",
        bac: bac.toFixed(2),
        plannedValue: plannedValue.toFixed(2),
        actualCost: actualCost.toFixed(2),
        earnedValue: earnedValue.toFixed(2),
        scheduleVariance: (earnedValue - plannedValue).toFixed(2),
        costVariance: (earnedValue - actualCost).toFixed(2),
        spiValue: spi.toFixed(4),
        cpiValue: cpi.toFixed(4),
        eacValue: eac.toFixed(2),
        vacValue: (bac - eac).toFixed(2),
      });
    }

    // ---- Quality metrics (two snapshots) ----
    const qaBad = p.profile === "critical" || p.profile === "at_risk";
    await tx.insert(projectQualityMetrics).values([
      {
        tenantId: TENANT, timelineId, snapshotDate: isoDate(daysAgo(14)),
        openDefects: qaBad ? 38 : 12, criticalDefects: qaBad ? 6 : 1,
        uatBlockers: qaBad ? 4 : 0, failedTests: qaBad ? 22 : 5, reopenedTests: qaBad ? 9 : 2,
        regressionReady: !qaBad, qaExitStatus: qaBad ? "not_ready" : "conditional",
        notes: "QA snapshot",
      },
      {
        tenantId: TENANT, timelineId, snapshotDate: isoDate(daysAgo(0)),
        openDefects: qaBad ? 31 : 7, criticalDefects: qaBad ? 5 : 0,
        uatBlockers: qaBad ? 3 : 0, failedTests: qaBad ? 18 : 3, reopenedTests: qaBad ? 7 : 1,
        regressionReady: !qaBad, qaExitStatus: p.profile === "critical" ? "not_ready" : qaBad ? "conditional" : "passed",
        notes: "Latest QA snapshot",
      },
    ]);

    // ---- Scope change requests ----
    const scopeCount = p.profile === "critical" ? 3 : p.profile === "at_risk" ? 2 : 1;
    for (let i = 0; i < scopeCount; i++) {
      const approved = i === 0 && p.profile !== "critical";
      await tx.insert(scopeChangeRequests).values({
        tenantId: TENANT,
        timelineId,
        title: `Change request ${i + 1}: additional ${["reporting module", "integration", "compliance workflow"][i % 3]}`,
        description: "Client-requested scope addition assessed for commercial and schedule impact.",
        status: approved ? "approved" : "submitted",
        commercialImpact: (45000 + i * 30000).toFixed(2),
        timelineImpactDays: 10 + i * 5,
        marginImpactPct: (-1.5 - i).toFixed(2),
        approvedBy: approved ? p.pm : null,
        approvedAt: approved ? daysAgo(20) : null,
        raisedDate: isoDate(daysAgo(40 - i * 8)),
      });
    }

    // ---- Executive attention items ----
    if (p.profile === "critical" || p.profile === "at_risk" || p.profile === "watch") {
      const sev = p.profile === "critical" ? "critical" : p.profile === "at_risk" ? "high" : "medium";
      await tx.insert(executiveAttentionItems).values({
        tenantId: TENANT,
        timelineId,
        title: p.profile === "critical" ? "Margin erosion below contractual floor" : "Schedule slippage trending negative",
        description: p.profile === "critical"
          ? "Realized margin has fallen significantly below target; recovery plan required."
          : "SPI declining over the last three reporting periods.",
        severity: sev,
        issueType: p.profile === "critical" ? "financial" : "schedule",
        owner: p.pm,
        dueDate: isoDate(daysAgo(-14)),
        recommendedAction: p.profile === "critical"
          ? "Escalate to steering committee; renegotiate scope and re-baseline."
          : "Re-sequence critical path and add delivery capacity.",
        escalationStatus: p.profile === "critical" ? "escalated" : "none",
        status: "open",
      });
      if (p.profile === "critical") {
        await tx.insert(executiveAttentionItems).values({
          tenantId: TENANT,
          timelineId,
          title: "QA exit criteria not met for go-live",
          description: "Open critical defects and UAT blockers jeopardize the go-live date.",
          severity: "high",
          issueType: "quality",
          owner: p.pm,
          dueDate: isoDate(daysAgo(-7)),
          recommendedAction: "Institute defect triage cadence and freeze new scope.",
          escalationStatus: "exec_review",
          status: "open",
        });
      }
    }

    // ---- Weekly portfolio snapshots (history) ----
    for (let w = HISTORY_WEEKS - 1; w >= 0; w--) {
      const weeksBack = w;
      const score = Math.max(15, Math.min(98, Math.round(p.baseScore - p.trend * weeksBack)));
      const rag = ragForScore(score);
      const dimensionRags: Record<string, string> = {};
      for (let di = 0; di < DIMENSION_KEYS.length; di++) {
        const key = DIMENSION_KEYS[di];
        // Vary dimensions slightly around the overall score.
        const adj = [(-4), 6, -2, (qaBad ? -12 : 4), (p.profile === "critical" ? -10 : 0), 2, -6][di];
        dimensionRags[key] = ragForScore(Math.max(10, Math.min(99, score + adj)));
      }
      const marginPct = realizedMargin - p.trend * weeksBack * 0.2;
      const forecastRevenue = p.contractedRevenue * (1 - weeksBack * 0.005);
      const riskExposure = (p.profile === "critical" ? 850000 : p.profile === "at_risk" ? 420000 : p.profile === "watch" ? 180000 : 60000) * (1 + weeksBack * 0.03);
      await tx.insert(portfolioSnapshots).values({
        tenantId: TENANT,
        timelineId,
        snapshotDate: isoDate(daysAgo(weeksBack * 7)),
        overallScore: score.toFixed(2),
        overallRag: rag,
        dimensionRags,
        marginPct: marginPct.toFixed(2),
        forecastRevenue: forecastRevenue.toFixed(2),
        riskExposure: riskExposure.toFixed(2),
        openCriticalRisks: p.profile === "critical" ? 3 : p.profile === "at_risk" ? 2 : 0,
        blockedGates: (p.profile === "critical") ? 1 : 0,
        outcomesOnTrack: p.profile === "healthy" ? 2 : p.profile === "watch" ? 1 : 0,
      });
    }
  }
  });

  console.log(`[seed-portfolio-sample] Seeded ${SAMPLE_PROJECTS.length} sample projects with governance data.`);
}
