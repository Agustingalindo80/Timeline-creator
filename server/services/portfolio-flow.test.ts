import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStageBuckets,
  buildHeatmap,
  HEATMAP_COLUMNS,
  STAGE_AGING_THRESHOLD_DAYS,
  type FlowProjectInput,
  type FlowStageMeta,
} from "./portfolio-flow";
import type { DimensionKey, DimensionScores, Rag } from "./portfolio-scoring";

const NOW = "2026-06-27T00:00:00.000Z";

function daysAgo(n: number): string {
  return new Date(new Date(NOW).getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function dims(rag: Rag = "green", score = 80): DimensionScores {
  const keys: DimensionKey[] = [
    "schedule",
    "financial",
    "scope",
    "quality",
    "risk",
    "governance",
    "outcome",
  ];
  const out = {} as DimensionScores;
  keys.forEach((k) => {
    out[k] = { rag, score };
  });
  return out;
}

function rationales(): Record<DimensionKey, string> {
  const keys: DimensionKey[] = [
    "schedule",
    "financial",
    "scope",
    "quality",
    "risk",
    "governance",
    "outcome",
  ];
  const out = {} as Record<DimensionKey, string>;
  keys.forEach((k) => {
    out[k] = `reason-${k}`;
  });
  return out;
}

function makeProject(over: Partial<FlowProjectInput>): FlowProjectInput {
  return {
    id: over.id ?? "p1",
    title: over.title ?? "Project 1",
    flightpathStageId: "flightpathStageId" in over ? over.flightpathStageId ?? null : "s1",
    overallScore: over.overallScore ?? 80,
    currentGateStatus: over.currentGateStatus ?? null,
    stageEnteredAt: over.stageEnteredAt ?? null,
    mandatoryTotal: over.mandatoryTotal ?? 0,
    mandatoryDone: over.mandatoryDone ?? 0,
    dimensions: over.dimensions ?? dims(),
    rationales: over.rationales ?? rationales(),
  };
}

const STAGES: FlowStageMeta[] = [
  { id: "s1", name: "Discovery", gateName: "G1", sortOrder: 0 },
  { id: "s2", name: "Delivery", gateName: "G2", sortOrder: 1 },
];

test("computeStageBuckets returns one bucket per configured stage in sort order", () => {
  const buckets = computeStageBuckets([], STAGES, NOW);
  assert.equal(buckets.length, 2);
  assert.deepEqual(buckets.map((b) => b.id), ["s1", "s2"]);
  assert.equal(buckets[0].projectCount, 0);
});

test("computeStageBuckets groups projects and averages health", () => {
  const projects = [
    makeProject({ id: "a", flightpathStageId: "s1", overallScore: 90 }),
    makeProject({ id: "b", flightpathStageId: "s1", overallScore: 70 }),
    makeProject({ id: "c", flightpathStageId: "s2", overallScore: 50 }),
  ];
  const buckets = computeStageBuckets(projects, STAGES, NOW);
  const s1 = buckets.find((b) => b.id === "s1")!;
  assert.equal(s1.projectCount, 2);
  assert.equal(s1.avgHealthScore, 80);
  assert.equal(s1.avgHealthRag, "amber");
});

test("computeStageBuckets counts blocked gates and decisions due", () => {
  const projects = [
    makeProject({ id: "a", currentGateStatus: "rejected" }),
    makeProject({ id: "b", currentGateStatus: "exception_requested" }),
    makeProject({ id: "c", currentGateStatus: "exception" }),
    makeProject({ id: "d", currentGateStatus: "approved" }),
  ];
  const buckets = computeStageBuckets(projects, STAGES, NOW);
  const s1 = buckets.find((b) => b.id === "s1")!;
  // rejected + exception_requested + exception are all blocked (consistent with
  // reports.ts gate-summary semantics); only exception_requested needs a decision.
  assert.equal(s1.blockedGates, 3);
  assert.equal(s1.decisionsRequired, 1);
});

test("computeStageBuckets computes avg days in stage and aging", () => {
  const projects = [
    makeProject({ id: "a", stageEnteredAt: daysAgo(10) }),
    makeProject({ id: "b", stageEnteredAt: daysAgo(STAGE_AGING_THRESHOLD_DAYS + 30) }),
    makeProject({ id: "c", stageEnteredAt: null }),
  ];
  const buckets = computeStageBuckets(projects, STAGES, NOW);
  const s1 = buckets.find((b) => b.id === "s1")!;
  // Only a + b have entry timestamps: avg of 10 and 120 = 65.
  assert.equal(s1.avgDaysInStage, 65);
  assert.equal(s1.agingProjects, 1);
  assert.equal(s1.agingThresholdDays, STAGE_AGING_THRESHOLD_DAYS);
});

test("computeStageBuckets readiness from mandatory checkpoints", () => {
  const projects = [
    makeProject({ id: "a", mandatoryTotal: 4, mandatoryDone: 3 }),
    makeProject({ id: "b", mandatoryTotal: 2, mandatoryDone: 1 }),
  ];
  const buckets = computeStageBuckets(projects, STAGES, NOW);
  const s1 = buckets.find((b) => b.id === "s1")!;
  // 4 done of 6 total => 67%.
  assert.equal(s1.readinessPct, 67);
});

test("computeStageBuckets readiness null when no mandatory checkpoints", () => {
  const buckets = computeStageBuckets([makeProject({ id: "a" })], STAGES, NOW);
  const s1 = buckets.find((b) => b.id === "s1")!;
  assert.equal(s1.readinessPct, null);
});

test("computeStageBuckets appends Unassigned bucket only when needed", () => {
  const withNull = computeStageBuckets(
    [makeProject({ id: "a", flightpathStageId: null })],
    STAGES,
    NOW,
  );
  const unassigned = withNull.find((b) => b.id === "unassigned");
  assert.ok(unassigned);
  assert.equal(unassigned!.projectCount, 1);

  const without = computeStageBuckets([makeProject({ id: "a", flightpathStageId: "s1" })], STAGES, NOW);
  assert.equal(
    without.find((b) => b.id === "unassigned"),
    undefined,
  );
});

test("buildHeatmap exposes every dimension column with rag/score/rationale", () => {
  const hm = buildHeatmap([makeProject({ id: "a", dimensions: dims("amber", 55) })]);
  assert.deepEqual(hm.columns, HEATMAP_COLUMNS);
  assert.equal(hm.rows.length, 1);
  const row = hm.rows[0];
  for (const col of HEATMAP_COLUMNS) {
    const cell = row.cells[col.key];
    assert.equal(cell.rag, "amber");
    assert.equal(cell.score, 55);
    assert.equal(cell.rationale, `reason-${col.key}`);
  }
});

test("buildHeatmap overallRag is the worst dimension rag", () => {
  const mixed = dims("green", 80);
  mixed.risk = { rag: "red", score: 20 };
  const hm = buildHeatmap([makeProject({ id: "a", dimensions: mixed })]);
  assert.equal(hm.rows[0].overallRag, "red");
});
