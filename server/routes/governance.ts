import type { Express } from "express";
import OpenAI from "openai";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";
import { calculateEVMForWeek } from "../evm-engine";
import { listFilesInFolder, getFileMetadata, getFileContent } from "../google-drive";

export function registerGovernanceRoutes(app: Express) {
  app.get("/api/flightpath-stages", async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const stages = await storage.getFlightpathStages(tenantId);
      const sorted = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const result = [];
      for (const stage of sorted) {
        const deliverables = await storage.getStageDeliverables(stage.id, tenantId);
        result.push({ ...stage, deliverables: deliverables.sort((a, b) => a.sortOrder - b.sortOrder) });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const stage = await storage.createFlightpathStage({ ...req.body, tenantId: req.tenantId || "default" });
      res.status(201).json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-stages/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const stage = await storage.updateFlightpathStage(req.params.id, req.tenantId || "default", req.body);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-stages/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteFlightpathStage(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/flightpath-stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getStageDeliverables(req.params.stageId, req.tenantId || "default");
      res.json(deliverables.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/flightpath-stages/:stageId/deliverables", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const deliverable = await storage.createDeliverable({ ...req.body, stageId: req.params.stageId, tenantId: req.tenantId || "default" });
      res.status(201).json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flightpath-deliverables/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const deliverable = await storage.updateDeliverable(req.params.id, req.tenantId || "default", req.body);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      res.json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flightpath-deliverables/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteDeliverable(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/governance-model/stages", async (req, res) => {
    try {
      const tenantId = req.tenantId || "default";
      const stages = await storage.getFlightpathStages(tenantId);
      const sorted = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const result = [];
      for (const stage of sorted) {
        const deliverables = await storage.getStageDeliverables(stage.id, tenantId);
        result.push({ ...stage, deliverables: deliverables.sort((a, b) => a.sortOrder - b.sortOrder) });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/governance-model/stages", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const stage = await storage.createFlightpathStage({ ...req.body, tenantId: req.tenantId || "default" });
      res.status(201).json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.patch("/api/governance-model/stages/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const stage = await storage.updateFlightpathStage(req.params.id, req.tenantId || "default", req.body);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/governance-model/stages/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteFlightpathStage(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.get("/api/governance-model/stages/:stageId/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getStageDeliverables(req.params.stageId, req.tenantId || "default");
      res.json(deliverables.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/governance-model/stages/:stageId/deliverables", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const deliverable = await storage.createDeliverable({ ...req.body, stageId: req.params.stageId, tenantId: req.tenantId || "default" });
      res.status(201).json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.patch("/api/governance-model/deliverables/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const deliverable = await storage.updateDeliverable(req.params.id, req.tenantId || "default", req.body);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      res.json(deliverable);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/governance-model/deliverables/:id", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteDeliverable(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/checkpoints", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const stageId = req.query.stageId as string | undefined;
      const checkpoints = stageId
        ? await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default")
        : await storage.getProjectCheckpoints(req.params.id, req.tenantId || "default");
      res.json(checkpoints);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/checkpoints", requireModuleAccess("projects"), requirePermission("project.edit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const checkpoint = await storage.createProjectCheckpoint({ ...req.body, timelineId: req.params.id, tenantId: req.tenantId || "default" });
      res.status(201).json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/checkpoints/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      const data = { ...req.body };
      if (typeof data.completedAt === "string") {
        data.completedAt = new Date(data.completedAt);
      }
      if (typeof data.artifactVerifiedAt === "string") {
        data.artifactVerifiedAt = new Date(data.artifactVerifiedAt);
      }
      const checkpoint = await storage.updateProjectCheckpoint(req.params.id, req.tenantId || "default", data);
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });
      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/checkpoints/:id", requirePermission("project.edit"), async (req, res) => {
    try {
      await storage.deleteProjectCheckpoint(req.params.id, req.tenantId || "default");
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/gates", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
      res.json(gates);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/gates", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const gate = await storage.createProjectGate({ ...req.body, timelineId: req.params.id, tenantId: req.tenantId || "default" });
      res.status(201).json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/gates/:id", requirePermission("gate.approve"), async (req, res) => {
    try {
      const gate = await storage.updateProjectGate(req.params.id, req.tenantId || "default", req.body);
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      res.json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/request-exception", requirePermission("gate.submit"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId, notes } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });
      if (!notes || !notes.trim()) return res.status(400).json({ message: "Justification notes are required" });
      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      if (!allStages.some(s => s.id === stageId)) return res.status(400).json({ message: "Invalid stageId for this governance model" });
      let gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) {
        gate = await storage.createProjectGate({ timelineId: req.params.id, stageId, status: "exception_requested", notes: notes.trim(), tenantId: req.tenantId || "default" });
      } else {
        gate = await storage.updateProjectGate(gate.id, req.tenantId || "default", { status: "exception_requested", notes: notes.trim() }) || gate;
      }
      res.json(gate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/approve-exception", requirePermission("gate.approve"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId, approved, notes } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });
      if (typeof approved !== "boolean") return res.status(400).json({ message: "approved (boolean) is required" });
      const gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      if (gate.status !== "exception_requested") return res.status(400).json({ message: "Gate is not in exception_requested status" });
      const updatedGate = await storage.updateProjectGate(gate.id, req.tenantId || "default", {
        status: approved ? "exception" : "failed",
        notes: notes ? `${gate.notes || ""}\n---\nReviewer: ${approved ? "Approved" : "Rejected"}${notes ? ` — ${notes}` : ""}`.trim() : gate.notes,
      });
      res.json(updatedGate);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/initialize-stage", requireModuleAccess("projects"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const existing = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      if (existing.length > 0) {
        return res.json({ message: "Stage already initialized", checkpoints: existing });
      }

      const deliverables = await storage.getStageDeliverables(stageId, req.tenantId || "default");
      const checkpoints = [];
      for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const cp = await storage.createProjectCheckpoint({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          stageId,
          deliverableId: d.id,
          checkpointName: d.name,
          completed: false,
        });
        checkpoints.push(cp);
      }

      res.status(201).json({ message: "Stage initialized", checkpoints });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/advance-stage", requirePermission("gate.submit"), async (req, res) => {
    try {
      const { nextStageId } = req.body;
      if (!nextStageId) return res.status(400).json({ message: "nextStageId is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const allStages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = allStages.sort((a, b) => a.stageNumber - b.stageNumber);
      const nextStage = sortedStages.find(s => s.id === nextStageId);
      if (!nextStage) return res.status(400).json({ message: "Invalid stage" });

      if (!timeline.flightpathStageId) {
        if (nextStage.stageNumber !== sortedStages[0]?.stageNumber) {
          return res.status(400).json({ message: "Must start at the first stage" });
        }
      } else {
        const currentStage = sortedStages.find(s => s.id === timeline.flightpathStageId);
        if (!currentStage) return res.status(400).json({ message: "Current stage not found" });

        if (nextStage.stageNumber !== currentStage.stageNumber + 1) {
          return res.status(400).json({ message: "Can only advance to the next sequential stage" });
        }

        const gates = await storage.getProjectGates(req.params.id, req.tenantId || "default");
        const currentGate = gates.find(g => g.stageId === timeline.flightpathStageId);
        if (!currentGate || (currentGate.status !== "passed" && currentGate.status !== "exception")) {
          return res.status(400).json({ message: "Gate for the current stage must be passed or have an approved exception before advancing" });
        }
      }

      const updated = await storage.updateTimeline(req.params.id, req.tenantId || "default", { flightpathStageId: nextStageId });

      try {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 0 : 7 - day;
        const weekEndDate = new Date(now);
        weekEndDate.setDate(weekEndDate.getDate() + diff);
        const weekEnding = weekEndDate.toISOString().slice(0, 10);

        const currentStage = sortedStages.find(s => s.id === timeline.flightpathStageId);
        const stageName = currentStage ? `Stage ${currentStage.stageNumber}` : "Stage";

        const evmResult = await calculateEVMForWeek(req.params.id, weekEnding, req.tenantId || "default");
        await storage.createEvmSnapshot({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          weekEnding,
          mode: "gate_freeze",
          bac: String(evmResult.bac),
          plannedValue: String(evmResult.plannedValue),
          actualCost: String(evmResult.actualCost),
          earnedValue: String(evmResult.earnedValue),
          scheduleVariance: String(evmResult.scheduleVariance),
          costVariance: String(evmResult.costVariance),
          spiValue: String(evmResult.spiValue),
          cpiValue: String(evmResult.cpiValue),
          eacValue: String(evmResult.eacValue),
          etcValue: String(evmResult.etcValue),
          vacValue: String(evmResult.vacValue),
          weeklyPv: String(evmResult.weeklyPv),
          weeklyAc: String(evmResult.weeklyAc),
          weeklyEv: String(evmResult.weeklyEv),
          workstreamBreakdown: evmResult.workstreamBreakdown,
          inputsHash: evmResult.inputsHash,
          notes: `Auto-generated on ${stageName} gate approval`,
          generatedBy: (req as any).user?.id || null,
          generatedAt: new Date(),
        });

        await storage.createAuditEntry({
          tenantId: req.tenantId || "default",
          actorUserId: (req as any).user?.id || "system",
          action: "evm.snapshot_generated",
          objectType: "project",
          objectId: req.params.id,
          metadata: { weekEnding, mode: "gate_freeze", stageName },
        });
      } catch (evmErr: any) {
        console.error("Gate auto-freeze EVM snapshot failed (non-blocking):", evmErr.message);
      }

      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/evaluate-gate", requirePermission("gate.submit"), async (req, res) => {
    try {
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const stage = await storage.getFlightpathStage(stageId, req.tenantId || "default");
      if (!stage) return res.status(404).json({ message: "Stage not found" });

      const allCheckpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      const optionalCount = allCheckpoints.filter(c => c.optional).length;
      const checkpoints = allCheckpoints.filter(c => !c.optional);
      const totalCheckpoints = checkpoints.length;
      const completedCheckpoints = checkpoints.filter(c => c.completed).length;
      const missingItems = checkpoints.filter(c => !c.completed).map(c => c.checkpointName);

      const raidItems = await storage.getRisks(req.params.id, req.tenantId || "default");
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
          const allAllocations = await storage.getAllocationsByTimeline(req.params.id, req.tenantId || "default");
          const tsEntries = await storage.getTimesheetEntries(req.tenantId || "default", { timelineId: req.params.id });
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

      let gate = await storage.getProjectGate(req.params.id, stageId, req.tenantId || "default");
      if (!gate) {
        gate = await storage.createProjectGate({
          tenantId: req.tenantId || "default",
          timelineId: req.params.id,
          stageId,
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
        });
      } else {
        gate = await storage.updateProjectGate(gate.id, req.tenantId || "default", {
          status: evaluatorResult.status === "pass" ? "passed" : "failed",
          evaluatorResult,
          approvedAt: evaluatorResult.status === "pass" ? new Date() : null,
        });
      }

      res.json({ gate, evaluatorResult });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/artifacts", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      if (!timeline.docRepositoryType || !timeline.docRepositoryFolderId) {
        return res.status(400).json({ message: "No document repository configured for this project" });
      }

      if (timeline.docRepositoryType === "google_drive") {
        const files = await listFilesInFolder(timeline.docRepositoryFolderId);
        return res.json(files);
      }

      return res.status(400).json({ message: `Unsupported repository type: ${timeline.docRepositoryType}` });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/link-artifact", requireModuleAccess("projects"), requirePermission("artifacts.manage"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { checkpointId, fileId, fileName, fileUrl } = req.body;
      if (!checkpointId || !fileName) {
        return res.status(400).json({ message: "checkpointId and fileName are required" });
      }

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, req.tenantId || "default", {
        artifactUrl: fileUrl || null,
        artifactFileId: fileId || null,
        artifactFileName: fileName,
        artifactVerified: false,
        artifactVerifiedAt: null,
        artifactSummary: null,
      });
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/timelines/:id/unlink-artifact", requireModuleAccess("projects"), requirePermission("artifacts.manage"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { checkpointId } = req.body;
      if (!checkpointId) return res.status(400).json({ message: "checkpointId is required" });

      const checkpoint = await storage.updateProjectCheckpoint(checkpointId, req.tenantId || "default", {
        artifactUrl: null,
        artifactFileId: null,
        artifactFileName: null,
        artifactVerified: false,
        artifactVerifiedAt: null,
        artifactSummary: null,
      });
      if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

      res.json(checkpoint);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/timelines/:id/verify-artifacts", requireModuleAccess("projects"), requirePermission("artifacts.manage"), async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ message: "stageId is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const checkpoints = await storage.getProjectCheckpointsByStage(req.params.id, stageId, req.tenantId || "default");
      const checkpointsWithArtifacts = checkpoints.filter(c => c.artifactFileId || c.artifactUrl || c.artifactFileName);

      if (checkpointsWithArtifacts.length === 0) {
        return res.json({ verified: 0, total: checkpoints.length, results: [] });
      }

      const stage = await storage.getFlightpathStage(stageId, req.tenantId || "default");
      const deliverables = await storage.getStageDeliverables(stageId, req.tenantId || "default");

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const results: Array<{ checkpointId: string; checkpointName: string; verified: boolean; summary: string }> = [];

      for (const cp of checkpointsWithArtifacts) {
        let fileContent: string | null = null;
        let fileMetadata: any = null;

        if (timeline.docRepositoryType === "google_drive") {
          const fId = cp.artifactFileId || null;
          if (fId) {
            try {
              fileMetadata = await getFileMetadata(fId);
              fileContent = await getFileContent(fId, fileMetadata.mimeType);
            } catch (e) {
              console.error(`Failed to read file for checkpoint ${cp.id}:`, e);
            }
          }
        }

        const deliverable = deliverables.find(d => d.id === cp.deliverableId);

        const verifyPrompt = `You are a governance artifact reviewer. Evaluate whether this document satisfies the deliverable requirement.

Deliverable: ${cp.checkpointName}
${deliverable?.description ? `Description: ${deliverable.description}` : ""}
Stage: ${stage?.name || "Unknown"} (Stage ${stage?.stageNumber ?? "?"})

Artifact File: ${cp.artifactFileName || "Unknown"}
${fileMetadata ? `File Type: ${fileMetadata.mimeType}` : ""}
${fileMetadata ? `Last Modified: ${fileMetadata.modifiedTime}` : ""}
${fileContent ? `\nFile Content (excerpt):\n${fileContent.substring(0, 5000)}` : "\n(File content not accessible — evaluate based on file name and metadata only)"}

Assess:
1. Does the file name and type seem appropriate for this deliverable?
2. If content is available, does it adequately cover the deliverable requirements?
3. Provide a brief summary of what the artifact contains or appears to contain.

Respond ONLY with valid JSON:
{
  "verified": true or false,
  "summary": "Brief assessment of the artifact (2-3 sentences)",
  "concerns": ["any specific concerns or gaps"] 
}`;

        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [{ role: "user", content: verifyPrompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          });

          let result;
          try {
            result = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");
          } catch {
            result = { verified: false, summary: "AI verification parsing failed", concerns: [] };
          }

          const summary = result.summary + (result.concerns?.length > 0 ? `\nConcerns: ${result.concerns.join("; ")}` : "");

          await storage.updateProjectCheckpoint(cp.id, req.tenantId || "default", {
            artifactVerified: result.verified === true,
            artifactVerifiedAt: new Date(),
            artifactSummary: summary,
          });

          results.push({
            checkpointId: cp.id,
            checkpointName: cp.checkpointName,
            verified: result.verified === true,
            summary,
          });
        } catch (e: any) {
          results.push({
            checkpointId: cp.id,
            checkpointName: cp.checkpointName,
            verified: false,
            summary: `Verification failed: ${e.message}`,
          });
        }
      }

      res.json({
        verified: results.filter(r => r.verified).length,
        total: checkpoints.length,
        withArtifacts: checkpointsWithArtifacts.length,
        results,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
