import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildPortfolioTrend, type PortfolioSnapshotInput } from "@shared/portfolio-trends";

function snap(partial: Partial<PortfolioSnapshotInput> & { snapshotDate: string }): PortfolioSnapshotInput {
  return {
    timelineId: "t1",
    overallScore: null,
    overallRag: "gray",
    marginPct: null,
    forecastRevenue: null,
    riskExposure: null,
    blockedGates: 0,
    outcomesOnTrack: 0,
    ...partial,
  };
}

describe("buildPortfolioTrend", () => {
  it("returns an empty series for no snapshots", () => {
    assert.deepEqual(buildPortfolioTrend([]), []);
  });

  it("groups by week and sorts ascending by date", () => {
    const trend = buildPortfolioTrend([
      snap({ snapshotDate: "2026-02-01", overallRag: "green" }),
      snap({ snapshotDate: "2026-01-04", overallRag: "red" }),
      snap({ snapshotDate: "2026-01-11", overallRag: "amber" }),
    ]);
    assert.deepEqual(trend.map((p) => p.date), ["2026-01-04", "2026-01-11", "2026-02-01"]);
  });

  it("counts projects by RAG and averages the health score per week", () => {
    const trend = buildPortfolioTrend([
      snap({ snapshotDate: "2026-01-04", overallRag: "green", overallScore: "80" }),
      snap({ snapshotDate: "2026-01-04", overallRag: "amber", overallScore: "60" }),
      snap({ snapshotDate: "2026-01-04", overallRag: "red", overallScore: null }),
      snap({ snapshotDate: "2026-01-04", overallRag: "weird" }),
    ]);
    assert.equal(trend.length, 1);
    const p = trend[0];
    assert.equal(p.green, 1);
    assert.equal(p.amber, 1);
    assert.equal(p.red, 1);
    assert.equal(p.gray, 1, "unknown RAG falls back to gray");
    assert.equal(p.healthScore, 70, "averages only the two scored projects");
  });

  it("revenue-weights forecast margin and falls back to a plain average", () => {
    const weighted = buildPortfolioTrend([
      snap({ snapshotDate: "2026-01-04", marginPct: "10", forecastRevenue: "100" }),
      snap({ snapshotDate: "2026-01-04", marginPct: "40", forecastRevenue: "300" }),
    ]);
    // (10*100 + 40*300) / 400 = 32.5
    assert.equal(weighted[0].forecastMargin, 32.5);

    const plain = buildPortfolioTrend([
      snap({ snapshotDate: "2026-01-04", marginPct: "10", forecastRevenue: null }),
      snap({ snapshotDate: "2026-01-04", marginPct: "20", forecastRevenue: "0" }),
    ]);
    // No revenue weights -> simple average (10 + 20) / 2 = 15
    assert.equal(plain[0].forecastMargin, 15);

    const none = buildPortfolioTrend([snap({ snapshotDate: "2026-01-04" })]);
    assert.equal(none[0].forecastMargin, null);
  });

  it("sums risk exposure and on-track outcomes, and computes gate readiness", () => {
    const trend = buildPortfolioTrend([
      snap({ snapshotDate: "2026-01-04", riskExposure: "1000", blockedGates: 0, outcomesOnTrack: 2 }),
      snap({ snapshotDate: "2026-01-04", riskExposure: "500", blockedGates: 2, outcomesOnTrack: 3 }),
      snap({ snapshotDate: "2026-01-04", riskExposure: null, blockedGates: 0, outcomesOnTrack: 0 }),
    ]);
    const p = trend[0];
    assert.equal(p.riskExposure, 1500);
    assert.equal(p.outcomesOnTrack, 5);
    // 2 of 3 projects have no blocked gates -> 67%
    assert.equal(p.gateReadiness, 67);
  });
});
