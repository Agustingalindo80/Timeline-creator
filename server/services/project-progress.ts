import { storage } from "../storage";

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

export function parseDateToNum(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 999999;
}

export async function recalcPhaseProgress(phaseId: string, tenantId: string) {
  const children = await storage.getTasksByParent(phaseId, tenantId);
  if (children.length === 0) return;

  let totalWeight = 0;
  let weightedSum = 0;
  let anyInProgress = false;
  let allComplete = true;

  for (const child of children) {
    const dur = (child.startDate && child.endDate) ? Math.max(1, parseDateToNum(child.endDate) - parseDateToNum(child.startDate)) : 1;
    totalWeight += dur;
    weightedSum += child.percentComplete * dur;
    if (child.status === "in_progress") anyInProgress = true;
    if (child.status !== "complete") allComplete = false;
  }

  const updates: any = {};
  updates.percentComplete = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const phase = await storage.getTask(phaseId, tenantId);
  if (phase) {
    if (allComplete) {
      updates.status = "complete";
    } else if ((anyInProgress || children.some(c => c.status === "complete")) && phase.status === "not_started") {
      updates.status = "in_progress";
    }
  }

  await storage.updateTask(phaseId, tenantId, updates);
}
