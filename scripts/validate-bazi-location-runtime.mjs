import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { calculateDeterministicBazi } from "../src/lib/bazi/bazi-deterministic-pipeline.ts";
import { calculateCivilDay, isGregorianLeapYear, parseCivilDate } from "../src/lib/bazi/civil-day.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { loadFrozenLocationData } from "../src/lib/bazi/location-data-node.ts";
import { resolveLocationSelection } from "../src/lib/bazi/location-resolver.ts";
import { loadFrozenTimezoneData } from "../src/lib/bazi/timezone-data-node.ts";
import { resolveReferenceLocalDate } from "../src/lib/bazi/timezone-resolver.ts";

const root = resolve(import.meta.dirname, "..");
const casesDocument = JSON.parse(readFileSync(join(root, "data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json"), "utf8"));
const referenceInstantUtc = "2026-08-07T12:00:00Z";

function plusOneDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 86_400_000).toISOString().slice(0, 10);
}

function pipelineInput(caseRecord, timezoneData) {
  const source = caseRecord.input;
  const claimed = source.iana_timezone ?? null;
  let localDate = source.local_date ?? "";
  if (localDate.startsWith("$CURRENT_LOCAL_DATE") && claimed && timezoneData.zonesById.has(claimed)) {
    const referenceDate = resolveReferenceLocalDate(timezoneData, claimed, referenceInstantUtc);
    localDate = localDate.endsWith("PLUS_1_DAY") ? plusOneDay(referenceDate) : referenceDate;
  }
  const registered = Object.hasOwn(source, "location_id");
  return {
    calendarType: source.calendar_type,
    caseScope: caseRecord.case_scope,
    localDate,
    localTime: source.local_time ?? null,
    timeKnown: source.time_known,
    foldChoice: source.fold_choice ?? null,
    referenceInstantUtc,
    locationSelection: {
      mode: registered ? "REGISTERED_LOCATION" : "MANUAL_IANA",
      locationId: registered ? source.location_id ?? null : null,
      locationName: source.location_name ?? null,
      claimedIanaTimezone: claimed,
    },
  };
}

function expectedFields(caseRecord) {
  return Object.fromEntries(Object.entries(caseRecord).filter(([key]) => key.startsWith("expected_")));
}

function offsetText(seconds) {
  const sign = seconds >= 0 ? "+" : "-";
  const absolute = Math.abs(seconds);
  return `${sign}${String(Math.floor(absolute / 3600)).padStart(2, "0")}:${String((absolute % 3600) / 60).padStart(2, "0")}`;
}

function fixedInput(selection) {
  return {
    calendarType: "GREGORIAN",
    caseScope: "PRODUCT_INPUT",
    localDate: "2024-01-15",
    localTime: "08:30",
    timeKnown: true,
    foldChoice: null,
    referenceInstantUtc,
    locationSelection: selection,
  };
}

export function validateLocationRuntime() {
  const locationData = loadFrozenLocationData(root);
  const timezoneData = loadFrozenTimezoneData(root);
  const baziData = loadFrozenBaziData(root);
  const data = { locationData, timezoneData, baziData };
  const counters = { status: 0, pillars: 0, blocked: 0, assertionsOnly: 0, warnings: 0, threePillars: 0, sameMinute: 0 };
  let c063 = null;

  for (const caseRecord of casesDocument.cases) {
    const pipeline = calculateDeterministicBazi(pipelineInput(caseRecord, timezoneData), data);
    const result = pipeline.coreResult;
    const expected = expectedFields(caseRecord);
    if (expected.expected_blocking_code) {
      assert.equal(result.status, "BLOCKED", caseRecord.case_id);
      assert.equal(result.blockingCode, expected.expected_blocking_code, caseRecord.case_id);
      counters.blocked += 1;
      if (expected.expected_blocking_code === "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS") counters.sameMinute += 1;
    } else {
      assert.equal(result.status, "READY", caseRecord.case_id);
    }
    counters.status += 1;
    if (expected.expected_pillars) {
      assert.deepEqual({ year: result.yearPillar?.text ?? null, month: result.monthPillar?.text ?? null, day: result.dayPillar?.text ?? null, hour: result.hourPillar?.text ?? null }, expected.expected_pillars, caseRecord.case_id);
      counters.pillars += 1;
    }
    if (expected.expected_completeness) {
      assert.equal(result.completeness, expected.expected_completeness, caseRecord.case_id);
      counters.threePillars += 1;
    }
    assert.deepEqual(result.warnings, expected.expected_warnings ?? [], caseRecord.case_id);
    if (expected.expected_warnings) counters.warnings += 1;
    if (expected.expected_assertions && !expected.expected_pillars) {
      const normalized = pipeline.timezoneAudit.normalizedInput;
      if ("civil_date_valid" in expected.expected_assertions) assert.equal(Boolean(parseCivilDate(normalized.localDate)), expected.expected_assertions.civil_date_valid);
      if (expected.expected_assertions.day_pillar) assert.equal(result.dayPillar?.text, expected.expected_assertions.day_pillar);
      if ("gregorian_leap_year" in expected.expected_assertions) assert.equal(isGregorianLeapYear(Number(normalized.localDate.slice(0, 4))), expected.expected_assertions.gregorian_leap_year);
      if (expected.expected_assertions.birth_date_allowed) assert.equal(result.status, "READY");
      if (expected.expected_assertions.days_since_previous_case) assert.equal(result.audit.dayAlgorithmAIndex - calculateCivilDay("2100-02-28").algorithmAIndex, expected.expected_assertions.days_since_previous_case);
      counters.assertionsOnly += 1;
    }
    if (expected.expected_assertions?.utc_offset) assert.equal(offsetText(pipeline.timezoneAudit.resolvedOffsetSeconds), expected.expected_assertions.utc_offset);

    if (caseRecord.input.location_id === "CN-MAINLAND" && caseRecord.input.iana_timezone === "America/New_York") {
      c063 = { status: pipeline.locationAudit.locationTimezoneStatus, blockingCode: result.blockingCode };
    }
  }
  assert.deepEqual(counters, { status: 70, pillars: 39, blocked: 25, assertionsOnly: 6, warnings: 20, threePillars: 4, sameMinute: 12 });
  assert.deepEqual(c063, { status: "MISMATCH", blockingCode: "LOCATION_TIMEZONE_MISMATCH" });

  const freeTextNames = ["北京", "上海", "abc", "火星", "任意测试字符串"];
  const freeTextResults = freeTextNames.map((locationName) => calculateDeterministicBazi(fixedInput({ mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", locationName, claimedIanaTimezone: "Asia/Shanghai" }), data));
  for (const result of freeTextResults) {
    assert.equal(result.locationAudit.locationTimezoneStatus, "MATCH");
    assert.equal(result.locationAudit.resolvedIanaTimezone, "Asia/Shanghai");
    assert.equal(result.coreResult.status, "READY");
  }
  const baseline = freeTextResults[0];
  for (const result of freeTextResults.slice(1)) {
    assert.deepEqual(result.timezoneAudit.normalizedInput.minuteRangeUtc, baseline.timezoneAudit.normalizedInput.minuteRangeUtc);
    assert.deepEqual([result.coreResult.yearPillar, result.coreResult.monthPillar, result.coreResult.dayPillar, result.coreResult.hourPillar], [baseline.coreResult.yearPillar, baseline.coreResult.monthPillar, baseline.coreResult.dayPillar, baseline.coreResult.hourPillar]);
  }
  for (const locationName of freeTextNames) {
    const mismatch = calculateDeterministicBazi(fixedInput({ mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", locationName, claimedIanaTimezone: "America/New_York" }), data);
    assert.equal(mismatch.locationAudit.locationTimezoneStatus, "MISMATCH");
    assert.equal(mismatch.coreResult.blockingCode, "LOCATION_TIMEZONE_MISMATCH");
  }

  const manualZones = ["Asia/Shanghai", "America/New_York", "Pacific/Honolulu"];
  for (const zone of manualZones) {
    const manual = calculateDeterministicBazi(fixedInput({ mode: "MANUAL_IANA", locationId: null, locationName: "display only", claimedIanaTimezone: zone }), data);
    assert.equal(manual.locationAudit.locationTimezoneStatus, "UNKNOWN");
    assert.equal(manual.locationAudit.resolvedIanaTimezone, zone);
    assert.notEqual(manual.coreResult.blockingCode, "TIMEZONE_REQUIRED");
  }
  const invalid = calculateDeterministicBazi(fixedInput({ mode: "MANUAL_IANA", locationId: null, locationName: "display only", claimedIanaTimezone: "Example/Not_A_Zone" }), data);
  assert.equal(invalid.locationAudit.locationTimezoneStatus, "UNKNOWN");
  assert.equal(invalid.locationAudit.resolvedIanaTimezone, null);
  assert.equal(invalid.coreResult.blockingCode, "TIMEZONE_REQUIRED");

  const unknownRegistered = calculateDeterministicBazi(fixedInput({ mode: "REGISTERED_LOCATION", locationId: "UNKNOWN", locationName: "display only", claimedIanaTimezone: "Asia/Shanghai" }), data);
  assert.equal(unknownRegistered.coreResult.blockingCode, "LOCATION_REQUIRED");
  const missingName = calculateDeterministicBazi(fixedInput({ mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", locationName: null, claimedIanaTimezone: "Asia/Shanghai" }), data);
  assert.equal(missingName.coreResult.blockingCode, "LOCATION_REQUIRED");

  let missingRuntime = 0;
  for (const entry of locationData.registry.iana_zone_directory) {
    if (!timezoneData.zonesById.has(entry.zone_id)) missingRuntime += 1;
  }
  assert.equal(missingRuntime, 0);

  const runtimeFiles = ["location-runtime-types.ts", "location-data-node.ts", "location-resolver.ts", "bazi-deterministic-pipeline.ts"];
  const runtimeSource = runtimeFiles.map((name) => readFileSync(join(root, "src/lib/bazi", name), "utf8")).join("\n");
  for (const forbidden of [/BZ-C/, /北京[\s\S]*Asia\/Shanghai/, /New York/i, /fetch\s*\(/, /geolocation/i, /Intl\.DateTimeFormat/, /\bTemporal\b/, /Math\.random/, /https?:\/\//, /research[\\/]bazi/i]) {
    assert.doesNotMatch(runtimeSource, forbidden);
  }
  for (const mapping of ["CN-MAINLAND", "US-NY", "US-LA", "US-HNL"]) {
    assert.equal((runtimeSource.match(new RegExp(mapping, "g")) ?? []).length, 0);
  }

  const directCn = resolveLocationSelection({ mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", locationName: "x", claimedIanaTimezone: null }, locationData, timezoneData);
  assert.equal(directCn.locationTimezoneStatus, "MATCH");
  assert.equal(directCn.ianaTimezone, "Asia/Shanghai");

  return {
    ...counters,
    c063,
    manualZones,
    invalidBlockingCode: invalid.coreResult.blockingCode,
    freeTextCases: freeTextNames.length,
    mismatchFreeTextCases: freeTextNames.length,
    zone1970Count: locationData.registry.iana_zone1970_entry_count,
    missingRuntime,
    directCn,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = validateLocationRuntime();
  console.log(`STATUS=${summary.status}/70`);
  console.log(`PILLARS=${summary.pillars}/39`);
  console.log(`BLOCKED=${summary.blocked}/25`);
  console.log(`ASSERTIONS=${summary.assertionsOnly}/6`);
  console.log(`WARNINGS=${summary.warnings}/20`);
  console.log(`THREE_PILLARS=${summary.threePillars}/4`);
  console.log(`SAME_MINUTE=${summary.sameMinute}/12`);
  console.log(`C063=${summary.c063.status}/${summary.c063.blockingCode}`);
  console.log(`MANUAL_IANA=${summary.manualZones.join(",")}:UNKNOWN/ALLOWED`);
  console.log(`INVALID_IANA=${summary.invalidBlockingCode}`);
  console.log(`FREE_TEXT_INVARIANT=${summary.freeTextCases}/5 MATCH;${summary.mismatchFreeTextCases}/5 MISMATCH`);
  console.log(`ZONE1970_ZONE_COUNT=${summary.zone1970Count}`);
  console.log(`ZONE1970_MISSING_IN_RUNTIME=${summary.missingRuntime}`);
  console.log("BAZI_LOCATION_RUNTIME: ALL PASS");
}
