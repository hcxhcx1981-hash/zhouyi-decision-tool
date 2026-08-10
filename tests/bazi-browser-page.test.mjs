import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { loadVerifiedIanaZoneIds, runBaziBrowserPipeline } from "../src/lib/bazi/bazi-browser-pipeline.ts";
import { getBaziBlockingMessage } from "../src/lib/bazi/bazi-result-messages.ts";

const publicRoot = join(process.cwd(), "public");
const referenceInstantUtc = "2026-08-07T12:00:00Z";
const formalCases = JSON.parse(readFileSync("data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json", "utf8"));
const normalModernCase = formalCases.cases.find((entry) => entry.case_id === "BZ-C001-WINTER-MORNING");
if (!normalModernCase) throw new Error("NORMAL_MODERN_FIXTURE_MISSING");

function fakeFetch(path) {
  try {
    const bytes = readFileSync(join(publicRoot, ...path.slice(1).split("/")));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => buffer });
  } catch {
    return Promise.resolve({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  }
}

function draft(overrides = {}) {
  return {
    calendarType: "GREGORIAN",
    localDate: normalModernCase.input.local_date,
    localTime: normalModernCase.input.local_time,
    timeKnown: true,
    gender: "MALE",
    locationName: "fixture display",
    selectionMode: "REGISTERED_LOCATION",
    registeredLocationId: "CN-MAINLAND",
    manualIanaTimezone: null,
    foldChoice: null,
    referenceInstantUtc,
    ...overrides,
  };
}

async function run(overrides = {}) {
  return runBaziBrowserPipeline(draft(overrides), { fetchImpl: fakeFetch, referenceInstantUtc });
}

test("普通中国大陆输入生成四柱且 runtime 小于 300KB", async () => {
  const output = await run();
  assert.equal(output.result.coreResult.status, "READY");
  assert.equal(output.result.coreResult.completeness, "FOUR_PILLARS");
  assert.ok(output.result.coreResult.hourPillar);
  assert.ok(output.loadedBytes < 300_000);
  assert.equal(output.loadedAssetPaths.filter((path) => path.includes("/timezone/zones/")).length, 1);
  assert.ok(output.loadedAssetPaths.every((path) => !path.includes("data/frozen")));
});

test("未知时辰只生成三柱，性别不影响四柱", async () => {
  const unknown = await run({ timeKnown: false, localTime: null });
  assert.equal(unknown.result.coreResult.completeness, "THREE_PILLARS_ONLY");
  assert.equal(unknown.result.coreResult.hourPillar, null);
  const male = await run({ gender: "MALE" });
  const female = await run({ gender: "FEMALE" });
  assert.deepEqual(female.result.coreResult, male.result.coreResult);
});

test("正式 IANA 目录含 598 zones，manual IANA 可成功排盘", async () => {
  const zones = await loadVerifiedIanaZoneIds(fakeFetch);
  assert.equal(zones.length, 598);
  assert.ok(zones.includes("America/New_York"));
  const output = await run({ selectionMode: "MANUAL_IANA", registeredLocationId: null, manualIanaTimezone: "America/New_York" });
  assert.equal(output.result.coreResult.status, "READY");
});

test("New York fold 首次阻断，EARLIER/LATER 均 READY 且 UTC 不同", async () => {
  const common = { localDate: "2024-11-03", localTime: "01:30", selectionMode: "MANUAL_IANA", registeredLocationId: null, manualIanaTimezone: "America/New_York" };
  const first = await run(common);
  const earlier = await run({ ...common, foldChoice: "EARLIER" });
  const later = await run({ ...common, foldChoice: "LATER" });
  assert.equal(first.result.coreResult.blockingCode, "AMBIGUOUS_LOCAL_TIME");
  assert.equal(earlier.result.coreResult.status, "READY");
  assert.equal(later.result.coreResult.status, "READY");
  assert.notEqual(earlier.result.timezoneAudit.normalizedInput.minuteRangeUtc.startUtc, later.result.timezoneAudit.normalizedInput.minuteRangeUtc.startUtc);
});

test("gap、同分钟、地点与时区必填阻断及边界 warning 保持明确", async () => {
  const manual = { selectionMode: "MANUAL_IANA", registeredLocationId: null };
  assert.equal((await run({ ...manual, localDate: "2024-03-10", localTime: "02:30", manualIanaTimezone: "America/New_York" })).result.coreResult.blockingCode, "NONEXISTENT_LOCAL_TIME");
  assert.equal((await run({ localDate: "2024-02-04", localTime: "16:26" })).result.coreResult.blockingCode, "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS");
  assert.equal((await run({ ...manual, manualIanaTimezone: null })).result.coreResult.blockingCode, "TIMEZONE_REQUIRED");
  assert.equal((await run({ ...manual, locationName: null, manualIanaTimezone: "America/New_York" })).result.coreResult.blockingCode, "LOCATION_REQUIRED");
  assert.ok((await run({ localDate: "2024-02-04", localTime: "16:27" })).result.coreResult.warnings.includes("BOUNDARY_SENSITIVE"));
});

test("页面消息覆盖指定阻断并提供未知 code 回退", () => {
  for (const code of ["LUNAR_INPUT_NOT_SUPPORTED_V0_1", "INVALID_CIVIL_DATE", "DATE_OUT_OF_SUPPORTED_RANGE", "DATE_OUT_OF_ALGORITHM_RANGE", "FUTURE_BIRTH_DATE_NOT_ALLOWED", "LOCATION_REQUIRED", "TIMEZONE_REQUIRED", "LOCATION_TIMEZONE_MISMATCH", "NONEXISTENT_LOCAL_TIME", "AMBIGUOUS_LOCAL_TIME", "SOLAR_TERM_DATA_UNAVAILABLE", "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS", "SOLAR_TERM_TIME_REQUIRED", "DAY_ALGORITHM_CROSSCHECK_FAILED"]) {
    assert.notEqual(getBaziBlockingMessage(code).title, getBaziBlockingMessage("UNKNOWN_CODE").title, code);
  }
});

test("Bazi 页面链无持久化和算法复制", () => {
  const files = ["src/app/bazi/page.tsx", "src/components/bazi/birth-input-form.tsx", "src/components/bazi/bazi-pillar-result.tsx", "src/components/bazi/bazi-blocked-result.tsx", "src/lib/bazi/bazi-page-contract.ts", "src/lib/bazi/bazi-browser-pipeline.ts"];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  for (const forbidden of [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /五虎遁/, /五鼠遁/, /BZ-C\d+/, /Intl\.DateTimeFormat/]) assert.doesNotMatch(source, forbidden);
});
