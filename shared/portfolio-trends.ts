// Pure aggregation for the executive Portfolio Trends view. Takes the raw
// per-project weekly portfolio snapshots and rolls them up into one weekly
// series per metric. Kept dependency-free so it can be unit-tested and shared
// between the server endpoint and (if needed) the client.

export interface PortfolioSnapshotInput {
  timelineId: string;
  snapshotDate: string; // YYYY-MM-DD
  overallScore: string | number | null;
  overallRag: string;
  marginPct: string | number | null;
  forecastRevenue: string | number | null;
  riskExposure: string | number | null;
  blockedGates: number;
  outcomesOnTrack: number;
}

export interface PortfolioTrendPoint {
  date: string; // YYYY-MM-DD (weekly snapshot date)
  healthScore: number | null;
  green: number;
  amber: number;
  red: number;
  gray: number;
  forecastMargin: number | null;
  riskExposure: number;
  gateReadiness: number | null; // percentage of projects with no blocked gates
  outcomesOnTrack: number;
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Roll up per-project weekly snapshots into a single weekly trend series.
 *
 * For each distinct snapshot date (a week):
 * - healthScore: simple average of the projects' overall scores.
 * - green/amber/red/gray: project counts by overall RAG.
 * - forecastMargin: revenue-weighted average margin %, falling back to a simple
 *   average when no revenue weights are available.
 * - riskExposure: total risk exposure across projects.
 * - gateReadiness: share of projects with zero blocked gates, as a percentage.
 * - outcomesOnTrack: total on-track outcomes across projects.
 *
 * Returns points sorted ascending by date.
 */
export function buildPortfolioTrend(
  snapshots: PortfolioSnapshotInput[],
): PortfolioTrendPoint[] {
  const byDate = new Map<string, PortfolioSnapshotInput[]>();
  for (const s of snapshots) {
    const list = byDate.get(s.snapshotDate);
    if (list) list.push(s);
    else byDate.set(s.snapshotDate, [s]);
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));

  return dates.map((date) => {
    const rows = byDate.get(date)!;

    let scoreSum = 0;
    let scoreCount = 0;
    let green = 0;
    let amber = 0;
    let red = 0;
    let gray = 0;
    let marginWeighted = 0;
    let revenueWeight = 0;
    let marginPlainSum = 0;
    let marginPlainCount = 0;
    let riskExposure = 0;
    let readyGates = 0;
    let outcomesOnTrack = 0;

    for (const r of rows) {
      const score = toNum(r.overallScore);
      if (score !== null) {
        scoreSum += score;
        scoreCount += 1;
      }

      switch (r.overallRag) {
        case "green":
          green += 1;
          break;
        case "amber":
          amber += 1;
          break;
        case "red":
          red += 1;
          break;
        default:
          gray += 1;
      }

      const margin = toNum(r.marginPct);
      const revenue = toNum(r.forecastRevenue);
      if (margin !== null) {
        marginPlainSum += margin;
        marginPlainCount += 1;
        if (revenue !== null && revenue > 0) {
          marginWeighted += margin * revenue;
          revenueWeight += revenue;
        }
      }

      riskExposure += toNum(r.riskExposure) ?? 0;
      if ((r.blockedGates ?? 0) === 0) readyGates += 1;
      outcomesOnTrack += r.outcomesOnTrack ?? 0;
    }

    let forecastMargin: number | null = null;
    if (revenueWeight > 0) forecastMargin = round1(marginWeighted / revenueWeight);
    else if (marginPlainCount > 0) forecastMargin = round1(marginPlainSum / marginPlainCount);

    return {
      date,
      healthScore: scoreCount > 0 ? round1(scoreSum / scoreCount) : null,
      green,
      amber,
      red,
      gray,
      forecastMargin,
      riskExposure,
      gateReadiness: rows.length > 0 ? Math.round((readyGates / rows.length) * 100) : null,
      outcomesOnTrack,
    };
  });
}
