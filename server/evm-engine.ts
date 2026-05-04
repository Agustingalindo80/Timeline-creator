import { createHash } from "crypto";
import { storage } from "./storage";
import type { InsertEvmSnapshot, EvmWorkstreamBreakdownItem } from "@shared/schema";

function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr + "T00:00:00");
  if (!isNaN(d.getTime())) return d;
  d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function getWeekEnding(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export interface EVMResult {
  bac: number;
  plannedValue: number;
  actualCost: number;
  earnedValue: number;
  scheduleVariance: number;
  costVariance: number;
  spiValue: number;
  cpiValue: number;
  eacValue: number;
  etcValue: number;
  vacValue: number;
  weeklyPv: number;
  weeklyAc: number;
  weeklyEv: number;
  workstreamBreakdown: EvmWorkstreamBreakdownItem[];
  inputsHash: string;
}

export async function calculateEVMForWeek(timelineId: string, targetWeekEnding: string, tenantId: string = "default"): Promise<EVMResult> {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) throw new Error("Timeline not found");

  const bac = parseFloat(timeline.approvedBudget || "0");
  const allTasks = await storage.getTasksByTimeline(timelineId, tenantId);
  const workstreams = allTasks.filter(t => t.itemType === "workstream");
  const phases = allTasks.filter(t => t.itemType === "phase");

  const durations: Record<string, number> = {};
  let totalDuration = 0;
  workstreams.forEach(ws => {
    const start = safeParseDate(ws.startDate);
    const end = safeParseDate(ws.endDate);
    const duration = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : 1;
    durations[ws.id] = duration;
    totalDuration += duration;
  });

  const workstreamBudgets: Record<string, number> = {};
  workstreams.forEach(ws => {
    workstreamBudgets[ws.id] = totalDuration > 0 ? (durations[ws.id] / totalDuration) * bac : 0;
  });

  const allocations = await storage.getAllocationsByTimeline(timelineId, tenantId);
  const timesheetEntries = await storage.getTimesheetEntries(tenantId, { timelineId });
  const progressEntries = await storage.getProgressEntries(tenantId, { timelineId });
  const projectTeam = await storage.getProjectTeamMembers(timelineId, tenantId);
  const allTeamMembers = await storage.getTeamMembers();

  const rateByTeamMember: Record<string, number> = {};
  allTeamMembers.forEach(tm => {
    const cost = parseFloat(tm.hourlyCost || "0");
    if (cost > 0) rateByTeamMember[tm.id] = cost;
  });
  projectTeam.forEach(ptm => {
    if (!ptm.teamMemberId) return;
    const rate = ptm.rateCard
      ? parseFloat(ptm.rateCard.costRate || "0")
      : (ptm.hourlyCost
        ? parseFloat(ptm.hourlyCost as string)
        : parseFloat(ptm.teamMember?.hourlyCost || "0"));
    if (rate > 0) rateByTeamMember[ptm.teamMemberId] = rate;
  });

  const allWeeks = new Set<string>();
  timesheetEntries.forEach(e => allWeeks.add(e.weekEnding));
  progressEntries.forEach(e => allWeeks.add(e.weekEnding));
  allocations.forEach(a => {
    if (a.startDate && a.endDate) {
      const start = new Date(a.startDate + "T00:00:00");
      const end = new Date(a.endDate + "T00:00:00");
      const current = new Date(start);
      while (current <= end) {
        allWeeks.add(getWeekEnding(current));
        current.setDate(current.getDate() + 7);
      }
    }
  });

  const sortedWeeks = [...allWeeks].sort().filter(w => w <= targetWeekEnding);

  let cumulativePV = 0;
  let cumulativeAC = 0;
  const latestProgress: Record<string, number> = {};
  let prevCumulativePV = 0;
  let prevCumulativeAC = 0;
  let prevEV = 0;

  for (const week of sortedWeeks) {
    let weekPV = 0;
    allocations.forEach(a => {
      if (a.startDate && a.endDate) {
        const wEnd = new Date(week + "T00:00:00");
        const aStart = new Date(a.startDate + "T00:00:00");
        const aEnd = new Date(a.endDate + "T00:00:00");
        if (wEnd >= aStart && wEnd <= aEnd) {
          const rate = rateByTeamMember[a.teamMemberId] || 0;
          weekPV += parseFloat(a.weeklyHours || "0") * rate;
        }
      }
    });

    let weekAC = 0;
    timesheetEntries.filter(e => e.weekEnding === week).forEach(e => {
      const rate = rateByTeamMember[e.teamMemberId] || 0;
      weekAC += parseFloat(e.hours) * rate;
    });

    progressEntries.filter(e => e.weekEnding === week).forEach(e => {
      latestProgress[e.taskId] = e.percentComplete;
    });

    if (week < targetWeekEnding) {
      prevCumulativePV = cumulativePV + weekPV;
      prevCumulativeAC = cumulativeAC + weekAC;
      let tmpEv = 0;
      workstreams.forEach(ws => {
        const pct = latestProgress[ws.id] ?? 0;
        tmpEv += (pct / 100) * (workstreamBudgets[ws.id] || 0);
      });
      prevEV = tmpEv;
    }

    cumulativePV += weekPV;
    cumulativeAC += weekAC;
  }

  let earnedValue = 0;
  const breakdown: EvmWorkstreamBreakdownItem[] = [];
  workstreams.forEach(ws => {
    const pct = latestProgress[ws.id] ?? 0;
    const budget = workstreamBudgets[ws.id] || 0;
    const wsEv = (pct / 100) * budget;
    earnedValue += wsEv;
    const parentPhase = phases.find(p => p.id === ws.parentTaskId);
    breakdown.push({
      taskId: ws.id,
      taskTitle: ws.title,
      phaseTitle: parentPhase?.title || null,
      percentComplete: pct,
      budget: Math.round(budget * 100) / 100,
      ev: Math.round(wsEv * 100) / 100,
    });
  });

  const plannedValue = cumulativePV;
  const actualCost = cumulativeAC;
  const sv = earnedValue - plannedValue;
  const cv = earnedValue - actualCost;
  const spi = plannedValue > 0 ? earnedValue / plannedValue : 0;
  const cpi = actualCost > 0 ? earnedValue / actualCost : 0;
  const eac = cpi > 0 ? bac / cpi : 0;
  const etc = eac - actualCost;
  const vac = bac - eac;

  const weeklyPv = cumulativePV - prevCumulativePV;
  const weeklyAc = cumulativeAC - prevCumulativeAC;
  const weeklyEv = earnedValue - prevEV;

  const totalTimesheetHours = timesheetEntries
    .filter(e => e.weekEnding <= targetWeekEnding)
    .reduce((sum, e) => sum + parseFloat(e.hours), 0);
  const totalAllocationHours = allocations.reduce((sum, a) => sum + parseFloat(a.weeklyHours || "0"), 0);
  const progressCount = progressEntries.filter(e => e.weekEnding <= targetWeekEnding).length;

  const hashInput = JSON.stringify({
    bac,
    taskCount: workstreams.length,
    totalTimesheetHours: Math.round(totalTimesheetHours * 100) / 100,
    totalAllocationHours: Math.round(totalAllocationHours * 100) / 100,
    progressEntryCount: progressCount,
  });
  const inputsHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return {
    bac,
    plannedValue: Math.round(plannedValue * 100) / 100,
    actualCost: Math.round(actualCost * 100) / 100,
    earnedValue: Math.round(earnedValue * 100) / 100,
    scheduleVariance: Math.round(sv * 100) / 100,
    costVariance: Math.round(cv * 100) / 100,
    spiValue: Math.round(spi * 10000) / 10000,
    cpiValue: Math.round(cpi * 10000) / 10000,
    eacValue: Math.round(eac * 100) / 100,
    etcValue: Math.round(etc * 100) / 100,
    vacValue: Math.round(vac * 100) / 100,
    weeklyPv: Math.round(weeklyPv * 100) / 100,
    weeklyAc: Math.round(weeklyAc * 100) / 100,
    weeklyEv: Math.round(weeklyEv * 100) / 100,
    workstreamBreakdown: breakdown,
    inputsHash,
  };
}
