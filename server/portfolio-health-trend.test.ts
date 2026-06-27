import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { storage } from "./storage";
import { timelines, timelineHealthHistory } from "@shared/schema";
import { mergeHealthHistory, buildHealthTrend } from "@shared/health-trend";

const TEST_TENANT_ID = `test-trend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DAY_MS = 24 * 60 * 60 * 1000;

// Fix "now" and the 90-day window start so the test is deterministic.
const NOW = new Date("2026-06-27T00:00:00.000Z");
const WINDOW_START = new Date(NOW.getTime() - 90 * DAY_MS);

// Projects:
// - staleGreen: only health record is 120 days ago (predates window) -> green
// - staleRed: only health record is 200 days ago (predates window) -> red
// - active: a green record before the window, then amber + red inside the window
let staleGreenId: string;
let staleRedId: string;
let activeId: string;

async function seedTimeline(title: string): Promise<string> {
  const t = await storage.createTimeline({ tenantId: TEST_TENANT_ID, title } as any);
  return t.id;
}

async function seedHealth(
  timelineId: string,
  healthOverall: "green" | "amber" | "red",
  recordedAt: Date,
): Promise<void> {
  await db.insert(timelineHealthHistory).values({
    tenantId: TEST_TENANT_ID,
    timelineId,
    healthOverall,
    scopeHealth: healthOverall,
    budgetHealth: healthOverall,
    teamHealth: healthOverall,
    recordedAt,
  });
}

describe("portfolio health trend baseline", () => {
  before(async () => {
    staleGreenId = await seedTimeline("Stale Green");
    staleRedId = await seedTimeline("Stale Red");
    activeId = await seedTimeline("Active");

    // Records predating the 90-day window.
    await seedHealth(staleGreenId, "green", new Date(NOW.getTime() - 120 * DAY_MS));
    await seedHealth(staleRedId, "red", new Date(NOW.getTime() - 200 * DAY_MS));
    await seedHealth(activeId, "green", new Date(NOW.getTime() - 100 * DAY_MS));

    // In-window records for the active project.
    await seedHealth(activeId, "amber", new Date(NOW.getTime() - 60 * DAY_MS));
    await seedHealth(activeId, "red", new Date(NOW.getTime() - 10 * DAY_MS));
  });

  after(async () => {
    await db.delete(timelineHealthHistory).where(eq(timelineHealthHistory.tenantId, TEST_TENANT_ID));
    await db.delete(timelines).where(eq(timelines.tenantId, TEST_TENANT_ID));
    await pool.end();
  });

  it("storage baseline returns the latest record at or before the window start per project", async () => {
    const ids = [staleGreenId, staleRedId, activeId];
    const baseline = await storage.getHealthHistoryBaseline(ids, TEST_TENANT_ID, WINDOW_START);

    // Exactly one baseline row per project (selectDistinctOn timelineId).
    assert.equal(baseline.length, 3, "expected one baseline record per project");

    const byTimeline = new Map(baseline.map((b) => [b.timelineId, b]));

    assert.equal(byTimeline.get(staleGreenId)?.healthOverall, "green");
    assert.equal(byTimeline.get(staleRedId)?.healthOverall, "red");
    // Active project's baseline is the green record from 100 days ago, NOT the
    // in-window amber/red ones (those are after WINDOW_START).
    assert.equal(byTimeline.get(activeId)?.healthOverall, "green");
    assert.ok(
      new Date(byTimeline.get(activeId)!.recordedAt).getTime() <= WINDOW_START.getTime(),
      "active baseline must be at or before the window start",
    );
  });

  it("baseline + in-window records merge in correct chronological order", async () => {
    const ids = [staleGreenId, staleRedId, activeId];
    const [windowHistory, baseline] = await Promise.all([
      storage.getHealthHistoryByTimelineIds(ids, TEST_TENANT_ID, { from: WINDOW_START }),
      storage.getHealthHistoryBaseline(ids, TEST_TENANT_ID, WINDOW_START),
    ]);

    const merged = mergeHealthHistory(baseline, windowHistory);

    // 3 baseline + 2 in-window (active amber + active red) = 5 total.
    assert.equal(merged.length, 5, "expected baseline and in-window records combined");

    // Strictly non-decreasing by recordedAt.
    for (let i = 1; i < merged.length; i++) {
      const prev = new Date(merged[i - 1].recordedAt).getTime();
      const curr = new Date(merged[i].recordedAt).getTime();
      assert.ok(prev <= curr, `merged history out of chronological order at index ${i}`);
    }

    // The three baseline records (which predate the window) must sort ahead of
    // the in-window changes.
    const firstThree = merged.slice(0, 3);
    for (const r of firstThree) {
      assert.ok(
        new Date(r.recordedAt).getTime() <= WINDOW_START.getTime(),
        "the earliest three records should be the pre-window baselines",
      );
    }
  });

  it("a project whose only record predates the window still contributes to the earliest trend point", async () => {
    const ids = [staleGreenId, staleRedId, activeId];
    const [windowHistory, baseline] = await Promise.all([
      storage.getHealthHistoryByTimelineIds(ids, TEST_TENANT_ID, { from: WINDOW_START }),
      storage.getHealthHistoryBaseline(ids, TEST_TENANT_ID, WINDOW_START),
    ]);
    const merged = mergeHealthHistory(baseline, windowHistory);

    const trend = buildHealthTrend(merged, WINDOW_START, NOW.getTime());
    assert.ok(trend.length > 0, "expected trend points");

    // Earliest point: all three projects reflect their baseline status.
    // staleGreen=green, active=green, staleRed=red.
    const first = trend[0];
    assert.equal(first.Green, 2, "earliest point should count both green baselines");
    assert.equal(first.Red, 1, "earliest point should count the red baseline");
    assert.equal(first.Amber, 0, "no amber at the earliest point");
    assert.equal(
      first.Green + first.Amber + first.Red,
      3,
      "all three projects must be represented from the very first point",
    );

    // Latest point: active has progressed to red (10 days ago), staleGreen still
    // green, staleRed still red => green=1, red=2.
    const last = trend[trend.length - 1];
    assert.equal(last.Green, 1, "only the stale-green project remains green at the end");
    assert.equal(last.Red, 2, "active project regressed to red, joining stale-red");
    assert.equal(last.Amber, 0, "active project moved past amber to red by the end");
  });
});
