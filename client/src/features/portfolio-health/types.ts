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

export interface PortfolioOverview {
  generatedAt: string;
  header: PortfolioOverviewHeader;
  kpis: PortfolioOverviewKpis;
  projects: PortfolioProjectOverview[];
}
