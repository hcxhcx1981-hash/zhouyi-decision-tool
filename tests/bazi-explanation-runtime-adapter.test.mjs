import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import { loadBaziInterpretationBrowserData } from "../src/lib/browser/bazi-interpretation-data.ts";
import { deriveReadyCoreFoundation } from "../src/components/bazi/bazi-foundation-presentation.ts";
import {
  BAZI_EXPLANATION_PROTOCOL_ID,
  BAZI_EXPLANATION_SECTION_IDS,
  deriveBaziExplanationReport,
} from "../src/components/bazi/bazi-explanation-runtime-adapter.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const foundationData = loadFrozenBaziFoundationData(root);

function responseFromBytes(bytes, status = 200) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return Promise.resolve({ ok: status === 200, status, arrayBuffer: async () => buffer });
}

function fakeFetch(path) {
  try {
    return responseFromBytes(readFileSync(join(publicRoot, ...path.slice(1).split("/"))));
  } catch {
    return responseFromBytes(Buffer.alloc(0), 404);
  }
}

function pillar(stem, branch) {
  return { stem, branch, text: `${stem}${branch}`, cycleIndex: 0 };
}

function coreResult({ hourKnown = true, status = "READY" } = {}) {
  return {
    status,
    completeness: status === "BLOCKED" ? "NONE" : hourKnown ? "FOUR_PILLARS" : "THREE_PILLARS_ONLY",
    yearPillar: status === "BLOCKED" ? null : pillar("乙", "酉"),
    monthPillar: status === "BLOCKED" ? null : pillar("辛", "卯"),
    dayPillar: status === "BLOCKED" ? null : pillar("乙", "未"),
    hourPillar: status === "BLOCKED" || !hourKnown ? null : pillar("丁", "辰"),
    blockingCode: status === "BLOCKED" ? "TEST_BLOCKED" : null,
    warnings: [],
    audit: {
      rulesProtocolId: "BAZI_CALENDAR_RULES_V0_1_1",
      rulesVersion: "0.1.1",
      datasetId: "SOLAR_TERMS_1969_2101_V0_1_0",
      datasetVersion: "0.1.0",
      datasetSha256: "test-fixture",
      appliedRuleIds: ["MONTH-JIE-001"],
      matchedLichun: "2024-02-04T08:26:53Z",
      matchedMonthBoundary: "2024-03-05T02:22:31Z",
      dayAlgorithmAIndex: 0,
      dayAlgorithmBIndex: 0,
      timezoneResolverId: "IANA_TZDB_TRANSITION_TABLE_V0_1_0",
      timezoneDataVersion: "2026c",
    },
  };
}

function foundation(core) {
  const result = deriveReadyCoreFoundation(foundationData, core);
  assert.equal(result?.ok, true, result?.ok ? "" : result?.error.code);
  return result.value;
}

async function interpretation() {
  return (await loadBaziInterpretationBrowserData(fakeFetch)).data;
}

async function readyView({ hourKnown = true, protocol = undefined } = {}) {
  const core = coreResult({ hourKnown });
  const runtime = protocol === undefined ? await interpretation() : protocol;
  const view = deriveBaziExplanationReport({
    coreResult: core,
    foundationData,
    foundation: foundation(core),
    interpretation: runtime,
    interpretationAvailability: runtime ? "READY" : "ERROR",
  });
  assert.ok(view);
  return view;
}

test("adapter implements the V0.1 protocol and exact six-section order", async () => {
  const view = await readyView();
  assert.equal(view.protocolId, BAZI_EXPLANATION_PROTOCOL_ID);
  assert.deepEqual(view.sectionOrder, BAZI_EXPLANATION_SECTION_IDS);
  assert.equal(Object.keys(view.sectionStatus).length, 6);
  assert.equal(view.reportStatus, "READY");
});

test("命盘摘要只投影正式 chart runtime 四柱", async () => {
  const view = await readyView();
  assert.deepEqual(view.summary.pillars.map((entry) => entry.text), ["乙酉", "辛卯", "乙未", "丁辰"]);
  assert.equal(view.summary.completeness, "FOUR_PILLARS");
});

test("日主说明来自 Foundation 事实与 Interpretation Runtime SAFE gloss", async () => {
  const runtime = await interpretation();
  const view = await readyView({ protocol: runtime });
  assert.equal(view.dayMaster.chinese, "乙");
  assert.equal(view.dayMaster.element, "WOOD");
  assert.equal(view.dayMaster.gloss, runtime.safeGlosses.find((entry) => entry.canonicalTerm === "日主"));
});

test("十神关系说明保留正式关系与数量边界", async () => {
  const view = await readyView();
  assert.deepEqual(view.tenGodStructure.relations.map((entry) => entry?.tenGod ?? null), ["比肩", "七杀", "比肩", "食神"]);
  assert.equal(view.tenGodStructure.countPolicyId, "COUNT_ONLY_IS_NOT_INTERPRETATION");
  assert.ok(view.tenGodStructure.counts.length > 0);
  assert.ok(view.tenGodStructure.hiddenRelations.every((entry) => entry?.members.length));
});

test("传统观察入口只选择命盘实际出现的正式条目", async () => {
  const view = await readyView();
  const safeTerms = view.traditionalObservation.safeGlosses.map((entry) => entry.canonicalTerm);
  const factTerms = view.traditionalObservation.factOnlyTerms.map((entry) => entry.canonicalTerm);
  assert.ok(safeTerms.includes("七杀"));
  assert.ok(safeTerms.includes("食神"));
  assert.equal(safeTerms.includes("日主"), false);
  assert.ok(factTerms.includes("比肩"));
  assert.ok(factTerms.includes("偏印"));
});

test("旺衰事实入口只消费 Strength Fact Runtime 五项事实", async () => {
  const view = await readyView();
  assert.equal(view.strengthFact.status, "READY");
  assert.deepEqual(Object.keys(view.strengthFact.facts), [
    "month_order_fact",
    "stem_root_presence",
    "visible_stem_fact",
    "hidden_stem_presence_fact",
    "dependency_audit",
  ]);
  assert.equal(view.strengthFact.facts.month_order_fact.monthBranch, "卯");
  assert.equal(view.strengthFact.facts.dependency_audit.researchRuntimeRead, false);
});

test("unknown hour 保留三柱并省略所有时柱事实", async () => {
  const view = await readyView({ hourKnown: false });
  assert.equal(view.summary.completeness, "THREE_PILLARS_ONLY");
  assert.equal(view.summary.pillars[3].text, null);
  assert.equal(view.tenGodStructure.relations[3], null);
  assert.equal(view.tenGodStructure.hiddenRelations[3], null);
  assert.equal(view.strengthFact.facts.dependency_audit.knownPillars, 3);
  assert.equal(
    view.strengthFact.facts.visible_stem_fact.some((entry) => entry.positions.includes("HOUR")),
    false,
  );
});

test("Interpretation Runtime 失败时保留事实章节并关闭传统入口", async () => {
  const view = await readyView({ protocol: null });
  assert.equal(view.reportStatus, "PARTIAL");
  assert.equal(view.sectionStatus.A_BASIC_CHART_SUMMARY, "READY");
  assert.equal(view.sectionStatus.B_DAY_MASTER_GLOSS, "PARTIAL");
  assert.equal(view.sectionStatus.C_TEN_GOD_STRUCTURE_FACTS, "PARTIAL");
  assert.equal(view.sectionStatus.D_TRADITIONAL_OBSERVATION_ENTRY, "UNAVAILABLE");
  assert.equal(view.sectionStatus.E_STRENGTH_FACT_ENTRY, "READY");
  assert.equal(view.traditionalObservation.safeGlosses.length, 0);
});

test("BLOCKED chart 不生成 Explanation ViewModel", async () => {
  const blocked = coreResult({ status: "BLOCKED" });
  assert.equal(
    deriveBaziExplanationReport({
      coreResult: blocked,
      foundationData,
      foundation: {},
      interpretation: await interpretation(),
      interpretationAvailability: "READY",
    }),
    null,
  );
});

test("编排结果不包含禁止的个人判断措辞", async () => {
  const serialized = JSON.stringify(await readyView());
  for (const prohibited of ["身强", "身弱", "喜用神", "格局", "性格", "财富", "婚姻", "事业", "运势"]) {
    assert.equal(serialized.includes(prohibited), false, prohibited);
  }
});

test("Adapter 与组件不读取 research，且只调用正式 Runtime", async () => {
  const source = [
    "src/components/bazi/bazi-explanation-runtime-adapter.ts",
    "src/components/bazi/bazi-explanation-report.tsx",
    "src/components/bazi/bazi-foundation-result.tsx",
  ].map((path) => readFileSync(join(root, path), "utf8")).join("\n");
  assert.doesNotMatch(source, /research[\\/]/i);
  assert.match(source, /loadBaziFoundationBrowserData/);
  assert.match(source, /loadBaziInterpretationBrowserData/);
  assert.match(source, /deriveBaziStrengthFacts/);
  assert.match(source, /BAZI_EXPLANATION_ORCHESTRATION_PROTOCOL_V0_1_0/);
});

test("SAFE传统主题正文未硬编码进新 Adapter 或页面组件", async () => {
  const runtime = await interpretation();
  const source = [
    "src/components/bazi/bazi-explanation-runtime-adapter.ts",
    "src/components/bazi/bazi-explanation-report.tsx",
  ].map((path) => readFileSync(join(root, path), "utf8")).join("\n");
  for (const gloss of runtime.safeGlosses) {
    assert.equal(source.includes(gloss.plainLanguage), false, gloss.canonicalTerm);
  }
});
