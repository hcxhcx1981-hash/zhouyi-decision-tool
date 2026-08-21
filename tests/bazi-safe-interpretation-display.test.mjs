import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { createLatestRequestGate, settleLatestRequest } from "../src/lib/bazi/bazi-page-contract.ts";
import { loadBaziInterpretationBrowserData } from "../src/lib/browser/bazi-interpretation-data.ts";
import { deriveBaziSafeInterpretation } from "../src/components/bazi/bazi-safe-interpretation-presentation.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");

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

function stem(chinese, tenGod, element = "WOOD") {
  return { stemId: `TEST-${chinese}`, chinese, yinYang: "YIN", element, tenGod };
}

function pillar(pillarKind, stemValue, tenGod, branchChinese, hiddenStems, element = "WOOD") {
  return {
    pillar: pillarKind,
    stem: stem(stemValue, tenGod, element),
    branch: {
      branchId: `TEST-${branchChinese}`,
      chinese: branchChinese,
      yinYang: "YIN",
      element,
      hiddenStems,
      hiddenStemOrderSemantics: "NONE",
    },
  };
}

const knownFoundation = {
  year: pillar("YEAR", "辛", "七杀", "酉", [stem("辛", "七杀", "METAL")], "METAL"),
  month: pillar("MONTH", "戊", "正财", "辰", [
    stem("戊", "正财", "EARTH"),
    stem("乙", "比肩"),
    stem("癸", "偏印", "WATER"),
  ], "EARTH"),
  day: pillar("DAY", "乙", "比肩", "卯", [stem("乙", "比肩")]),
  hour: pillar("HOUR", "丁", "食神", "午", [
    stem("丁", "食神", "FIRE"),
    stem("己", "偏财", "EARTH"),
  ], "FIRE"),
};

async function protocol() {
  return (await loadBaziInterpretationBrowserData(fakeFetch)).data;
}

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolveValue) => { resolvePromise = resolveValue; });
  return { promise, resolve: resolvePromise };
}

test("七杀存在时只显示Runtime正式SAFE解释", async () => {
  const runtime = await protocol();
  const view = deriveBaziSafeInterpretation(runtime, knownFoundation);
  const relation = view.pillarRelations[0];
  assert.equal(relation.tenGod, "七杀");
  assert.equal(relation.protocolEntry.gate, "SAFE_SEMANTIC_GLOSS");
  assert.equal(
    relation.protocolEntry.safeGloss.plainLanguage,
    "传统子平会从对日主形成克制、以及是否得到适当制化的角度观察七杀。",
  );
});

test("正财存在时显示Runtime正式SAFE解释", async () => {
  const runtime = await protocol();
  const view = deriveBaziSafeInterpretation(runtime, knownFoundation);
  const relation = view.pillarRelations[1];
  assert.equal(relation.tenGod, "正财");
  assert.equal(relation.protocolEntry.gate, "SAFE_SEMANTIC_GLOSS");
  assert.equal(relation.protocolEntry.safeGloss.plainLanguage, "传统子平把正财归入财帛关系进行观察。");
});

test("FACT_ONLY四项没有SAFE文案且只保留结构许可", async () => {
  const runtime = await protocol();
  const view = deriveBaziSafeInterpretation(runtime, knownFoundation);
  assert.equal(view.safeGlosses.length, 7);
  assert.equal(view.factOnlyTerms.length, 4);
  assert.deepEqual(view.factOnlyTerms.map((entry) => entry.canonicalTerm), ["比肩", "劫财", "偏财", "偏印"]);
  assert.ok(view.factOnlyTerms.every((entry) => entry.gate === "FACT_ONLY" && !entry.safeGlossAvailable));
  assert.ok(view.factOnlyTerms.every((entry) => !view.safeGlosses.some((safe) => safe.canonicalTerm === entry.canonicalTerm)));
  assert.equal(view.pillarRelations[2].protocolEntry.gate, "FACT_ONLY");
});

test("数量统计按关系计数并暴露Frozen数量政策", async () => {
  const view = deriveBaziSafeInterpretation(await protocol(), knownFoundation);
  const counts = Object.fromEntries(view.tenGodCounts.map((entry) => [entry.tenGod, entry.count]));
  assert.equal(counts.七杀, 2);
  assert.equal(counts.正财, 2);
  assert.equal(counts.比肩, 3);
  assert.equal(view.countPolicy.policyId, "COUNT_ONLY_IS_NOT_INTERPRETATION");
  const source = readFileSync(join(root, "src", "components", "bazi", "bazi-explanation-report.tsx"), "utf8");
  assert.match(source, /数量统计不等同于命理判断。/);
});

test("藏干只保留成员事实且不排序、不分主次", async () => {
  const view = deriveBaziSafeInterpretation(await protocol(), knownFoundation);
  assert.deepEqual(view.hiddenStemFacts[1].stemChinese, ["戊", "乙", "癸"]);
  assert.equal(view.visibleHiddenPolicy.gate, "FACT_ONLY");
  assert.equal(view.visibleHiddenPolicy.allowedStatements.length, 3);
});

test("未知时辰不生成时柱关系或藏干解释", async () => {
  const view = deriveBaziSafeInterpretation(await protocol(), { ...knownFoundation, hour: null });
  assert.equal(view.pillarRelations[3], null);
  assert.equal(view.hiddenStemFacts[3], null);
  assert.equal(view.tenGodCounts.some((entry) => entry.tenGod === "偏财"), false);
});

test("BLOCKED输入不生成解释ViewModel", async () => {
  assert.equal(deriveBaziSafeInterpretation(await protocol(), null), null);
  const pillarSource = readFileSync(join(root, "src", "components", "bazi", "bazi-pillar-result.tsx"), "utf8");
  assert.match(pillarSource, /coreResult\.status !== "READY"/);
});

test("Runtime失败被拒绝且页面保留Foundation并友好降级", async () => {
  await assert.rejects(
    loadBaziInterpretationBrowserData(() => responseFromBytes(Buffer.alloc(0), 503)),
    /INTERPRETATION_BROWSER_ASSET_HTTP_503/,
  );
  const parentSource = readFileSync(join(root, "src", "components", "bazi", "bazi-foundation-result.tsx"), "utf8");
  const interpretationSource = readFileSync(join(root, "src", "components", "bazi", "bazi-explanation-report.tsx"), "utf8");
  assert.ok(parentSource.indexOf("<BaziExplanationReport") < parentSource.indexOf("<FoundationExplanation"));
  assert.match(interpretationSource, /正式 SAFE 说明暂时不可用/);
  assert.match(interpretationSource, /事实章节仍可查看/);
  assert.doesNotMatch(interpretationSource, /getTenGodDisplayCopy|TEN_GOD_DISPLAY_COPY/);
});

test("Interpretation stale request沿用latest-only gate", async () => {
  const gate = createLatestRequestGate();
  const old = deferred();
  const state = { identity: "B", value: null };
  const oldId = gate.begin();
  const settlement = settleLatestRequest(gate, oldId, old.promise, {
    onSuccess: (value) => { state.identity = "A"; state.value = value; },
    onError: () => {},
    onFinally: () => {},
  });
  gate.invalidate();
  old.resolve("stale");
  assert.equal(await settlement, false);
  assert.deepEqual(state, { identity: "B", value: null });
  const source = readFileSync(join(root, "src", "components", "bazi", "bazi-explanation-report.tsx"), "utf8");
  assert.match(source, /createLatestRequestGate/);
  assert.match(source, /settleLatestRequest/);
  assert.match(source, /data-explanation-identity/);
});

test("SAFE传统主题正文未硬编码进页面组件", async () => {
  const runtime = await protocol();
  const source = [
    "src/components/bazi/bazi-safe-interpretation.tsx",
    "src/components/bazi/bazi-safe-interpretation-presentation.ts",
    "src/components/bazi/bazi-explanation-runtime-adapter.ts",
    "src/components/bazi/bazi-explanation-report.tsx",
    "src/components/bazi/bazi-foundation-result.tsx",
  ].map((path) => readFileSync(join(root, path), "utf8")).join("\n");
  for (const gloss of runtime.safeGlosses) assert.equal(source.includes(gloss.plainLanguage), false, gloss.canonicalTerm);
  assert.match(source, /loadBaziInterpretationBrowserData/);
  assert.match(source, /deriveBaziSafeInterpretation/);
});
