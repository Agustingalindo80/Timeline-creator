import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";
import { calculateEVMForWeek } from "../evm-engine";
import { listFilesInFolder } from "../google-drive";
import { evaluateGate } from "../services/gate-evaluator";
import { verifyArtifacts } from "../services/artifact-verification";

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

      const result = await evaluateGate(req.params.id, stageId, req.tenantId || "default");
      res.json(result);
    } catch (err: any) { res.status(err.statusCode || 500).json({ message: err.message }); }
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

      const result = await verifyArtifacts(req.params.id, stageId, req.tenantId || "default");
      res.json(result);
    } catch (err: any) { res.status(err.statusCode || 500).json({ message: err.message }); }
  });
}
