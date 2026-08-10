import assert from "node:assert/strict";
import test from "node:test";

import { calculateDeterministicBazi } from "../src/lib/bazi/bazi-deterministic-pipeline.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { loadFrozenLocationData } from "../src/lib/bazi/location-data-node.ts";
import { loadFrozenTimezoneData } from "../src/lib/bazi/timezone-data-node.ts";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const data = {
  baziData: loadFrozenBaziData(root),
  locationData: loadFrozenLocationData(root),
  timezoneData: loadFrozenTimezoneData(root),
};

function run({
  calendarType = "GREGORIAN",
  localDate = "2024-01-15",
  localTime = "08:30",
  timeKnown = true,
  mode = "MANUAL_IANA",
  locationId = null,
  claimedIanaTimezone = "Asia/Shanghai",
} = {}) {
  return calculateDeterministicBazi({
    calendarType,
    caseScope: "PRODUCT_INPUT",
    localDate,
    localTime,
    timeKnown,
    foldChoice: null,
    referenceInstantUtc: "2026-08-07T12:00:00Z",
    locationSelection: {
      mode,
      locationId,
      locationName: "display only",
      claimedIanaTimezone,
    },
  }, data);
}

function rules(result) {
  const ids = result.coreResult.audit.appliedRuleIds;
  assert.equal(ids.length, new Set(ids).size, "rule trace must not contain duplicates");
  return ids;
}

test("lunar input stops before timezone, solar-term, and pillar rules", () => {
  const result = run({ calendarType: "LUNAR", localDate: "" });
  assert.equal(result.coreResult.blockingCode, "LUNAR_INPUT_NOT_SUPPORTED_V0_1");
  assert.deepEqual(rules(result), ["CAL-GREGORIAN-ONLY-001"]);
});

test("registered location mismatch stops before solar-term and pillar rules", () => {
  const result = run({ mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", claimedIanaTimezone: "America/New_York" });
  assert.equal(result.coreResult.blockingCode, "LOCATION_TIMEZONE_MISMATCH");
  assert.deepEqual(rules(result), [
    "CAL-GREGORIAN-ONLY-001",
    "CAL-BIRTH-INPUT-RANGE-002B",
    "INPUT-CIVIL-TIME-001",
    "TZ-IANA-001",
    "TZ-MAINLAND-002",
  ]);
});

test("same-minute boundary records only reached boundary rules", () => {
  const result = run({ localDate: "2024-02-04", localTime: "16:26" });
  assert.equal(result.coreResult.blockingCode, "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS");
  const applied = rules(result);
  for (const id of ["CAL-JIEQI-INSTANT-003", "CAL-MINUTE-INTERVAL-005", "YEAR-LICHUN-001", "MONTH-JIE-001"]) {
    assert.ok(applied.includes(id), id);
  }
  for (const id of ["DAY-BASELINE-001", "DAY-CONTINUOUS-COUNT-002", "HOUR-BRANCH-001", "HOUR-FIVE-RAT-002"]) {
    assert.ok(!applied.includes(id), id);
  }
});

test("unknown ordinary time records unknown-hour policy without hour algorithms", () => {
  const result = run({ localTime: null, timeKnown: false });
  assert.equal(result.coreResult.completeness, "THREE_PILLARS_ONLY");
  const applied = rules(result);
  assert.ok(applied.includes("INPUT-UNKNOWN-TIME-002"));
  assert.ok(applied.includes("UNKNOWN-HOUR-001"));
  assert.ok(applied.includes("UNKNOWN-HOUR-SOLAR-TERM-DAY-002"));
  assert.ok(!applied.includes("HOUR-BRANCH-001"));
  assert.ok(!applied.includes("HOUR-FIVE-RAT-002"));
});

test("normal four-pillar result records the algorithms actually reached", () => {
  const result = run();
  assert.equal(result.coreResult.status, "READY");
  const applied = rules(result);
  for (const id of [
    "CAL-GREGORIAN-ONLY-001", "INPUT-CIVIL-TIME-001", "TZ-IANA-001",
    "CAL-JIEQI-INSTANT-003", "YEAR-LICHUN-001", "YEAR-CYCLE-003",
    "MONTH-JIE-001", "MONTH-FIVE-TIGER-002", "DAY-BASELINE-001",
    "DAY-CONTINUOUS-COUNT-002", "DAY-BOUNDARY-003", "HOUR-BRANCH-001", "HOUR-FIVE-RAT-002",
  ]) assert.ok(applied.includes(id), id);
  assert.ok(!applied.includes("UNKNOWN-HOUR-001"));
  assert.ok(!applied.includes("HOUR-ZI-DAY-COUPLING-003"));
});
