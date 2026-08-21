import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import { derivePillarsFoundation } from "../src/lib/bazi/foundation-engine.ts";
import {
  BAZI_STRENGTH_FACT_PROTOCOL,
  deriveBaziStrengthFacts,
  stemRootPresence,
} from "../src/lib/bazi/strength-fact-runtime.ts";

const root = resolve(import.meta.dirname, "..");
const foundationData = loadFrozenBaziFoundationData(root);

function foundation(pillars) {
  const result = derivePillarsFoundation(foundationData, pillars);
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

function core(pillars, options = {}) {
  const hour = pillars.hour ?? null;
  const toCorePillar = (pillar) =>
    pillar
      ? { stem: pillar.stem, branch: pillar.branch, text: "", cycleIndex: 0 }
      : null;
  return {
    status: options.status ?? "READY",
    completeness: hour ? "FOUR_PILLARS" : "THREE_PILLARS_ONLY",
    yearPillar: toCorePillar(pillars.year),
    monthPillar: toCorePillar(pillars.month),
    dayPillar: toCorePillar(pillars.day),
    hourPillar: toCorePillar(hour),
    blockingCode: options.status === "BLOCKED" ? "TEST_BLOCKED" : null,
    warnings: [],
    audit: {
      rulesProtocolId: "BAZI_CALENDAR_RULES_V0_1_1",
      rulesVersion: "0.1.1",
      datasetId: "SOLAR_TERMS_1969_2101_V0_1_0",
      datasetVersion: "0.1.0",
      datasetSha256: "test-fixture",
      appliedRuleIds: ["MONTH-JIE-001"],
      matchedLichun: "2024-02-04T08:26:53Z",
      matchedMonthBoundary:
        options.boundary === undefined ? "2024-03-05T02:22:31Z" : options.boundary,
      dayAlgorithmAIndex: 0,
      dayAlgorithmBIndex: 0,
      timezoneResolverId: "IANA_TZDB_TRANSITION_TABLE_V0_1_0",
      timezoneDataVersion: "2026c",
    },
  };
}

const ids = {
  year: { stem: "YI", branch: "YOU" },
  month: { stem: "XIN", branch: "MAO" },
  day: { stem: "YI", branch: "WEI" },
  hour: { stem: "DING", branch: "CHEN" },
};
const chinese = {
  year: { stem: "乙", branch: "酉" },
  month: { stem: "辛", branch: "卯" },
  day: { stem: "乙", branch: "未" },
  hour: { stem: "丁", branch: "辰" },
};

function readyResult(customIds = ids, customChinese = chinese, options = {}) {
  const result = deriveBaziStrengthFacts({
    foundationData,
    foundation: foundation(customIds),
    coreResult: core(customChinese, options),
  });
  assert.equal(result.status, "READY");
  return result;
}

test("protocol exposes exactly five FACT_ONLY outputs", () => {
  assert.equal(BAZI_STRENGTH_FACT_PROTOCOL.gate, "FACT_ONLY");
  assert.deepEqual(BAZI_STRENGTH_FACT_PROTOCOL.allowedOutputs, [
    "month_order_fact",
    "stem_root_presence",
    "visible_stem_fact",
    "hidden_stem_presence_fact",
    "dependency_audit",
  ]);
  assert.deepEqual(Object.keys(readyResult().facts), BAZI_STRENGTH_FACT_PROTOCOL.allowedOutputs);
});

test("month_order_fact uses the existing month branch and exact boundary result", () => {
  const fact = readyResult().facts.month_order_fact;
  assert.equal(fact.gate, "FACT_ONLY");
  assert.equal(fact.monthBranch, "卯");
  assert.equal(fact.monthOrderName, "卯月");
  assert.equal(fact.jieqiBoundaryUsed, "2024-03-05T02:22:31Z");
});

test("stem_root_presence detects an exact hidden-stem member", () => {
  const yi = readyResult().facts.stem_root_presence.find((entry) => entry.stemId === "YI");
  assert.equal(yi.rootPresent, true);
  assert.deepEqual(yi.matchedBranches, ["卯", "未", "辰"]);
});

test("stemRootPresence does not treat same-element different stems as an exact match", () => {
  const chart = foundation({
    year: { stem: "YI", branch: "YIN" },
    month: { stem: "GENG", branch: "SHEN" },
    day: { stem: "YI", branch: "YOU" },
    hour: null,
  });
  const fact = stemRootPresence([chart.year, chart.month, chart.day], chart.day.stem);
  assert.equal(fact.rootPresent, false);
  assert.deepEqual(fact.matchedBranches, []);
});

test("stem_root_presence reports multiple matches without ranking", () => {
  const yi = readyResult().facts.stem_root_presence.find((entry) => entry.stemId === "YI");
  assert.equal(yi.matchedBranches.length, 3);
  assert.doesNotMatch(JSON.stringify(yi), /本气|中气|余气|weight|score/i);
});

test("unknown hour omits all hour-dependent facts", () => {
  const result = readyResult({ ...ids, hour: null }, { ...chinese, hour: null });
  assert.equal(result.facts.dependency_audit.knownPillars, 3);
  assert.equal(result.facts.dependency_audit.completeness, "THREE_PILLARS_ONLY");
  assert.equal(
    result.facts.visible_stem_fact.some((entry) => entry.positions.includes("HOUR")),
    false,
  );
  assert.equal(
    result.facts.hidden_stem_presence_fact.some((entry) => entry.matchedBranches.includes("辰")),
    false,
  );
});

test("visible_stem_fact groups only observed stem positions", () => {
  const yi = readyResult().facts.visible_stem_fact.find((entry) => entry.stemId === "YI");
  assert.deepEqual(yi.positions, ["YEAR", "DAY"]);
  assert.equal(yi.occurrenceCount, 2);
});

test("hidden_stem_presence_fact preserves Foundation membership semantics", () => {
  const result = readyResult();
  const xin = result.facts.hidden_stem_presence_fact.find((entry) => entry.stemId === "XIN");
  assert.deepEqual(xin.matchedBranches, ["酉"]);
  assert.equal(result.facts.dependency_audit.foundation.hiddenStemOrderSemantics, "NONE");
});

test("dependency_audit records frozen Foundation, month boundary, and timezone inputs", () => {
  const audit = readyResult().facts.dependency_audit;
  assert.equal(audit.foundation.datasetId, "BAZI_FOUNDATION_RULES_V0_2_0");
  assert.equal(audit.monthBoundary.rulesProtocolId, "BAZI_CALENDAR_RULES_V0_1_1");
  assert.equal(audit.timezone.dataVersion, "2026c");
  assert.equal(audit.researchRuntimeRead, false);
  assert.equal(audit.safeInterpretationRead, false);
});

test("a blocked core result produces no fact payload", () => {
  const result = deriveBaziStrengthFacts({
    foundationData,
    foundation: foundation({ ...ids, hour: null }),
    coreResult: core({ ...chinese, hour: null }, { status: "BLOCKED" }),
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal("facts" in result, false);
  assert.equal(result.blockingCode, "STRENGTH_FACT_CORE_NOT_READY");
});

test("a missing month boundary produces no fact payload", () => {
  const result = deriveBaziStrengthFacts({
    foundationData,
    foundation: foundation(ids),
    coreResult: core(chinese, { boundary: null }),
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal("facts" in result, false);
  assert.equal(result.blockingCode, "STRENGTH_FACT_MONTH_BOUNDARY_MISSING");
});

test("a Foundation/core pillar mismatch is blocked", () => {
  const result = deriveBaziStrengthFacts({
    foundationData,
    foundation: foundation(ids),
    coreResult: core({ ...chinese, month: { stem: "辛", branch: "辰" } }),
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockingCode, "STRENGTH_FACT_DEPENDENCY_MISMATCH");
});

test("runtime output contains no prohibited conclusion or prediction language", () => {
  const serialized = JSON.stringify(readyResult());
  for (const prohibited of [
    "身强",
    "身弱",
    "旺",
    "衰",
    "喜用神",
    "格局",
    "吉凶",
    "事业",
    "财富",
    "婚姻",
  ]) {
    assert.equal(serialized.includes(prohibited), false, prohibited);
  }
});

test("runtime source has no research or SAFE interpretation dependency", () => {
  const source = readFileSync(
    resolve(root, "src", "lib", "bazi", "strength-fact-runtime.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /research[\\/]/i);
  assert.doesNotMatch(source, /interpretation-runtime|bazi-interpretation/i);
});
