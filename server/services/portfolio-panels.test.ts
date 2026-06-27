import { test } from "node:test";
import assert from "node:assert/strict";
import { computePanels, type PanelData, type PanelProjectInput } from "./portfolio-panels";

function makeProject(over: Partial<PanelProjectInput>): PanelProjectInput {
  return {
    id: over.id ?? "p1",
    title: over.title ?? "Project 1",
    projectStatus: over.projectStatus ?? "active",
    estimatedRevenue: over.estimatedRevenue ?? null,
    approvedBudget: over.approvedBudget ?? null,
    totalRunningCost: over.totalRunningCost ?? null,
    grossMargin: over.grossMargin ?? null,
    flightpathStageName: over.flightpathStageName ?? null,
    endDate: over.endDate ?? null,
    evm: over.evm ?? null,
    gateSummary: over.gateSummary ?? { total: 0, blocked: 0, pending: 0, approved: 0 },
    gateDetail: over.gateDetail ?? null,
  };
}

function emptyData(over: Partial<PanelData> = {}): PanelData {
  return {
    missingEvidenceByTimeline: over.missingEvidenceByTimeline ?? new Map(),
    risks: over.risks ?? [],
    outcomes: over.outcomes ?? [],
    titleByTimeline: over.titleByTimeline ?? new Map(),
  };
}

const future = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

test("governance RAG: green when gates approved, no blockers, not overdue", () => {
  const { governance } = computePanels(
    [makeProject({ gateSummary: { total: 2, blocked: 0, pending: 0, approved: 2 }, endDate: future })],
    emptyData(),
  );
  assert.equal(governance.rag, "green");
  assert.equal(governance.projectsOverdue, 0);
});

test("governance RAG: amber when only pending gates and not overdue", () => {
  const { governance } = computePanels(
    [makeProject({ gateSummary: { total: 2, blocked: 0, pending: 1, approved: 1 }, endDate: future })],
    emptyData(),
  );
  assert.equal(governance.rag, "amber");
  assert.equal(governance.projectsOverdue, 0);
});

test("governance RAG: red when blocked gate", () => {
  const { governance } = computePanels(
    [makeProject({ gateSummary: { total: 2, blocked: 1, pending: 0, approved: 1 }, endDate: future })],
    emptyData(),
  );
  assert.equal(governance.rag, "red");
});

test("governance RAG: red when missing mandatory evidence", () => {
  const { governance } = computePanels(
    [makeProject({ id: "p1", gateSummary: { total: 1, blocked: 0, pending: 0, approved: 1 }, endDate: future })],
    emptyData({ missingEvidenceByTimeline: new Map([["p1", 2]]) }),
  );
  assert.equal(governance.rag, "red");
  assert.equal(governance.missingEvidence, 2);
});

test("governance RAG: red (overdue only) when due date passed with pending gate work", () => {
  const { governance } = computePanels(
    [makeProject({ id: "p1", gateSummary: { total: 2, blocked: 0, pending: 1, approved: 1 }, endDate: past })],
    emptyData(),
  );
  assert.equal(governance.rag, "red");
  assert.equal(governance.projectsOverdue, 1);
  assert.equal(governance.projects[0].overdue, true);
});

test("governance: not overdue when due date passed but all gate work complete", () => {
  const { governance } = computePanels(
    [makeProject({ gateSummary: { total: 2, blocked: 0, pending: 0, approved: 2 }, endDate: past })],
    emptyData(),
  );
  assert.equal(governance.projectsOverdue, 0);
  assert.equal(governance.rag, "green");
});
