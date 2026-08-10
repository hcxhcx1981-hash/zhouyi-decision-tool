import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeBaziTime } from "../src/lib/bazi/bazi-time-normalizer.ts";
import { calculateCivilDay, isGregorianLeapYear, parseCivilDate } from "../src/lib/bazi/civil-day.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { calculateBaziPillars } from "../src/lib/bazi/pillar-core.ts";
import { loadFrozenTimezoneData } from "../src/lib/bazi/timezone-data-node.ts";
import { resolveKnownLocalMinute, resolveLocalCivilDay, resolveReferenceLocalDate } from "../src/lib/bazi/timezone-resolver.ts";

const root = resolve(import.meta.dirname, "..");
const formalCases = JSON.parse(readFileSync(join(root, "data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json"), "utf8"));
const oldFixture = JSON.parse(readFileSync(join(root, "tests/fixtures/bazi_core_normalized_cases_v0.1.1.json"), "utf8"));
const referenceInstantUtc = "2026-08-07T12:00:00Z";

function plusOneDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 86_400_000).toISOString().slice(0, 10);
}

function frozenCaseInput(caseRecord, timezoneData) {
  const source = caseRecord.input;
  const timezone = source.iana_timezone ?? null;
  let localDate = source.local_date ?? "";
  if (localDate.startsWith("$CURRENT_LOCAL_DATE") && timezone) {
    const referenceDate = resolveReferenceLocalDate(timezoneData, timezone, referenceInstantUtc);
    localDate = localDate.endsWith("PLUS_1_DAY") ? plusOneDay(referenceDate) : referenceDate;
  }
  return {
    calendarType: source.calendar_type,
    caseScope: caseRecord.case_scope,
    localDate,
    localTime: source.local_time ?? null,
    timeKnown: source.time_known,
    locationName: source.location_name ?? null,
    ianaTimezone: timezone,
    locationTimezoneStatus: caseRecord.case_id === "BZ-C063-LOCATION-TIMEZONE-MISMATCH" ? "MISMATCH" : "UNKNOWN",
    foldChoice: source.fold_choice ?? null,
    referenceInstantUtc,
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

export function validateTimezoneRuntime() {
  const timezoneData = loadFrozenTimezoneData(root);
  const baziData = loadFrozenBaziData(root);
  assert.equal(timezoneData.datasetSha256, "a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2");
  assert.equal(timezoneData.dataset.zone_count, 598);
  assert.equal(timezoneData.dataset.transition_count, 55_642);

  const counters = { status: 0, pillars: 0, blocked: 0, assertionsOnly: 0, warnings: 0, threePillars: 0, sameMinute: 0 };
  const oldById = new Map(oldFixture.cases.map((record) => [record.source_case_id, record]));
  let oldRangeMatches = 0;
  let oldRangeComparable = 0;
  let oldOffsetMatches = 0;
  let oldOffsetComparable = 0;

  for (const caseRecord of formalCases.cases) {
    const normalized = normalizeBaziTime(frozenCaseInput(caseRecord, timezoneData), timezoneData);
    const result = calculateBaziPillars(normalized.normalizedInput, baziData);
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
      if ("civil_date_valid" in expected.expected_assertions) assert.equal(Boolean(parseCivilDate(normalized.normalizedInput.localDate)), expected.expected_assertions.civil_date_valid);
      if (expected.expected_assertions.day_pillar) assert.equal(result.dayPillar?.text, expected.expected_assertions.day_pillar);
      if ("gregorian_leap_year" in expected.expected_assertions) assert.equal(isGregorianLeapYear(Number(normalized.normalizedInput.localDate.slice(0, 4))), expected.expected_assertions.gregorian_leap_year);
      if (expected.expected_assertions.birth_date_allowed) assert.equal(result.status, "READY");
      if (expected.expected_assertions.days_since_previous_case) assert.equal(result.audit.dayAlgorithmAIndex - calculateCivilDay("2100-02-28").algorithmAIndex, expected.expected_assertions.days_since_previous_case);
      counters.assertionsOnly += 1;
    }
    if (expected.expected_assertions?.utc_offset) assert.equal(offsetText(normalized.resolvedOffsetSeconds), expected.expected_assertions.utc_offset);

    const old = oldById.get(caseRecord.case_id);
    if (normalized.normalizedInput.timeResolutionStatus === "READY" && old.normalized_input.timeResolutionStatus === "READY") {
      const newRange = normalized.normalizedInput.timeKnown ? normalized.normalizedInput.minuteRangeUtc : normalized.normalizedInput.localCivilDayRangeUtc;
      const oldRange = old.normalized_input.timeKnown ? old.normalized_input.minuteRangeUtc : old.normalized_input.localCivilDayRangeUtc;
      if (newRange && oldRange) {
        oldRangeComparable += 1;
        assert.deepEqual(newRange, oldRange, caseRecord.case_id);
        oldRangeMatches += 1;
      }
      if (normalized.resolvedOffsetSeconds !== null && old.normalization_evidence.resolved_utc_offset) {
        oldOffsetComparable += 1;
        assert.equal(offsetText(normalized.resolvedOffsetSeconds), old.normalization_evidence.resolved_utc_offset, caseRecord.case_id);
        oldOffsetMatches += 1;
      }
    }
  }

  assert.deepEqual(counters, { status: 70, pillars: 39, blocked: 25, assertionsOnly: 6, warnings: 20, threePillars: 4, sameMinute: 12 });

  const gap = resolveKnownLocalMinute(timezoneData, "America/New_York", "2024-03-10", "02:30", null);
  assert.equal(gap.status, "NONEXISTENT_LOCAL_TIME");
  const fold = resolveKnownLocalMinute(timezoneData, "America/New_York", "2024-11-03", "01:30", null);
  const earlier = resolveKnownLocalMinute(timezoneData, "America/New_York", "2024-11-03", "01:30", "EARLIER");
  const later = resolveKnownLocalMinute(timezoneData, "America/New_York", "2024-11-03", "01:30", "LATER");
  assert.equal(fold.status, "AMBIGUOUS_LOCAL_TIME");
  assert.equal(earlier.status, "READY");
  assert.equal(later.status, "READY");
  assert.notEqual(earlier.minuteRangeUtc.startUtc, later.minuteRangeUtc.startUtc);
  assert.equal(resolveKnownLocalMinute(timezoneData, "Asia/Shanghai", "1988-04-17", "02:30", null).status, "NONEXISTENT_LOCAL_TIME");
  const springDay = resolveLocalCivilDay(timezoneData, "America/New_York", "2024-03-10").localCivilDayRangeUtc;
  const fallDay = resolveLocalCivilDay(timezoneData, "America/New_York", "2024-11-03").localCivilDayRangeUtc;
  assert.equal(Date.parse(springDay.endUtcExclusive) - Date.parse(springDay.startUtc), 23 * 3_600_000);
  assert.equal(Date.parse(fallDay.endUtcExclusive) - Date.parse(fallDay.startUtc), 25 * 3_600_000);
  const dateLineEvidence = timezoneData.dataset.special_behavior_evidence.international_date_line_jump;
  const dateLineZone = timezoneData.zonesById.get(dateLineEvidence.zone_id);
  const dateLineTransition = dateLineZone.transitions.find((item) => item.instant_utc === dateLineEvidence.instant_utc);
  const skippedLocalDate = new Date(Date.parse(dateLineTransition.instant_utc) + dateLineTransition.offset_before_seconds * 1000).toISOString().slice(0, 10);
  assert.equal(resolveLocalCivilDay(timezoneData, dateLineEvidence.zone_id, skippedLocalDate).status, "NONEXISTENT_LOCAL_TIME");

  let nonMinuteAlignedTransitions = 0;
  let partialMinuteCases = 0;
  let partialMinutePass = 0;
  const nonMinuteAlignedZones = new Set();
  for (const zone of timezoneData.dataset.zones) {
    for (const transition of zone.transitions) {
      const instantMs = Date.parse(transition.instant_utc);
      if (new Date(instantMs).getUTCSeconds() === 0) continue;
      nonMinuteAlignedTransitions += 1;
      nonMinuteAlignedZones.add(zone.zone_id);
      const localBoundaries = new Set([
        instantMs + transition.offset_before_seconds * 1000,
        instantMs + transition.offset_after_seconds * 1000,
      ]);
      for (const localBoundary of localBoundaries) {
        if (((localBoundary % 60_000) + 60_000) % 60_000 === 0) continue;
        const minuteText = new Date(Math.floor(localBoundary / 60_000) * 60_000).toISOString();
        const resolution = resolveKnownLocalMinute(
          timezoneData,
          zone.zone_id,
          minuteText.slice(0, 10),
          minuteText.slice(11, 16),
          null,
        );
        partialMinuteCases += 1;
        assert.notEqual(resolution.status, "NONEXISTENT_LOCAL_TIME", `${zone.zone_id} ${transition.instant_utc}`);
        partialMinutePass += 1;
      }
    }
  }
  assert.ok(nonMinuteAlignedTransitions > 0);
  assert.equal(partialMinutePass, partialMinuteCases);

  const monroviaBefore = resolveKnownLocalMinute(timezoneData, "Africa/Monrovia", "1972-01-07", "00:43", null);
  const monroviaPartial = resolveKnownLocalMinute(timezoneData, "Africa/Monrovia", "1972-01-07", "00:44", null);
  const monroviaAfter = resolveKnownLocalMinute(timezoneData, "Africa/Monrovia", "1972-01-07", "00:45", null);
  assert.equal(monroviaBefore.status, "NONEXISTENT_LOCAL_TIME");
  assert.equal(monroviaPartial.status, "READY");
  assert.deepEqual(monroviaPartial.minuteRangeUtc, {
    startUtc: "1972-01-07T00:44:30Z",
    endUtcExclusive: "1972-01-07T00:45:00Z",
  });
  assert.equal(monroviaPartial.resolvedOffsetSeconds, 0);
  assert.equal(monroviaAfter.status, "READY");

  const sourceDirectory = join(root, "src", "lib", "bazi");
  const runtimeFiles = ["timezone-runtime-types.ts", "timezone-data-node.ts", "timezone-resolver.ts", "bazi-time-normalizer.ts"];
  const runtimeSource = runtimeFiles.map((name) => readFileSync(join(sourceDirectory, name), "utf8")).join("\n");
  for (const forbidden of [/BZ-C/, /TEST_PYTHON_ZONEINFO_FIXTURE/, /research[\\/]bazi/i, /Intl\.DateTimeFormat/, /\bTemporal\b/, /Math\.random/, /fetch\s*\(/, /\bmoment\b/i, /\bluxon\b/i, /dayjs/i, /date-fns/i, /UTC\+?8/i]) {
    assert.doesNotMatch(runtimeSource, forbidden);
  }
  assert.ok(runtimeFiles.every((name) => readdirSync(sourceDirectory).includes(name)));

  return {
    ...counters,
    oldRangeMatches,
    oldRangeComparable,
    oldOffsetMatches,
    oldOffsetComparable,
    gapStatus: gap.status,
    foldStatus: fold.status,
    earlierUtc: earlier.minuteRangeUtc.startUtc,
    laterUtc: later.minuteRangeUtc.startUtc,
    shanghaiHistoricalGap: "NONEXISTENT_LOCAL_TIME",
    nonMinuteAlignedTransitions,
    nonMinuteAlignedZoneCount: nonMinuteAlignedZones.size,
    partialMinuteCases,
    partialMinutePass,
    monroviaBefore,
    monroviaPartial,
    monroviaAfter,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = validateTimezoneRuntime();
  console.log(`STATUS=${summary.status}/70`);
  console.log(`PILLARS=${summary.pillars}/39`);
  console.log(`BLOCKED=${summary.blocked}/25`);
  console.log(`ASSERTIONS=${summary.assertionsOnly}/6`);
  console.log(`WARNINGS=${summary.warnings}/20`);
  console.log(`THREE_PILLARS=${summary.threePillars}/4`);
  console.log(`SAME_MINUTE=${summary.sameMinute}/12`);
  console.log(`OLD_FIXTURE_RANGES=${summary.oldRangeMatches}/${summary.oldRangeComparable}`);
  console.log(`OLD_FIXTURE_OFFSETS=${summary.oldOffsetMatches}/${summary.oldOffsetComparable}`);
  console.log(`DST_GAP=${summary.gapStatus}`);
  console.log(`DST_FOLD=${summary.foldStatus};EARLIER=${summary.earlierUtc};LATER=${summary.laterUtc}`);
  console.log(`ASIA_SHANGHAI_HISTORICAL_DST=${summary.shanghaiHistoricalGap}`);
  console.log(`NON_MINUTE_ALIGNED_TRANSITIONS=${summary.nonMinuteAlignedTransitions}`);
  console.log(`NON_MINUTE_ALIGNED_ZONES=${summary.nonMinuteAlignedZoneCount}`);
  console.log(`PARTIAL_MINUTE_CASES=${summary.partialMinuteCases}`);
  console.log(`PARTIAL_MINUTE_PASS=${summary.partialMinutePass}`);
  console.log(`MONROVIA_0043=${summary.monroviaBefore.status}`);
  console.log(`MONROVIA_0044=${summary.monroviaPartial.status};RANGE=${summary.monroviaPartial.minuteRangeUtc.startUtc}/${summary.monroviaPartial.minuteRangeUtc.endUtcExclusive}`);
  console.log(`MONROVIA_0045=${summary.monroviaAfter.status}`);
  console.log("BAZI_TIMEZONE_RUNTIME: ALL PASS");
}
