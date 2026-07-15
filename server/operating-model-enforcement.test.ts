import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { storage } from "./storage";
import { timelines, operatingModels, flightpathStages } from "@shared/schema";
import { convertOpportunityToProject } from "./services/opportunity-conversion";

const TEST_TENANT_ID = `test-om-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("operating model enforcement", () => {
  after(async () => {
    await db.delete(timelines).where(eq(timelines.tenantId, TEST_TENANT_ID));
    await db.delete(flightpathStages).where(eq(flightpathStages.tenantId, TEST_TENANT_ID));
    await db.delete(operatingModels).where(eq(operatingModels.tenantId, TEST_TENANT_ID));
  });

  it("conversion fails when no operating model is selected", async () => {
    const opp = await storage.createTimeline({
      tenantId: TEST_TENANT_ID,
      title: "No model opp",
      recordType: "opportunity",
      opportunityStatus: "won",
    } as any);

    await assert.rejects(
      () => convertOpportunityToProject(opp.id, TEST_TENANT_ID),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /operating model must be selected/i);
        return true;
      },
    );
  });

  it("conversion fails when the model is selected but not confirmed", async () => {
    const model = await storage.createOperatingModel({
      tenantId: TEST_TENANT_ID,
      name: "Unconfirmed Model",
      status: "active",
    } as any);

    const opp = await storage.createTimeline({
      tenantId: TEST_TENANT_ID,
      title: "Unconfirmed model opp",
      recordType: "opportunity",
      opportunityStatus: "won",
      operatingModelId: model.id,
    } as any);

    await assert.rejects(
      () => convertOpportunityToProject(opp.id, TEST_TENANT_ID),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /must be confirmed/i);
        return true;
      },
    );
  });

  it("getFlightpathStages filtered by model excludes other models' stages", async () => {
    const modelA = await storage.createOperatingModel({
      tenantId: TEST_TENANT_ID,
      name: "Model A",
      status: "active",
    } as any);
    const modelB = await storage.createOperatingModel({
      tenantId: TEST_TENANT_ID,
      name: "Model B",
      status: "active",
    } as any);

    const [stageA] = await db.insert(flightpathStages).values({
      tenantId: TEST_TENANT_ID,
      operatingModelId: modelA.id,
      stageNumber: 0,
      name: "A Stage 0",
      goal: "Test goal A", gateName: "Gate A",
    } as any).returning();
    await db.insert(flightpathStages).values({
      tenantId: TEST_TENANT_ID,
      operatingModelId: modelB.id,
      stageNumber: 0,
      name: "B Stage 0",
      goal: "Test goal B", gateName: "Gate B",
    } as any);

    const stagesA = await storage.getFlightpathStages(TEST_TENANT_ID, modelA.id);
    assert.equal(stagesA.length, 1);
    assert.equal(stagesA[0].id, stageA.id);
    assert.ok(!stagesA.some(s => s.name === "B Stage 0"));
  });
});
