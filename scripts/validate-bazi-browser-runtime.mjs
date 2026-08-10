import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { BaziBrowserRuntimeLoader, BAZI_BROWSER_RUNTIME_MANIFEST_PATH, BAZI_BROWSER_RUNTIME_MANIFEST_SHA256 } from "../src/lib/bazi/browser-runtime-loader.ts";
import { calculateDeterministicBazi } from "../src/lib/bazi/bazi-deterministic-pipeline.ts";
import { calculateCivilDay, isGregorianLeapYear, parseCivilDate } from "../src/lib/bazi/civil-day.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { loadFrozenLocationData } from "../src/lib/bazi/location-data-node.ts";
import { loadFrozenTimezoneData } from "../src/lib/bazi/timezone-data-node.ts";
import { resolveKnownLocalMinute } from "../src/lib/bazi/timezone-resolver.ts";
import { resolveReferenceLocalDate } from "../src/lib/bazi/timezone-resolver.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const runtimeRoot = join(publicRoot, "bazi-runtime", "v0.1");
const formalCases = JSON.parse(readFileSync(join(root, "data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json"), "utf8"));
const referenceInstantUtc = "2026-08-07T12:00:00Z";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fakeFetch(path) {
  if (!path.startsWith("/bazi-runtime/v0.1/") || path.includes("..")) return Promise.resolve({ ok: false, status: 400, arrayBuffer: async () => new ArrayBuffer(0) });
  const file = join(publicRoot, ...path.slice(1).split("/"));
  try {
    const bytes = readFileSync(file);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => buffer });
  } catch {
    return Promise.resolve({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  }
}

function plusOneDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 86_400_000).toISOString().slice(0, 10);
}

function caseInput(caseRecord, timezoneData) {
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

function fixedInput(zone, localDate = "2024-01-15", localTime = "08:30") {
  return {
    calendarType: "GREGORIAN",
    caseScope: "PRODUCT_INPUT",
    localDate,
    localTime,
    timeKnown: true,
    foldChoice: null,
    referenceInstantUtc,
    locationSelection: { mode: "MANUAL_IANA", locationId: null, locationName: "display only", claimedIanaTimezone: zone },
  };
}

function verifyDescriptor(descriptor) {
  const file = join(publicRoot, ...descriptor.path.slice(1).split("/"));
  const bytes = readFileSync(file);
  assert.equal(bytes.length, descriptor.byte_size, descriptor.path);
  assert.equal(digest(bytes), descriptor.sha256, descriptor.path);
}

export async function validateBrowserRuntime() {
  const manifestBytes = readFileSync(join(runtimeRoot, "manifest.json"));
  assert.equal(digest(manifestBytes), BAZI_BROWSER_RUNTIME_MANIFEST_SHA256);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.status, "DERIVED_RUNTIME_ASSETS");
  assert.equal(BAZI_BROWSER_RUNTIME_MANIFEST_PATH, "/bazi-runtime/v0.1/manifest.json");
  verifyDescriptor(manifest.location_asset);
  verifyDescriptor(manifest.timezone_index_asset);
  verifyDescriptor(manifest.solar_index_asset);
  const timezoneIndex = JSON.parse(readFileSync(join(runtimeRoot, "timezone/index.json"), "utf8"));
  const solarIndex = JSON.parse(readFileSync(join(runtimeRoot, "solar/index.json"), "utf8"));
  assert.equal(timezoneIndex.zones.length, 598);
  assert.equal(solarIndex.years.length, 133);
  assert.equal(new Set(timezoneIndex.zones.map((entry) => entry.zone_id)).size, 598);
  assert.equal(new Set(timezoneIndex.zones.map((entry) => entry.path)).size, 598);
  for (const descriptor of timezoneIndex.zones) verifyDescriptor(descriptor);
  for (const descriptor of solarIndex.years) verifyDescriptor(descriptor);

  const nodeData = {
    baziData: loadFrozenBaziData(root),
    locationData: loadFrozenLocationData(root),
    timezoneData: loadFrozenTimezoneData(root),
  };
  const counters = { status: 0, pillars: 0, blocked: 0, assertionsOnly: 0, warnings: 0, threePillars: 0, sameMinute: 0, nodeBrowserEqual: 0 };
  for (const caseRecord of formalCases.cases) {
    const input = caseInput(caseRecord, nodeData.timezoneData);
    const nodeResult = calculateDeterministicBazi(input, nodeData);
    const loaded = await new BaziBrowserRuntimeLoader(fakeFetch).loadForInput(input);
    const browserResult = calculateDeterministicBazi(input, loaded.data);
    assert.deepEqual(browserResult, nodeResult, caseRecord.case_id);
    counters.nodeBrowserEqual += 1;
    const result = browserResult.coreResult;
    const expected = expectedFields(caseRecord);
    if (expected.expected_blocking_code) {
      assert.equal(result.status, "BLOCKED", caseRecord.case_id);
      assert.equal(result.blockingCode, expected.expected_blocking_code, caseRecord.case_id);
      counters.blocked += 1;
      if (result.blockingCode === "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS") counters.sameMinute += 1;
    } else assert.equal(result.status, "READY", caseRecord.case_id);
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
      const normalized = browserResult.timezoneAudit.normalizedInput;
      if ("civil_date_valid" in expected.expected_assertions) assert.equal(Boolean(parseCivilDate(normalized.localDate)), expected.expected_assertions.civil_date_valid);
      if (expected.expected_assertions.day_pillar) assert.equal(result.dayPillar?.text, expected.expected_assertions.day_pillar);
      if ("gregorian_leap_year" in expected.expected_assertions) assert.equal(isGregorianLeapYear(Number(normalized.localDate.slice(0, 4))), expected.expected_assertions.gregorian_leap_year);
      if (expected.expected_assertions.birth_date_allowed) assert.equal(result.status, "READY");
      if (expected.expected_assertions.days_since_previous_case) assert.equal(result.audit.dayAlgorithmAIndex - calculateCivilDay("2100-02-28").algorithmAIndex, expected.expected_assertions.days_since_previous_case);
      counters.assertionsOnly += 1;
    }
    if (expected.expected_assertions?.utc_offset) assert.equal(offsetText(browserResult.timezoneAudit.resolvedOffsetSeconds), expected.expected_assertions.utc_offset);
  }
  assert.deepEqual(counters, { status: 70, pillars: 39, blocked: 25, assertionsOnly: 6, warnings: 20, threePillars: 4, sameMinute: 12, nodeBrowserEqual: 70 });

  async function timezoneSlice(zone, localDate = "2024-01-15") {
    return (await new BaziBrowserRuntimeLoader(fakeFetch).loadForInput(fixedInput(zone, localDate))).data.timezoneData;
  }
  const newYork = await timezoneSlice("America/New_York");
  const gap = resolveKnownLocalMinute(newYork, "America/New_York", "2024-03-10", "02:30", null);
  const fold = resolveKnownLocalMinute(newYork, "America/New_York", "2024-11-03", "01:30", null);
  const earlier = resolveKnownLocalMinute(newYork, "America/New_York", "2024-11-03", "01:30", "EARLIER");
  const later = resolveKnownLocalMinute(newYork, "America/New_York", "2024-11-03", "01:30", "LATER");
  assert.equal(gap.status, "NONEXISTENT_LOCAL_TIME");
  assert.equal(fold.status, "AMBIGUOUS_LOCAL_TIME");
  assert.equal(earlier.status, "READY");
  assert.equal(later.status, "READY");
  const shanghai = await timezoneSlice("Asia/Shanghai", "1988-04-17");
  assert.equal(resolveKnownLocalMinute(shanghai, "Asia/Shanghai", "1988-04-17", "02:30", null).status, "NONEXISTENT_LOCAL_TIME");
  const monrovia = await timezoneSlice("Africa/Monrovia", "1972-01-07");
  const monroviaPartial = resolveKnownLocalMinute(monrovia, "Africa/Monrovia", "1972-01-07", "00:44", null);
  assert.equal(monroviaPartial.status, "READY");
  assert.deepEqual(monroviaPartial.minuteRangeUtc, { startUtc: "1972-01-07T00:44:30Z", endUtcExclusive: "1972-01-07T00:45:00Z" });

  const typicalInput = {
    ...fixedInput("Asia/Shanghai"),
    locationSelection: { mode: "REGISTERED_LOCATION", locationId: "CN-MAINLAND", locationName: "display only", claimedIanaTimezone: null },
  };
  const typical = await new BaziBrowserRuntimeLoader(fakeFetch).loadForInput(typicalInput);
  assert.ok(typical.loadedBytes < 300_000);
  assert.equal(typical.loadedAssetPaths.filter((path) => path.includes("/timezone/zones/")).length, 1);
  assert.equal(typical.loadedAssetPaths.filter((path) => path.includes("/solar/years/")).length, 3);
  assert.ok(!typical.loadedAssetPaths.includes("/data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json"));

  const runtimeSource = ["browser-runtime-types.ts", "browser-runtime-loader.ts", "bazi-page-contract.ts"].map((name) => readFileSync(join(root, "src/lib/bazi", name), "utf8")).join("\n");
  for (const forbidden of [/node:fs/, /node:path/, /node:crypto/, /Intl\.DateTimeFormat/, /\bTemporal\b/, /Date\.now/, /Math\.random/, /https?:\/\//, /research[\\/]/i]) assert.doesNotMatch(runtimeSource, forbidden);
  assert.equal(readdirSync(join(runtimeRoot, "timezone/zones")).length, 598);
  assert.equal(readdirSync(join(runtimeRoot, "solar/years")).length, 133);
  assert.equal(statSync(join(root, "data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json")).size, 16_679_716);

  return {
    ...counters,
    timezoneChunks: timezoneIndex.zones.length,
    solarChunks: solarIndex.years.length,
    gap: gap.status,
    fold: fold.status,
    earlierUtc: earlier.minuteRangeUtc.startUtc,
    laterUtc: later.minuteRangeUtc.startUtc,
    shanghaiHistoricalDst: "NONEXISTENT_LOCAL_TIME",
    monroviaPartial,
    typicalBytes: typical.loadedBytes,
    typicalAssetCount: typical.loadedAssetPaths.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = await validateBrowserRuntime();
  console.log(`STATUS=${summary.status}/70`);
  console.log(`PILLARS=${summary.pillars}/39`);
  console.log(`BLOCKED=${summary.blocked}/25`);
  console.log(`ASSERTIONS=${summary.assertionsOnly}/6`);
  console.log(`WARNINGS=${summary.warnings}/20`);
  console.log(`THREE_PILLARS=${summary.threePillars}/4`);
  console.log(`SAME_MINUTE=${summary.sameMinute}/12`);
  console.log(`NODE_BROWSER_EQUAL=${summary.nodeBrowserEqual}/70`);
  console.log(`TIMEZONE_CHUNKS=${summary.timezoneChunks}`);
  console.log(`SOLAR_YEAR_CHUNKS=${summary.solarChunks}`);
  console.log(`NY_GAP=${summary.gap}`);
  console.log(`NY_FOLD=${summary.fold};EARLIER=${summary.earlierUtc};LATER=${summary.laterUtc}`);
  console.log(`SHANGHAI_HISTORICAL_DST=${summary.shanghaiHistoricalDst}`);
  console.log(`MONROVIA_0044=${summary.monroviaPartial.status};RANGE=${summary.monroviaPartial.minuteRangeUtc.startUtc}/${summary.monroviaPartial.minuteRangeUtc.endUtcExclusive}`);
  console.log(`CN_MAINLAND_2024_LOADED_BYTES=${summary.typicalBytes};ASSETS=${summary.typicalAssetCount}`);
  console.log("BAZI_BROWSER_RUNTIME: ALL PASS");
}
