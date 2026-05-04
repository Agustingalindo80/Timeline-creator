import { storage } from "../storage";

export async function recalcApprovedBudget(timelineId: string, tenantId: string) {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) return;

  const totalAmount = timeline.milestones
    .filter(m => m.isFinancialObligation && m.amount)
    .reduce((sum, m) => sum + (parseFloat(m.amount!) || 0), 0);

  const budgetStr = totalAmount > 0 ? totalAmount.toFixed(2) : null;
  const cost = parseFloat(timeline.totalRunningCost ?? "0") || 0;
  let grossMargin: string | null = null;
  if (totalAmount > 0 && cost > 0) {
    grossMargin = (((totalAmount - cost) / totalAmount) * 100).toFixed(2);
  } else if (totalAmount > 0) {
    grossMargin = "100.00";
  }

  await storage.updateTimeline(timelineId, tenantId, {
    approvedBudget: budgetStr,
    grossMargin,
  });
}

export async function recalcTotalRunningCost(timelineId: string, tenantId: string) {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) return;

  const allocs = await storage.getAllocationsByTimeline(timelineId, tenantId);
  const activeAllocs = allocs.filter(a => a.status === "active");

  let totalCost = 0;

  const now = new Date();
  const projectStart = timeline.startDate ? new Date(timeline.startDate) : null;
  const projectEnd = timeline.endDate ? new Date(timeline.endDate) : null;

  for (const a of activeAllocs) {
    const member = a.teamMember;
    let allocStart = a.startDate ? new Date(a.startDate) : projectStart;
    let allocEnd = a.endDate ? new Date(a.endDate) : projectEnd;

    if (!allocStart || isNaN(allocStart.getTime())) continue;

    if (projectStart && !isNaN(projectStart.getTime()) && allocStart < projectStart) {
      allocStart = projectStart;
    }
    if (projectEnd && !isNaN(projectEnd.getTime()) && allocEnd && allocEnd > projectEnd) {
      allocEnd = projectEnd;
    }

    if (now < allocStart) continue;

    const effectiveEnd = allocEnd && !isNaN(allocEnd.getTime()) && allocEnd < now ? allocEnd : now;
    const diffMs = effectiveEnd.getTime() - allocStart.getTime();
    if (diffMs <= 0) continue;

    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeline.engagementModel === "fixed_bid") {
      const monthlyCost = parseFloat(member.monthlyCost ?? "0") || 0;
      const startYear = allocStart.getFullYear();
      const startMonth = allocStart.getMonth();
      const endYear = effectiveEnd.getFullYear();
      const endMonth = effectiveEnd.getMonth();
      const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      totalCost += monthlyCost * months;
    } else {
      const hourlyCost = parseFloat(member.hourlyCost ?? "0") || 0;
      const weeklyHours = parseFloat(a.weeklyHours ?? "0") || 0;
      const weeks = diffDays / 7;
      totalCost += hourlyCost * weeklyHours * weeks;
    }
  }

  const costStr = totalCost > 0 ? totalCost.toFixed(2) : null;
  const budget = parseFloat(timeline.approvedBudget ?? "0") || 0;
  let grossMargin: string | null = null;
  if (budget > 0 && totalCost > 0) {
    grossMargin = (((budget - totalCost) / budget) * 100).toFixed(2);
  } else if (budget > 0) {
    grossMargin = "100.00";
  }

  await storage.updateTimeline(timelineId, tenantId, {
    totalRunningCost: costStr,
    grossMargin,
  });
}
