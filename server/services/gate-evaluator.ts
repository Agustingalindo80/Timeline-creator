import OpenAI from "openai";
import { storage } from "../storage";

interface GateEvaluationResult {
  gate: any;
  evaluatorResult: any;
}

export async function evaluateGate(
  timelineId: string,
  stageId: string,
  tenantId: string
): Promise<GateEvaluationResult> {
  const stage = await storage.getFlightpathStage(stageId, tenantId);
  if (!stage) throw Object.assign(new Error("Stage not found"), { statusCode: 404 });

  const allCheckpoints = await storage.getProjectCheckpointsByStage(timelineId, stageId, tenantId);
  const optionalCount = allCheckpoints.filter(c => c.optional).length;
  const checkpoints = allCheckpoints.filter(c => !c.optional);
  const totalCheckpoints = checkpoints.length;
  const completedCheckpoints = checkpoints.filter(c => c.completed).length;
  const missingItems = checkpoints.filter(c => !c.completed).map(c => c.checkpointName);

  const raidItems = await storage.getRisks(timelineId, tenantId);
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
      const allAllocations = await storage.getAllocationsByTimeline(timelineId, tenantId);
      const tsEntries = await storage.getTimesheetEntries(tenantId, { timelineId });
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

  let gate = await storage.getProjectGate(timelineId, stageId, tenantId);
  if (!gate) {
    gate = await storage.createProjectGate({
      tenantId,
      timelineId,
      stageId,
      status: evaluatorResult.status === "pass" ? "passed" : "failed",
      evaluatorResult,
    });
  } else {
    gate = await storage.updateProjectGate(gate.id, tenantId, {
      status: evaluatorResult.status === "pass" ? "passed" : "failed",
      evaluatorResult,
      approvedAt: evaluatorResult.status === "pass" ? new Date() : null,
    });
  }

  return { gate, evaluatorResult };
}
