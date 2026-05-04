import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { checkTimelineAccess } from "./helpers";
import { calculateEVMForWeek } from "../evm-engine";

export function registerEvmRoutes(app: Express) {
  app.post("/api/timelines/:id/freeze-week", requirePermission("project.edit"), async (req, res) => {
    try {
      const { weekEnding, notes } = req.body;
      if (!weekEnding) return res.status(400).json({ message: "weekEnding is required" });

      const timeline = await storage.getTimeline(req.params.id, req.tenantId || "default");
      if (!timeline) return res.status(404).json({ message: "Timeline not found" });

      const evmResult = await calculateEVMForWeek(req.params.id, weekEnding, req.tenantId || "default");

      const snapshot = await storage.createEvmSnapshot({
        tenantId: req.tenantId || "default",
        timelineId: req.params.id,
        weekEnding,
        mode: "manual_freeze",
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
        notes: notes || null,
        generatedBy: (req as any).user?.id || null,
        generatedAt: new Date(),
      });

      await storage.createAuditEntry({
        tenantId: req.tenantId || "default",
        actorUserId: (req as any).user?.id || "system",
        action: "evm.snapshot_generated",
        objectType: "project",
        objectId: req.params.id,
        metadata: { weekEnding, version: snapshot.version, mode: "manual_freeze" },
      });

      res.json(snapshot);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots", async (req, res) => {
    try {
      if (!(await checkTimelineAccess(req, res, req.params.id))) return;
      const snapshots = await storage.getEvmSnapshots(req.params.id, req.tenantId || "default");
      res.json(snapshots);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots/:weekEnding", async (req, res) => {
    try {
      const snapshot = await storage.getEvmSnapshot(req.params.id, req.params.weekEnding, req.tenantId || "default");
      if (!snapshot) return res.status(404).json({ message: "Snapshot not found" });
      res.json(snapshot);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/timelines/:id/evm-snapshots/:weekEnding/versions", async (req, res) => {
    try {
      const versions = await storage.getEvmSnapshotAllVersions(req.params.id, req.params.weekEnding, req.tenantId || "default");
      res.json(versions);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/timelines/:id/evm-snapshots/:snapshotId", requirePermission("org.settings.manage"), async (req, res) => {
    try {
      await storage.deleteEvmSnapshot(req.params.snapshotId, req.tenantId || "default");

      await storage.createAuditEntry({
        tenantId: req.tenantId || "default",
        actorUserId: (req as any).user?.id || "system",
        action: "evm.snapshot_deleted",
        objectType: "project",
        objectId: req.params.id,
        metadata: { snapshotId: req.params.snapshotId },
      });

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/audit-log", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const action = req.query.action as string | undefined;
      const entries = await storage.getAuditLog(req.tenantId || "default", { action, limit, offset });
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
