import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import { derivePillarsFoundation } from "../src/lib/bazi/foundation-engine.ts";
import {
  BAZI_STRENGTH_FACT_PROTOCOL,
  deriveBaziStrengthFacts,
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
    blockingCode: options.status === "BLOCKED" ? "VALIDATOR_BLOCKED" : null,
    warnings: [],
    audit: {
      rulesProtocolId: "BAZI_CALENDAR_RULES_V0_1_1",
      rulesVersion: "0.1.1",
      datasetId: "SOLAR_TERMS_1969_2101_V0_1_0",
      datasetVersion: "0.1.0",
      datasetSha256: "validator-fixture",
      appliedRuleIds: ["MONTH-JIE-001"],
      matchedLichun: "2024-02-04T08:26:53Z",
      matchedMonthBoundary: options.boundary ?? "2024-03-05T02:22:31Z",
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
const result = deriveBaziStrengthFacts({
  foundationData,
  foundation: foundation(ids),
  coreResult: core(chinese),
});
assert.equal(result.status, "READY");
assert.equal(BAZI_STRENGTH_FACT_PROTOCOL.gate, "FACT_ONLY");
assert.deepEqual(Object.keys(result.facts), BAZI_STRENGTH_FACT_PROTOCOL.allowedOutputs);
assert.equal(result.facts.month_order_fact.monthBranch, "卯");
assert.equal(result.facts.month_order_fact.monthOrderName, "卯月");
assert.equal(result.facts.month_order_fact.jieqiBoundaryUsed, "2024-03-05T02:22:31Z");
const yiRoot = result.facts.stem_root_presence.find((entry) => entry.stemId === "YI");
assert.equal(yiRoot.rootPresent, true);
assert.deepEqual(yiRoot.matchedBranches, ["卯", "未", "辰"]);
const xinRoot = result.facts.stem_root_presence.find((entry) => entry.stemId === "XIN");
assert.equal(xinRoot.rootPresent, true);
assert.deepEqual(xinRoot.matchedBranches, ["酉"]);
assert.equal(result.facts.dependency_audit.researchRuntimeRead, false);
assert.equal(result.facts.dependency_audit.safeInterpretationRead, false);

const unknownIds = { ...ids, hour: null };
const unknownChinese = { ...chinese, hour: null };
const unknown = deriveBaziStrengthFacts({
  foundationData,
  foundation: foundation(unknownIds),
  coreResult: core(unknownChinese),
});
assert.equal(unknown.status, "READY");
assert.equal(unknown.facts.dependency_audit.knownPillars, 3);
assert.equal(
  unknown.facts.visible_stem_fact.some((entry) => entry.positions.includes("HOUR")),
  false,
);

const blocked = deriveBaziStrengthFacts({
  foundationData,
  foundation: foundation(unknownIds),
  coreResult: core(unknownChinese, { status: "BLOCKED" }),
});
assert.deepEqual(Object.keys(blocked).sort(), ["blockingCode", "protocol", "status"]);

const serialized = JSON.stringify(result);
for (const prohibited of ["身强", "身弱", "旺", "衰", "喜用神", "格局", "吉凶"]) {
  assert.equal(serialized.includes(prohibited), false, prohibited);
}
const runtimeSource = readFileSync(
  resolve(root, "src", "lib", "bazi", "strength-fact-runtime.ts"),
  "utf8",
);
assert.doesNotMatch(runtimeSource, /research[\\/]/i);
assert.doesNotMatch(runtimeSource, /interpretation-runtime|bazi-interpretation/i);

console.log(`PROTOCOL=${BAZI_STRENGTH_FACT_PROTOCOL.protocolId}`);
console.log(`OUTPUTS=${BAZI_STRENGTH_FACT_PROTOCOL.allowedOutputs.length}/5`);
console.log(`GATE=${BAZI_STRENGTH_FACT_PROTOCOL.gate}`);
console.log(`ROOT_MATCHES_YI=${yiRoot.matchedBranches.join(",")}`);
console.log("UNKNOWN_HOUR=PASS");
console.log("BLOCKED_HAS_NO_FACTS=PASS");
console.log("RESEARCH_RUNTIME_READ=0");
console.log("SAFE_INTERPRETATION_READ=0");
console.log("PROHIBITED_CONCLUSIONS=0");
console.log("BAZI_STRENGTH_FACT_RUNTIME: ALL PASS");
