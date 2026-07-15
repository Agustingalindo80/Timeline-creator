import { db } from "./db";
import { flightpathStages, flightpathDeliverables, operatingModels } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface DeliverableData {
  name: string;
  description?: string;
  raciData: Record<string, string>;
  sortOrder: number;
}

interface StageData {
  stageNumber: number;
  name: string;
  goal: string;
  description?: string;
  gateName: string;
  gateDescription?: string;
  playbookPurpose?: string;
  playbookExitBundle?: string;
  sortOrder: number;
  deliverables: DeliverableData[];
}

const STAGES: StageData[] = [
  {
    stageNumber: 0,
    name: "Pre-Sales Value + Scope Lock",
    goal: "Convert business intent into a sellable, executable, protectable commitment",
    description: "Produce SOW-ready scope, validate delivery feasibility, and complete the Sales→Delivery handoff. Primary owners: Pre-Sales Engineers + AE (Sales). Control function: Delivery Leadership.",
    gateName: "Gate 1: Commercial & Operational Authorization",
    gateDescription: "Client signed SOW (commercial authorization); Sales→Delivery handoff completed (operational authorization); Delivery Lead accepts ownership (explicit, not implied); Key assumptions/risks logged and owned",
    playbookPurpose: "SOW-ready scope package, delivery feasibility validation, internal handoff pack, client approval",
    playbookExitBundle: "Deal Context & Value Summary, Scope Definition Pack, Solution Approach, Delivery Feasibility Review, Statement of Work, Sales→Delivery Handoff Pack",
    sortOrder: 0,
    deliverables: [
      { name: "Deal Context & Value Summary", description: "Business problem, why now, expected outcomes — used to align sponsor and justify investment. Lightweight document (1-2 pages).", raciData: { "Sales Owner (AE)": "A/R", "Pre-Sales": "R", "Delivery Lead": "C", "Solution Architect": "C", "PM": "I" }, sortOrder: 0 },
      { name: "Scope Definition Pack (SOW-grade)", description: "In/out scope, assumptions, dependencies, constraints, phasing approach (MVP/Wave 1), clear exclusions, acceptance approach — what 'done' means.", raciData: { "Pre-Sales": "R", "Sales Owner (AE)": "A", "Delivery Lead": "C", "Solution Architect": "C", "BA Lead": "C" }, sortOrder: 1 },
      { name: "Solution Approach", description: "Target architecture, major integrations, environment approach. Non-functional constraints: security, compliance, data.", raciData: { "Pre-Sales": "R", "Solution Architect": "A/R", "Delivery Lead": "C", "Customer IT/EA": "C" }, sortOrder: 2 },
      { name: "Delivery Feasibility Review", description: "Internal Delivery Leadership review: delivery approach, risks, resourcing assumptions, timeline realism. 'Approved to sell' checkpoint.", raciData: { "Delivery Lead": "A/R", "Pre-Sales": "C", "Solution Architect": "C", "Sales Owner (AE)": "I", "PM": "I" }, sortOrder: 3 },
      { name: "Statement of Work (SOW)", description: "Robust scope protection, commercial structure, timeline guardrails. Change control mechanism and acceptance language.", raciData: { "Sales Owner (AE)": "A/R", "Pre-Sales": "C", "Delivery Lead": "C", "Finance": "C" }, sortOrder: 4 },
      { name: "Sales → Delivery Handoff Pack", description: "Deal snapshot, what was sold, commercial terms impacting delivery, assumptions/dependencies/constraints, risks and known unknowns, solution outline, staffing expectations, first 2 weeks plan.", raciData: { "Sales Owner (AE)": "R", "Pre-Sales": "R", "Delivery Lead": "A", "PM": "C", "Solution Architect": "C" }, sortOrder: 5 },
    ],
  },
  {
    stageNumber: 1,
    name: "Structured Initiation",
    goal: "Establish the project foundation with governance, team, plan, and requirements",
    description: "Formalize the project charter, establish governance, define requirements approach, set up environments, and create the delivery baseline.",
    gateName: "Gate 2: Initiation Authorization",
    gateDescription: "Project Charter signed; Governance model operational; RACI confirmed; Stage plan baselined; RAID log active with owners; Requirements approach agreed; Environments/access provisioned; Integration plan confirmed; Quality strategy defined; Outcome measurement plan finalized; Commercial baseline locked",
    playbookPurpose: "Formalize governance, team, plan, requirements, and delivery baseline",
    playbookExitBundle: "Project Charter, Governance Model, RACI Matrix, Stage Plan, RAID Log, Requirements Approach, Environments/Access Plan, Integration Plan, Quality Strategy, Outcome Measurement Plan, Commercial Baseline",
    sortOrder: 1,
    deliverables: [
      { name: "Project Charter", description: "Formal project authorization document with objectives, scope, and constraints", raciData: { "Delivery Lead": "A/R", "PM": "R", "Customer Sponsor": "A", "Customer PO": "C", "BA Lead": "C", "Solution Architect": "C", "Finance": "C" }, sortOrder: 0 },
      { name: "Governance Model", description: "Defined governance structure with decision rights and escalation paths", raciData: { "Delivery Lead": "A/R", "PM": "R", "Customer Sponsor": "A", "Customer PO": "C", "Change": "C" }, sortOrder: 1 },
      { name: "RACI Matrix", description: "Role-responsibility assignment for all project activities", raciData: { "PM": "A/R", "Delivery Lead": "R", "BA Lead": "C", "Solution Architect": "C", "Customer PO": "C" }, sortOrder: 2 },
      { name: "Stage Plan (baselined)", description: "Detailed delivery plan with milestones, dependencies, and resource allocations", raciData: { "PM": "A/R", "Delivery Lead": "R", "BA Lead": "C", "Solution Architect": "C", "Finance": "C", "Customer PO": "C" }, sortOrder: 3 },
      { name: "RAID Log (active with owners)", description: "Operational RAID log with assigned owners and review cadence", raciData: { "PM": "A/R", "Delivery Lead": "R", "BA Lead": "R", "Solution Architect": "R", "Customer PO": "C" }, sortOrder: 4 },
      { name: "Requirements Approach", description: "Methodology for gathering, documenting, and validating requirements", raciData: { "BA Lead": "A/R", "Solution Architect": "C", "Customer PO": "R", "Delivery Lead": "C", "PM": "I" }, sortOrder: 5 },
      { name: "Environments/Access Plan", description: "Environment provisioning plan with access requirements and timelines", raciData: { "Solution Architect": "A/R", "Customer IT/EA": "R", "PM": "C", "Delivery Lead": "C" }, sortOrder: 6 },
      { name: "Integration Plan", description: "System integration approach, interfaces, and data flow definitions", raciData: { "Solution Architect": "A/R", "Customer IT/EA": "R", "BA Lead": "C", "Data Owner": "C", "PM": "I" }, sortOrder: 7 },
      { name: "Quality Strategy", description: "Testing approach, quality gates, acceptance criteria, and defect management", raciData: { "Delivery Lead": "A/R", "Solution Architect": "C", "BA Lead": "C", "PM": "R", "Customer PO": "C" }, sortOrder: 8 },
      { name: "Outcome Measurement Plan", description: "How business outcomes will be measured throughout delivery and post-delivery", raciData: { "BA Lead": "A/R", "Data Owner": "R", "Customer PO": "R", "PM": "C", "Change": "C" }, sortOrder: 9 },
      { name: "Commercial Baseline (locked)", description: "Agreed commercial terms, budget, and financial tracking approach", raciData: { "Finance": "A/R", "Sales Owner (AE)": "C", "PM": "R", "Customer Sponsor": "A", "Customer PO": "I" }, sortOrder: 10 },
    ],
  },
  {
    stageNumber: 2,
    name: "Solution Execution",
    goal: "Build, test, and prepare the solution for deployment",
    description: "Execute the delivery plan through iterative development, testing, integration, and preparation for deployment readiness.",
    gateName: "Gate 3: Deployment Readiness",
    gateDescription: "Solution built and tested; Integration testing complete; UAT signed off; Performance benchmarks met; Deployment plan approved; Rollback plan defined; Training materials prepared; Support model defined; Go-live criteria agreed",
    playbookPurpose: "Deliver the solution through iterative build, test, and integration cycles",
    playbookExitBundle: "Tested Solution, Integration Test Results, UAT Sign-off, Performance Report, Deployment Plan, Rollback Plan, Training Materials, Support Model, Go-live Criteria",
    sortOrder: 2,
    deliverables: [
      { name: "Solution Build (iterative)", description: "Working solution delivered through iterative development sprints", raciData: { "Delivery Lead": "A/R", "Solution Architect": "R", "BA Lead": "C", "PM": "I", "Customer PO": "C" }, sortOrder: 0 },
      { name: "Integration Test Results", description: "Results from system integration testing with all connected systems", raciData: { "Solution Architect": "A/R", "Customer IT/EA": "R", "Delivery Lead": "C", "PM": "I" }, sortOrder: 1 },
      { name: "UAT Plan + Sign-off", description: "User acceptance testing plan, execution evidence, and formal sign-off", raciData: { "BA Lead": "A/R", "Customer PO": "R", "Delivery Lead": "C", "PM": "C" }, sortOrder: 2 },
      { name: "Performance Benchmarks", description: "Performance testing results against agreed benchmarks and SLAs", raciData: { "Solution Architect": "A/R", "Customer IT/EA": "C", "Delivery Lead": "C", "PM": "I" }, sortOrder: 3 },
      { name: "Deployment Plan", description: "Step-by-step deployment plan with roles, timeline, and verification steps", raciData: { "PM": "A/R", "Solution Architect": "R", "Customer IT/EA": "R", "Delivery Lead": "C" }, sortOrder: 4 },
      { name: "Rollback Plan", description: "Contingency plan for reverting deployment if critical issues arise", raciData: { "Solution Architect": "A/R", "Customer IT/EA": "R", "PM": "C", "Delivery Lead": "C" }, sortOrder: 5 },
      { name: "Training Materials", description: "End-user and admin training documentation and materials", raciData: { "Change": "A/R", "BA Lead": "C", "Customer PO": "C", "PM": "I" }, sortOrder: 6 },
      { name: "Support Model", description: "Post-go-live support structure, SLAs, and escalation procedures", raciData: { "Delivery Lead": "A/R", "PM": "R", "Customer PO": "C", "Customer IT/EA": "C" }, sortOrder: 7 },
      { name: "Go-live Criteria", description: "Agreed criteria that must be met before go-live authorization", raciData: { "PM": "A/R", "Delivery Lead": "R", "Customer Sponsor": "A", "Customer PO": "C", "Solution Architect": "C" }, sortOrder: 8 },
    ],
  },
  {
    stageNumber: 3,
    name: "Adoption Enablement",
    goal: "Drive user adoption and validate business value delivery",
    description: "Support organizational change, drive adoption, measure business outcomes, and validate that the solution delivers intended value.",
    gateName: "Gate 4: Value Validation",
    gateDescription: "Adoption metrics meet targets; Business outcomes measured against baselines; User satisfaction assessed; Outstanding issues resolved; Value realization report drafted; Lessons learned captured; Evolution opportunities identified",
    playbookPurpose: "Enable adoption, measure outcomes, and validate value delivery",
    playbookExitBundle: "Adoption Metrics Report, Outcome Measurement Results, User Satisfaction Assessment, Issue Resolution Report, Value Realization Draft, Lessons Learned, Evolution Opportunities",
    sortOrder: 3,
    deliverables: [
      { name: "Adoption Metrics Report", description: "Tracking of user adoption against defined targets and KPIs", raciData: { "Change": "A/R", "BA Lead": "C", "Customer PO": "R", "PM": "C", "Data Owner": "C" }, sortOrder: 0 },
      { name: "Outcome Measurement Results", description: "Measured business outcomes compared against baseline values", raciData: { "BA Lead": "A/R", "Data Owner": "R", "Customer PO": "R", "PM": "C", "Change": "C" }, sortOrder: 1 },
      { name: "User Satisfaction Assessment", description: "Survey results and feedback from end-users on solution effectiveness", raciData: { "Change": "A/R", "Customer PO": "R", "BA Lead": "C", "PM": "I" }, sortOrder: 2 },
      { name: "Issue Resolution Report", description: "Status of all outstanding issues with resolution plans and timelines", raciData: { "PM": "A/R", "Delivery Lead": "R", "Solution Architect": "C", "Customer PO": "C" }, sortOrder: 3 },
      { name: "Value Realization Report (draft)", description: "Draft report documenting realized business value against original investment thesis", raciData: { "BA Lead": "A/R", "PM": "R", "Customer Sponsor": "C", "Finance": "C", "Change": "C" }, sortOrder: 4 },
      { name: "Lessons Learned", description: "Documented lessons learned from the engagement for future improvement", raciData: { "PM": "A/R", "Delivery Lead": "R", "Customer PO": "C", "BA Lead": "C", "Change": "C" }, sortOrder: 5 },
      { name: "Evolution Opportunities", description: "Identified opportunities for further value creation and solution enhancement", raciData: { "Sales Owner (AE)": "A", "BA Lead": "R", "Solution Architect": "C", "Customer Sponsor": "C", "Customer PO": "R", "Change": "C" }, sortOrder: 6 },
    ],
  },
  {
    stageNumber: 4,
    name: "Value Realization & Evolution",
    goal: "Confirm value delivery and decide on next steps",
    description: "Finalize value realization assessment, transition to operations, and make strategic decisions about future evolution of the solution.",
    gateName: "Gate 5: Evolution Decision",
    gateDescription: "Value realization confirmed with evidence; Operational transition complete; Support handover finalized; Strategic roadmap for evolution agreed; Commercial terms for next phase defined (if applicable)",
    playbookPurpose: "Confirm value, transition to operations, and plan evolution",
    playbookExitBundle: "Final Value Realization Report, Operational Transition Checklist, Support Handover Documentation, Strategic Roadmap, Next Phase Commercial Terms",
    sortOrder: 4,
    deliverables: [
      { name: "Final Value Realization Report", description: "Comprehensive report confirming business value delivered against original investment thesis", raciData: { "BA Lead": "A/R", "PM": "R", "Customer Sponsor": "A", "Finance": "C", "Change": "C", "Data Owner": "C" }, sortOrder: 0 },
      { name: "Operational Transition Checklist", description: "Verified checklist confirming all operational handover items are complete", raciData: { "PM": "A/R", "Delivery Lead": "R", "Customer IT/EA": "R", "Solution Architect": "C" }, sortOrder: 1 },
      { name: "Support Handover Documentation", description: "Complete support documentation including runbooks, contacts, and SLAs", raciData: { "Delivery Lead": "A/R", "Solution Architect": "R", "Customer IT/EA": "R", "PM": "C" }, sortOrder: 2 },
      { name: "Strategic Roadmap", description: "Forward-looking roadmap for solution evolution and capability enhancement", raciData: { "Sales Owner (AE)": "A", "Solution Architect": "R", "Customer Sponsor": "A", "Customer PO": "R", "BA Lead": "C" }, sortOrder: 3 },
      { name: "Next Phase Commercial Terms", description: "Commercial framework for continued engagement or evolution phase", raciData: { "Sales Owner (AE)": "A/R", "Finance": "R", "Customer Sponsor": "A", "PM": "C", "Delivery Lead": "C" }, sortOrder: 4 },
    ],
  },
];

const SEED_VERSION = 2;

export async function reseedStage0(tenantId: string = "default"): Promise<void> {
  const existing = await db.select().from(flightpathStages).where(
    and(eq(flightpathStages.tenantId, tenantId), eq(flightpathStages.stageNumber, 0))
  );
  if (existing.length === 0) return;

  const stage0 = existing[0];
  const stage0Data = STAGES.find(s => s.stageNumber === 0)!;

  await db.delete(flightpathDeliverables).where(eq(flightpathDeliverables.stageId, stage0.id));

  await db.update(flightpathStages).set({
    name: stage0Data.name,
    goal: stage0Data.goal,
    description: stage0Data.description,
    gateName: stage0Data.gateName,
    gateDescription: stage0Data.gateDescription,
    playbookPurpose: stage0Data.playbookPurpose,
    playbookExitBundle: stage0Data.playbookExitBundle,
  }).where(eq(flightpathStages.id, stage0.id));

  for (const del of stage0Data.deliverables) {
    await db.insert(flightpathDeliverables).values({
      stageId: stage0.id,
      name: del.name,
      description: del.description,
      raciData: del.raciData,
      sortOrder: del.sortOrder,
    });
  }

  console.log(`Stage 0 re-seeded with ${stage0Data.deliverables.length} pre-sales deliverables for tenant "${tenantId}"`);
}

async function ensureDefaultOperatingModel(tenantId: string): Promise<string> {
  const existing = await db.select().from(operatingModels).where(eq(operatingModels.tenantId, tenantId));
  if (existing.length > 0) return existing[0].id;
  const [model] = await db.insert(operatingModels).values({
    tenantId,
    name: "Operating Model",
    status: "active",
  }).returning();
  return model.id;
}

export async function seedFlightpathData(tenantId: string = "default"): Promise<void> {
  const existing = await db.select().from(flightpathStages).where(eq(flightpathStages.tenantId, tenantId));
  if (existing.length > 0) {
    const modelId = await ensureDefaultOperatingModel(tenantId);
    const unattached = existing.filter(s => !s.operatingModelId);
    for (const stage of unattached) {
      await db.update(flightpathStages).set({ operatingModelId: modelId }).where(eq(flightpathStages.id, stage.id));
    }
    const stage0 = existing.find(s => s.stageNumber === 0);
    if (stage0 && stage0.name !== "Pre-Sales Value + Scope Lock") {
      console.log(`Updating Stage 0 to pre-sales format for tenant "${tenantId}"...`);
      await reseedStage0(tenantId);
    } else {
      console.log(`Governance stages already seeded for tenant "${tenantId}"`);
    }
    return;
  }

  console.log(`Seeding governance stages for tenant "${tenantId}"...`);

  const modelId = await ensureDefaultOperatingModel(tenantId);

  for (const stageData of STAGES) {
    const [stage] = await db.insert(flightpathStages).values({
      tenantId,
      operatingModelId: modelId,
      stageNumber: stageData.stageNumber,
      name: stageData.name,
      goal: stageData.goal,
      description: stageData.description,
      gateName: stageData.gateName,
      gateDescription: stageData.gateDescription,
      playbookPurpose: stageData.playbookPurpose,
      playbookExitBundle: stageData.playbookExitBundle,
      sortOrder: stageData.sortOrder,
    }).returning();

    for (const del of stageData.deliverables) {
      await db.insert(flightpathDeliverables).values({
        stageId: stage.id,
        name: del.name,
        description: del.description,
        raciData: del.raciData,
        sortOrder: del.sortOrder,
      });
    }
  }

  console.log(`Governance seeding complete: ${STAGES.length} stages with deliverables`);
}
