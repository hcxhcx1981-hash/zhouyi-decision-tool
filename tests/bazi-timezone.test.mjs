import assert from "node:assert/strict";
import test from "node:test";
import { validateTimezoneRuntime } from "../scripts/validate-bazi-timezone-runtime.mjs";

test("frozen IANA timezone adapter passes formal end-to-end regression", () => {
  const result = validateTimezoneRuntime();
  assert.equal(result.status, 70);
  assert.equal(result.pillars, 39);
  assert.equal(result.blocked, 25);
  assert.equal(result.warnings, 20);
  assert.equal(result.sameMinute, 12);
  assert.equal(result.oldRangeMatches, result.oldRangeComparable);
  assert.equal(result.oldOffsetMatches, result.oldOffsetComparable);
  assert.equal(result.nonMinuteAlignedTransitions, 1);
  assert.equal(result.nonMinuteAlignedZoneCount, 1);
  assert.equal(result.partialMinuteCases, 1);
  assert.equal(result.partialMinutePass, 1);
  assert.equal(result.monroviaBefore.status, "NONEXISTENT_LOCAL_TIME");
  assert.equal(result.monroviaPartial.status, "READY");
  assert.deepEqual(result.monroviaPartial.minuteRangeUtc, {
    startUtc: "1972-01-07T00:44:30Z",
    endUtcExclusive: "1972-01-07T00:45:00Z",
  });
  assert.equal(result.monroviaAfter.status, "READY");
});
