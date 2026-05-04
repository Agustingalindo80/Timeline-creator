import * as XLSX from "xlsx";
import { storage } from "../storage";

interface ImportResult {
  phasesCreated: number;
  workstreamsCreated: number;
  resourcesCreated: number;
  rowsSkipped: number;
  totalRows: number;
}

export async function importEstimate(
  fileBuffer: Buffer,
  timelineId: string,
  tenantId: string
): Promise<ImportResult> {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) throw Object.assign(new Error("Timeline not found"), { statusCode: 404 });

  const wb = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw Object.assign(new Error("No data found in file"), { statusCode: 400 });

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) throw Object.assign(new Error("Template is empty"), { statusCode: 400 });

  const allRateCards = await storage.getRateCards(tenantId);
  const rcByName = new Map<string, any>();
  for (const rc of allRateCards) {
    if (rc.name) rcByName.set(rc.name.toLowerCase().trim(), rc);
    if (rc.role) rcByName.set(rc.role.toLowerCase().trim(), rc);
  }

  const existingTasks = await storage.getTasksByTimeline(timelineId, tenantId);
  const existingPhases = existingTasks.filter(t => t.itemType === "phase");
  const existingWorkstreams = existingTasks.filter(t => t.itemType === "workstream");

  const phaseMap = new Map<string, string>();
  for (const p of existingPhases) {
    phaseMap.set(p.title.toLowerCase().trim(), p.id);
  }

  const wsMap = new Map<string, string>();
  for (const ws of existingWorkstreams) {
    const key = `${ws.parentTaskId}::${ws.title.toLowerCase().trim()}`;
    wsMap.set(key, ws.id);
  }

  let phasesCreated = 0, workstreamsCreated = 0, resourcesCreated = 0, rowsSkipped = 0;
  let phaseSortOrder = existingPhases.length;

  const wsCountByPhase = new Map<string, number>();
  for (const ws of existingWorkstreams) {
    if (ws.parentTaskId) {
      wsCountByPhase.set(ws.parentTaskId, (wsCountByPhase.get(ws.parentTaskId) || 0) + 1);
    }
  }

  for (const row of rows) {
    const phaseName = String(row["Phase"] || "").trim();
    const wsName = String(row["Workstream"] || "").trim();
    const roleName = String(row["Role / Rate Card"] || "").trim();

    if (!phaseName || !wsName) { rowsSkipped++; continue; }

    let phaseId = phaseMap.get(phaseName.toLowerCase());
    if (!phaseId) {
      const phase = await storage.createTask({
        tenantId,
        timelineId,
        title: phaseName,
        itemType: "phase",
        sortOrder: phaseSortOrder++,
      });
      phaseId = phase.id;
      phaseMap.set(phaseName.toLowerCase(), phaseId);
      wsCountByPhase.set(phaseId, 0);
      phasesCreated++;
    }

    const wsKey = `${phaseId}::${wsName.toLowerCase()}`;
    let wsId = wsMap.get(wsKey);
    if (!wsId) {
      const duration = parseFloat(String(row["Duration (Weeks)"] || "0")) || null;
      const confidence = String(row["Confidence"] || "medium").toLowerCase().trim();
      const validConfidence = ["high", "medium", "low"].includes(confidence) ? confidence : "medium";
      const count = wsCountByPhase.get(phaseId) || 0;
      const ws = await storage.createTask({
        tenantId,
        timelineId,
        title: wsName,
        itemType: "workstream",
        parentTaskId: phaseId,
        sortOrder: count,
        durationWeeks: duration ? String(duration) : null,
        confidenceLevel: validConfidence,
      });
      wsId = ws.id;
      wsMap.set(wsKey, wsId);
      wsCountByPhase.set(phaseId, count + 1);
      workstreamsCreated++;
    }

    if (roleName) {
      const rc = rcByName.get(roleName.toLowerCase().trim());
      if (rc) {
        const hpw = parseFloat(String(row["Hours Per Week"] || "0")) || 0;
        const taskType = String(row["Task Type"] || "technical").toLowerCase().trim();
        const validTaskType = ["pm", "functional", "technical", "qa"].includes(taskType) ? taskType : "technical";
        if (hpw > 0) {
          await storage.createWorkstreamResource({
            tenantId,
            taskId: wsId,
            rateCardId: rc.id,
            hoursPerWeek: String(hpw),
            taskType: validTaskType,
            teamMemberId: null,
            notes: null,
          });
          resourcesCreated++;
        } else {
          rowsSkipped++;
        }
      } else {
        rowsSkipped++;
      }
    }
  }

  return {
    phasesCreated,
    workstreamsCreated,
    resourcesCreated,
    rowsSkipped,
    totalRows: rows.length,
  };
}
