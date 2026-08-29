import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOpportunityStatuses } from "./routes/settings";

test("opportunity status settings validation", async (t) => {
  await t.test("rejects non-array input", () => {
    for (const input of ["qualifying", 42, {}, null, undefined]) {
      const result = validateOpportunityStatuses(input);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /list of options/);
    }
  });

  await t.test("rejects malformed entries", () => {
    const cases = [
      [{ value: "qualifying" }],
      [{ label: "Qualifying" }],
      [{ value: "", label: "Empty" }],
      [{ value: "   ", label: "Whitespace" }],
      [{ value: "ok", label: "" }],
      [{ value: 1, label: "Number" }],
      [{ value: "ok", label: 2 }],
      [null],
      ["qualifying"],
    ];
    for (const input of cases) {
      const result = validateOpportunityStatuses(input);
      assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(input)}`);
      if (!result.ok) assert.match(result.error, /list of options/);
    }
  });

  await t.test("rejects duplicate values", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
      { value: "won", label: "Won Again" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /unique/);
  });

  await t.test("rejects whitespace-variant duplicates after trimming", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
      { value: " won ", label: "Padded Won" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /unique/);
  });

  await t.test("rejects missing system statuses", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "negotiating", label: "Negotiating" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /system statuses/);
      assert.match(result.error, /won/);
      assert.match(result.error, /lost/);
      assert.doesNotMatch(result.error, /qualifying/);
    }
  });

  await t.test("rejects removal of a single system status", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "won", label: "Won" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /lost/);
  });

  await t.test("accepts the default system set", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.statuses, [
        { value: "qualifying", label: "Qualifying" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ]);
    }
  });

  await t.test("accepts valid custom sets with extra statuses", () => {
    const result = validateOpportunityStatuses([
      { value: "qualifying", label: "Qualifying" },
      { value: "proposal", label: "Proposal Sent" },
      { value: "negotiating", label: "Negotiating" },
      { value: "won", label: "Closed Won" },
      { value: "lost", label: "Closed Lost" },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.statuses.length, 5);
  });

  await t.test("trims whitespace from values and labels", () => {
    const result = validateOpportunityStatuses([
      { value: " qualifying ", label: "  Qualifying  " },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.statuses[0], { value: "qualifying", label: "Qualifying" });
    }
  });

  await t.test("accepts padded system statuses via trimming", () => {
    const result = validateOpportunityStatuses([
      { value: " qualifying", label: "Qualifying" },
      { value: "won ", label: "Won" },
      { value: " lost ", label: "Lost" },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.statuses.map((s) => s.value), ["qualifying", "won", "lost"]);
    }
  });
});
