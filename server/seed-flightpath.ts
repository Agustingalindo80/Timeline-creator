import { db } from "./db";
import { flightpathStages, flightpathDeliverables } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    name: "Value Framing",
    goal: "Turn a sales pursuit into an investment-grade initiative",
    description: "Establish the business case, define measurable outcomes, identify stakeholders, and prepare a governed path to Stage 1.",
    gateName: "Gate 1: Value Approval",
    gateDescription: "Outcomes + KPIs agreed and measurable; Baseline method defined; Sponsor commits time/resources/governance; Phasing + in/out scope explicit; Major risks/deps have owners; Stage 1 kickoff scheduled with named participants",
    playbookPurpose: "Clear outcomes, measurable KPIs, realistic options, governed path to Stage 1",
    playbookExitBundle: "Value Narrative, Business Outcomes Pack, Baseline/Measurement Plan, Option Set A/B, Assumptions/Dependencies/Risks log, ROM Estimate, Governance Proposal, Stage 1 Readiness Plan",
    sortOrder: 0,
    deliverables: [
      { name: "Value Narrative (1-2 pages)", description: "Articulates the strategic value proposition and investment thesis", raciData: { "Sales Owner (AE)": "A/R", "Pre-Sales": "R", "Delivery Lead": "C", "Solution Architect": "C", "BA Lead": "C", "PM": "I", "Finance": "C", "Customer Sponsor": "A", "Customer PO": "C", "Customer IT/EA": "I", "Data Owner": "I", "Change": "C" }, sortOrder: 0 },
      { name: "Business Outcomes Pack (3-7 outcomes)", description: "Defines 3-7 measurable business outcomes the initiative will deliver", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "C", "Delivery Lead": "C", "Solution Architect": "C", "BA Lead": "R", "PM": "C", "Finance": "I", "Customer Sponsor": "A", "Customer PO": "R", "Customer IT/EA": "C", "Data Owner": "C", "Change": "C" }, sortOrder: 1 },
      { name: "KPI Definitions + Targets", description: "Quantified KPIs with baseline and target values for each outcome", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "C", "Solution Architect": "C", "BA Lead": "R", "PM": "C", "Finance": "I", "Customer Sponsor": "A", "Customer PO": "R", "Customer IT/EA": "C", "Data Owner": "R", "Change": "C" }, sortOrder: 2 },
      { name: "Baseline Method + Data Sources", description: "How baselines will be measured and which data sources will be used", raciData: { "Sales Owner (AE)": "I", "Pre-Sales": "C", "Solution Architect": "C", "BA Lead": "C", "PM": "C", "Finance": "I", "Customer Sponsor": "A", "Customer PO": "C", "Customer IT/EA": "C", "Data Owner": "A/R", "Change": "C" }, sortOrder: 3 },
      { name: "Scope Boundaries (in/out) + MVP hypothesis", description: "Explicit in/out scope definition with MVP hypothesis", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "R", "Delivery Lead": "R", "Solution Architect": "C", "BA Lead": "R", "PM": "C", "Finance": "C", "Customer Sponsor": "A", "Customer PO": "R", "Customer IT/EA": "C", "Data Owner": "I", "Change": "C" }, sortOrder: 4 },
      { name: "Option Set (A/B) with tradeoffs & phasing", description: "At least two delivery options with cost/benefit tradeoffs", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "R", "Delivery Lead": "R", "Solution Architect": "R", "BA Lead": "C", "PM": "C", "Finance": "C", "Customer Sponsor": "A", "Customer PO": "C", "Customer IT/EA": "C", "Data Owner": "I", "Change": "C" }, sortOrder: 5 },
      { name: "High-Level Architecture + Integration/Env overview", description: "Solution architecture, integration points, and environment landscape", raciData: { "Sales Owner (AE)": "I", "Pre-Sales": "C", "Solution Architect": "A/R", "BA Lead": "C", "PM": "I", "Finance": "I", "Customer Sponsor": "I", "Customer PO": "I", "Customer IT/EA": "C/R", "Data Owner": "C", "Change": "I" }, sortOrder: 6 },
      { name: "Assumptions, Dependencies, Constraints log", description: "Initial RAID log capturing known assumptions, dependencies, and constraints", raciData: { "Sales Owner (AE)": "C", "Pre-Sales": "C", "Delivery Lead": "A/R", "Solution Architect": "R", "BA Lead": "R", "PM": "R", "Finance": "C", "Customer Sponsor": "I", "Customer PO": "C", "Customer IT/EA": "C", "Data Owner": "C", "Change": "C" }, sortOrder: 7 },
      { name: "High-level Estimate (ROM) + commercial model", description: "Rough order of magnitude estimate with commercial/pricing model", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "R", "Delivery Lead": "R", "Solution Architect": "C", "BA Lead": "C", "PM": "C", "Finance": "A/R", "Customer Sponsor": "I", "Customer PO": "I", "Customer IT/EA": "C", "Data Owner": "I", "Change": "I" }, sortOrder: 8 },
      { name: "Delivery Approach (waves, timeline, quality gates)", description: "Proposed delivery methodology, wave structure, and quality gates", raciData: { "Sales Owner (AE)": "I", "Pre-Sales": "C", "Delivery Lead": "A/R", "Solution Architect": "R", "BA Lead": "C", "PM": "R", "Finance": "I", "Customer Sponsor": "I", "Customer PO": "I", "Customer IT/EA": "C", "Data Owner": "I", "Change": "C" }, sortOrder: 9 },
      { name: "Governance Proposal (cadence, forums, roles)", description: "Governance structure including meeting cadence, decision forums, and role definitions", raciData: { "Sales Owner (AE)": "C", "Pre-Sales": "I", "Delivery Lead": "A/R", "Solution Architect": "C", "BA Lead": "C", "PM": "R", "Finance": "I", "Customer Sponsor": "A", "Customer PO": "C", "Customer IT/EA": "C", "Data Owner": "I", "Change": "C" }, sortOrder: 10 },
      { name: "Adoption Risk Snapshot + early enablement approach", description: "Assessment of adoption risks and initial enablement strategy", raciData: { "Sales Owner (AE)": "I", "Pre-Sales": "C", "Delivery Lead": "C", "Solution Architect": "I", "BA Lead": "C", "PM": "C", "Finance": "I", "Customer Sponsor": "A", "Customer PO": "C", "Customer IT/EA": "I", "Data Owner": "I", "Change": "A/R" }, sortOrder: 11 },
      { name: "Stage 1 Readiness Plan", description: "Plan to prepare for structured initiation including resource needs and timeline", raciData: { "Sales Owner (AE)": "A", "Pre-Sales": "C", "Delivery Lead": "R", "Solution Architect": "C", "BA Lead": "R", "PM": "A/R", "Finance": "I", "Customer Sponsor": "C", "Customer PO": "C", "Customer IT/EA": "C", "Data Owner": "C", "Change": "C" }, sortOrder: 12 },
      { name: "Gate 1 Decision Package", description: "Compiled package of all Stage 0 deliverables for gate review", raciData: { "Sales Owner (AE)": "A/R", "Pre-Sales": "R", "Delivery Lead": "R", "Solution Architect": "C", "BA Lead": "R", "PM": "R", "Finance": "C", "Customer Sponsor": "A", "Customer PO": "I", "Customer IT/EA": "I", "Data Owner": "I", "Change": "I" }, sortOrder: 13 },
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

export async function seedFlightpathData(tenantId: string = "default"): Promise<void> {
  const existing = await db.select().from(flightpathStages).where(eq(flightpathStages.tenantId, tenantId));
  if (existing.length > 0) {
    console.log(`FlightPath stages already seeded for tenant "${tenantId}"`);
    return;
  }

  console.log(`Seeding FlightPath stages for tenant "${tenantId}"...`);

  for (const stageData of STAGES) {
    const [stage] = await db.insert(flightpathStages).values({
      tenantId,
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

  console.log(`FlightPath seeding complete: ${STAGES.length} stages with deliverables`);
}
