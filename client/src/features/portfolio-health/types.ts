import type { Rag } from "./theme";

export type DimensionKey =
  | "schedule"
  | "financial"
  | "scope"
  | "quality"
  | "risk"
  | "governance"
  | "outcome";

export interface DimensionScore {
  score: number | null;
  rag: Rag;
}

export type DimensionScores = Record<DimensionKey, DimensionScore>;

export interface PortfolioProjectOverview {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  region: string | null;
  projectStatus: string;
  startDate: string | null;
  endDate: string | null;
  flightpathStageId: string | null;
  flightpathStageName: string | null;
  healthOverall: string;
  scopeHealth: string;
  budgetHealth: string;
  teamHealth: string;
  approvedBudget: string | null;
  totalRunningCost: string | null;
  grossMargin: string | null;
  estimatedRevenue: string | null;
  evm: {
    cpi: number | null;
    spi: number | null;
    eac: number | null;
    actualCost: number | null;
    earnedValue: number | null;
    plannedValue: number | null;
    bac: number | null;
    vac: number | null;
    weekEnding: string | null;
  } | null;
  openRiskCount: number;
  openCriticalRiskCount: number;
  gateSummary: { total: number; blocked: number; pending: number; approved: number };
  outcomeCount: number;
  dimensions: DimensionScores;
  overallScore: number | null;
  overallRag: Rag;
}

export interface PortfolioOverviewHeader {
  healthScore: number | null;
  healthRag: Rag;
  activeProjects: number;
  totalProjects: number;
  clientCount: number;
  totalContractValue: number;
  forecastRevenue: number;
  forecastMarginPct: number | null;
  riskExposure: number;
  projectsRequiringAttention: number;
}

export interface PortfolioOverviewKpis {
  greenProjects: number;
  amberProjects: number;
  redProjects: number;
  grayProjects: number;
  totalBudget: number;
  actualCost: number;
  forecastCost: number;
  openCriticalRisks: number;
  blockedGates: number;
  upcomingGoLives: number;
  outcomesOnTrack: number;
}

export interface FinancialPanel {
  rag: Rag;
  reasons: string[];
  contractedRevenue: number;
  approvedBudget: number;
  actualCost: number;
  forecastCost: number;
  eac: number;
  earnedValue: number;
  plannedValue: number;
  cpi: number | null;
  spi: number | null;
  costVariance: number;
  scheduleVariance: number;
  vac: number;
  forecastMarginPct: number | null;
  targetMarginPct: number;
  marginLeakage: number;
  projectsWithEvm: number;
  totalProjects: number;
}

export interface GovernanceProjectRow {
  id: string;
  title: string;
  stageName: string | null;
  gateStatus: "blocked" | "in_review" | "on_track" | "not_started";
  nextGateName: string | null;
  owner: string | null;
  targetDate: string | null;
  blockers: string[];
  missingEvidence: number;
  blocked: number;
}

export interface GovernancePanel {
  rag: Rag;
  reasons: string[];
  totalGates: number;
  blockedGates: number;
  pendingGates: number;
  approvedGates: number;
  projectsBlocked: number;
  missingEvidence: number;
  projectsWithMissingEvidence: number;
  projects: GovernanceProjectRow[];
}

export interface TopRiskRow {
  id: string;
  title: string;
  projectTitle: string;
  timelineId: string;
  score: number;
  probability: string;
  impact: string;
  owner: string | null;
  dueDate: string | null;
}

export interface RaidPanel {
  rag: Rag;
  reasons: string[];
  openRisks: number;
  openAssumptions: number;
  openIssues: number;
  openDependencies: number;
  criticalRisks: number;
  overdueMitigations: number;
  risksWithoutOwner: number;
  needingEscalation: number;
  totalItems: number;
  topRisks: TopRiskRow[];
}

export interface OutcomePanel {
  rag: Rag;
  reasons: string[];
  tracked: number;
  onTrack: number;
  atRisk: number;
  delivered: number;
  notMeasurable: number;
  metricsAvailable: number;
  metricsMissing: number;
  evidenceCaptured: number;
}

export interface PortfolioPanels {
  financial: FinancialPanel;
  governance: GovernancePanel;
  raid: RaidPanel;
  outcome: OutcomePanel;
}

export interface PortfolioOverview {
  generatedAt: string;
  header: PortfolioOverviewHeader;
  kpis: PortfolioOverviewKpis;
  panels: PortfolioPanels;
  projects: PortfolioProjectOverview[];
}
