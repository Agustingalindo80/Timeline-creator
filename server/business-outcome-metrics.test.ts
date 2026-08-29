import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { storage } from "./storage";
import { backfillBusinessOutcomeMetrics } from "./backfill-business-outcome-metrics";
import {
  businessOutcomeMetrics,
  businessOutcomes,
  insertBusinessOutcomeMetricSchema,
} from "@shared/schema";

const TENANT_A = `test-bo-metrics-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TENANT_B = `test-bo-metrics-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const metricInput = {
  description: "Reduce processing time",
  currentValue: "12",
  currentValueType: "magnitude" as const,
  currentUnit: "hours",
  expectedValue: "4",
  expectedValueType: "magnitude" as const,
  expectedUnit: "hours",
  evaluationPeriod: 3,
  evaluationPeriodUnit: "months" as const,
  sortOrder: 0,
};

describe("business outcome success metrics", () => {
  after(async () => {
    await db.delete(businessOutcomes).where(eq(businessOutcomes.tenantId, TENANT_A));
    await db.delete(businessOutcomes).where(eq(businessOutcomes.tenantId, TENANT_B));
  });

  it("validates value types, units, percentages, and evaluation periods", () => {
    const base = {
      ...metricInput,
      tenantId: TENANT_A,
      businessOutcomeId: "outcome-1",
    };

    assert.equal(insertBusinessOutcomeMetricSchema.safeParse(base).success, true);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      currentValue: "101",
      currentValueType: "percentage",
      currentUnit: "%",
    }).success, false);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      currentValueType: "percentage",
      currentUnit: "count",
    }).success, false);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      evaluationPeriod: 0,
    }).success, false);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      currentValue: "100000000000000",
    }).success, false);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      expectedValue: "1.12345",
    }).success, false);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      expectedValue: "99999999999999.9999",
    }).success, true);
    assert.equal(insertBusinessOutcomeMetricSchema.safeParse({
      ...base,
      expectedValue: 99999999999999.1234,
    }).success, false);
  });

  it("keeps metric writes tenant-scoped and preserves explicit order", async () => {
    const outcomeA = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Tenant A outcome",
      status: "active",
    });
    await storage.createBusinessOutcome({
      tenantId: TENANT_B,
      title: "Tenant B outcome",
      status: "active",
    });

    const first = await storage.createBusinessOutcomeMetric({
      ...metricInput,
      tenantId: TENANT_A,
      businessOutcomeId: outcomeA.id,
      description: "First metric",
    });
    const second = await storage.createBusinessOutcomeMetric({
      ...metricInput,
      tenantId: TENANT_A,
      businessOutcomeId: outcomeA.id,
      description: "Second metric",
      sortOrder: 1,
    });
    assert.ok(first);
    assert.ok(second);

    const crossTenantCreate = await storage.createBusinessOutcomeMetric({
      ...metricInput,
      tenantId: TENANT_B,
      businessOutcomeId: outcomeA.id,
    });
    assert.equal(crossTenantCreate, undefined);
    assert.deepEqual(await storage.getBusinessOutcomeMetrics(outcomeA.id, TENANT_B), []);
    assert.equal(
      await storage.updateBusinessOutcomeMetric(first.id, outcomeA.id, TENANT_B, { description: "Leaked" }),
      undefined,
    );
    assert.equal(await storage.deleteBusinessOutcomeMetric(first.id, outcomeA.id, TENANT_B), false);

    assert.equal(
      await storage.reorderBusinessOutcomeMetrics(outcomeA.id, TENANT_A, [second.id, first.id]),
      true,
    );
    const reordered = await storage.getBusinessOutcomeMetrics(outcomeA.id, TENANT_A);
    assert.deepEqual(reordered.map((metric) => metric.id), [second.id, first.id]);
    assert.equal(
      await storage.reorderBusinessOutcomeMetrics(outcomeA.id, TENANT_A, [first.id]),
      false,
    );
  });

  it("creates parent and child metrics atomically and serializes concurrent append order", async () => {
    const title = `Atomic outcome ${Date.now()}`;
    await assert.rejects(() => storage.createBusinessOutcomeWithMetrics({
      tenantId: TENANT_A,
      title,
      status: "active",
    }, [{
      ...metricInput,
      tenantId: TENANT_A,
      businessOutcomeId: "pending",
      currentValue: "100000000000000",
    }]));

    const afterFailure = await storage.getBusinessOutcomes(TENANT_A);
    assert.equal(afterFailure.some((outcome) => outcome.title === title), false);

    const outcome = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Concurrent metric outcome",
      status: "active",
    });
    const created = await Promise.all(Array.from({ length: 5 }, (_, index) =>
      storage.createBusinessOutcomeMetricAtEnd({
        ...metricInput,
        tenantId: TENANT_A,
        businessOutcomeId: outcome.id,
        description: `Concurrent metric ${index}`,
        sortOrder: 0,
      }),
    ));
    assert.equal(created.every(Boolean), true);
    const ordered = await storage.getBusinessOutcomeMetrics(outcome.id, TENANT_A);
    assert.deepEqual(ordered.map((metric) => metric.sortOrder), [0, 1, 2, 3, 4]);
  });

  it("backfills legacy metric values once and cascade-deletes child metrics", async () => {
    const legacy = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Legacy outcome",
      status: "active",
      successMetric: "Adoption (%)",
      baseline: "0%",
      currentValue: "35%",
      target: "80%",
    });
    const overScale = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Over-scale legacy outcome",
      status: "active",
      successMetric: "Precise legacy value",
      currentValue: "1.12345",
      target: "2.12345",
    });
    const outOfRange = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Out-of-range legacy outcome",
      status: "active",
      successMetric: "Large legacy value",
      currentValue: "100000000000000",
      target: "200000000000000",
    });
    const malformedPercent = await storage.createBusinessOutcome({
      tenantId: TENANT_A,
      title: "Malformed percentage legacy outcome",
      status: "active",
      successMetric: "Malformed percentage",
      currentValue: "1%2",
      target: "8%%",
    });

    await backfillBusinessOutcomeMetrics();
    await backfillBusinessOutcomeMetrics();

    const migrated = await storage.getBusinessOutcomeMetrics(legacy.id, TENANT_A);
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].description, "Adoption (%)");
    assert.equal(migrated[0].currentValue, "35.0000");
    assert.equal(migrated[0].expectedValue, "80.0000");
    assert.equal(migrated[0].currentValueType, "percentage");
    assert.equal(migrated[0].currentUnit, "%");
    assert.deepEqual(await storage.getBusinessOutcomeMetrics(overScale.id, TENANT_A), []);
    assert.deepEqual(await storage.getBusinessOutcomeMetrics(outOfRange.id, TENANT_A), []);
    assert.deepEqual(await storage.getBusinessOutcomeMetrics(malformedPercent.id, TENANT_A), []);
    assert.equal((await storage.getBusinessOutcome(overScale.id, TENANT_A))?.currentValue, "1.12345");
    assert.equal((await storage.getBusinessOutcome(outOfRange.id, TENANT_A))?.currentValue, "100000000000000");
    assert.equal((await storage.getBusinessOutcome(malformedPercent.id, TENANT_A))?.currentValue, "1%2");

    await storage.deleteBusinessOutcome(legacy.id, TENANT_A);
    const remaining = await db.select({ id: businessOutcomeMetrics.id })
      .from(businessOutcomeMetrics)
      .where(and(
        eq(businessOutcomeMetrics.businessOutcomeId, legacy.id),
        eq(businessOutcomeMetrics.tenantId, TENANT_A),
      ));
    assert.equal(remaining.length, 0);
  });
});