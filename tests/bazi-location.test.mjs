import assert from "node:assert/strict";
import test from "node:test";
import { validateLocationRuntime } from "../scripts/validate-bazi-location-runtime.mjs";

test("frozen location registry drives the complete deterministic Bazi pipeline", () => {
  const result = validateLocationRuntime();
  assert.equal(result.status, 70);
  assert.equal(result.pillars, 39);
  assert.equal(result.blocked, 25);
  assert.equal(result.assertionsOnly, 6);
  assert.equal(result.warnings, 20);
  assert.equal(result.threePillars, 4);
  assert.equal(result.sameMinute, 12);
  assert.deepEqual(result.c063, { status: "MISMATCH", blockingCode: "LOCATION_TIMEZONE_MISMATCH" });
  assert.equal(result.missingRuntime, 0);
  assert.equal(result.freeTextCases, 5);
});
