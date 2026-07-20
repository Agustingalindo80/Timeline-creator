import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db";
import { timelines } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { getOpportunityPipelineReport } from "./reports";

test("opportunity pipeline report status filter", async (t) => {
  const tenantId = `test-pipeline-${Date.now()}`;
  const inserted = await db
    .insert(timelines)
    .values([
      {
        tenantId,
        title: "Null status opp",
        recordType: "opportunity",
        opportunityStatus: null,
        initialEstimate: "1000",
      },
      {
        tenantId,
        title: "Explicit qualifying opp",
        recordType: "opportunity",
        opportunityStatus: "qualifying",
        initialEstimate: "2000",
      },
      {
        tenantId,
        title: "Won opp",
        recordType: "opportunity",
        opportunityStatus: "won",
        approvedBudget: "5000",
      },
    ])
    .returning({ id: timelines.id });

  t.after(async () => {
    await db.delete(timelines).where(
      inArray(
        timelines.id,
        inserted.map((r) => r.id),
      ),
    );
  });

  const ctx = { isGlobal: true, assignedTimelineIds: [] as string[] };

  await t.test("qualifying filter includes null-status opportunities", async () => {
    const report = await getOpportunityPipelineReport(tenantId, ctx as any, { status: "qualifying" });
    const titles = report.items.map((i: any) => i.title).sort();
    assert.deepEqual(titles, ["Explicit qualifying opp", "Null status opp"]);
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.openCount, 2);
  });

  await t.test("won filter excludes null-status opportunities", async () => {
    const report = await getOpportunityPipelineReport(tenantId, ctx as any, { status: "won" });
    assert.deepEqual(
      report.items.map((i: any) => i.title),
      ["Won opp"],
    );
    assert.equal(report.summary.wonCount, 1);
    assert.equal(report.summary.wonValue, 5000);
  });

  await t.test("no filter returns all three", async () => {
    const report = await getOpportunityPipelineReport(tenantId, ctx as any, {});
    assert.equal(report.items.length, 3);
  });
});

test("opportunity pipeline report restricted record access", async (t) => {
  const tenantId = `test-pipeline-rbac-${Date.now()}`;
  const inserted = await db
    .insert(timelines)
    .values([
      {
        tenantId,
        title: "Assigned open opp",
        recordType: "opportunity",
        opportunityStatus: "qualifying",
        initialEstimate: "1000",
      },
      {
        tenantId,
        title: "Assigned won opp",
        recordType: "opportunity",
        opportunityStatus: "won",
        approvedBudget: "4000",
      },
      {
        tenantId,
        title: "Unassigned open opp",
        recordType: "opportunity",
        opportunityStatus: "qualifying",
        initialEstimate: "9000",
      },
      {
        tenantId,
        title: "Unassigned won opp",
        recordType: "opportunity",
        opportunityStatus: "won",
        approvedBudget: "7000",
      },
    ])
    .returning({ id: timelines.id, title: timelines.title });

  t.after(async () => {
    await db.delete(timelines).where(
      inArray(
        timelines.id,
        inserted.map((r) => r.id),
      ),
    );
  });

  const assignedIds = inserted
    .filter((r) => r.title.startsWith("Assigned"))
    .map((r) => r.id);
  const restrictedCtx = { isGlobal: false, assignedTimelineIds: assignedIds };

  await t.test("only assigned opportunities are returned", async () => {
    const report = await getOpportunityPipelineReport(tenantId, restrictedCtx as any, {});
    const titles = report.items.map((i: any) => i.title).sort();
    assert.deepEqual(titles, ["Assigned open opp", "Assigned won opp"]);
    const returnedIds = report.items.map((i: any) => i.id).sort();
    assert.deepEqual(returnedIds, [...assignedIds].sort());
  });

  await t.test("summary KPIs only sum assigned records", async () => {
    const report = await getOpportunityPipelineReport(tenantId, restrictedCtx as any, {});
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.openCount, 1);
    assert.equal(report.summary.totalPipeline, 1000);
    assert.equal(report.summary.weightedPipeline, 1000);
    assert.equal(report.summary.wonCount, 1);
    assert.equal(report.summary.wonValue, 4000);
  });

  await t.test("restricted user with no assignments sees nothing", async () => {
    const report = await getOpportunityPipelineReport(
      tenantId,
      { isGlobal: false, assignedTimelineIds: [] as string[] } as any,
      {},
    );
    assert.equal(report.items.length, 0);
    assert.equal(report.summary.total, 0);
    assert.equal(report.summary.totalPipeline, 0);
    assert.equal(report.summary.wonValue, 0);
  });
});
