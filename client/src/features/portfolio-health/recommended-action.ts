import type { PortfolioProjectOverview } from "./types";

export type ActionUrgency = "critical" | "warning" | "none";

export function recommendedAction(p: PortfolioProjectOverview): string {
  if (p.openCriticalRiskCount > 0) {
    return `Escalate ${p.openCriticalRiskCount} critical risk${p.openCriticalRiskCount === 1 ? "" : "s"} to the steering committee.`;
  }
  if (p.gateSummary.blocked > 0) {
    return `Unblock ${p.gateSummary.blocked} gate${p.gateSummary.blocked === 1 ? "" : "s"} — review readiness criteria with the gate owner.`;
  }
  if (p.openDecisionCount > 0) {
    return `Resolve ${p.openDecisionCount} pending gate exception${p.openDecisionCount === 1 ? "" : "s"} awaiting a decision.`;
  }
  if (p.overallRag === "red") {
    return "Project health is critical — convene a recovery review.";
  }
  if (p.overallRag === "amber") {
    return "Monitor at-risk dimensions and close gaps before the next gate.";
  }
  return "On track — maintain current delivery cadence.";
}

export function actionUrgency(p: PortfolioProjectOverview): ActionUrgency {
  if (p.openCriticalRiskCount > 0 || p.gateSummary.blocked > 0 || p.overallRag === "red") {
    return "critical";
  }
  if (p.openDecisionCount > 0 || p.overallRag === "amber") {
    return "warning";
  }
  return "none";
}
