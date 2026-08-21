import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildBaziClipboardText,
  copyBaziChartText,
} from "../src/components/bazi/bazi-chart-presentation.ts";
import { loadBaziInterpretationBrowserData } from "../src/lib/browser/bazi-interpretation-data.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const reportPath = join(root, "src", "components", "bazi", "bazi-explanation-report.tsx");
const parentPath = join(root, "src", "components", "bazi", "bazi-foundation-result.tsx");

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

const input = {
  localDate: "2024-03-18",
  localTime: "08:30",
  timeKnown: true,
  gender: "MALE",
  locationName: "北京",
  locationMode: "REGISTERED_LOCATION",
  ianaTimezone: "Asia/Shanghai",
};

const summary = {
  dayMaster: { chinese: "乙", elementLabel: "木" },
  relationships: [
    { pillarLabel: "年柱", tenGod: "七杀", isDayMaster: false },
    { pillarLabel: "月柱", tenGod: "正财", isDayMaster: false },
    { pillarLabel: "日柱", tenGod: "比肩", isDayMaster: true },
    { pillarLabel: "时柱", tenGod: "食神", isDayMaster: false },
  ],
  traditionalObservations: [
    { canonicalTerm: "七杀", plainLanguage: "来自测试 Runtime 的七杀 SAFE 说明" },
    { canonicalTerm: "正财", plainLanguage: "来自测试 Runtime 的正财 SAFE 说明" },
  ],
};

test("正常四柱后优先显示我的命盘结构，技术结构保持折叠", () => {
  const parent = readFileSync(parentPath, "utf8");
  const report = readFileSync(reportPath, "utf8");
  assert.ok(parent.indexOf("{children}") < parent.indexOf("<BaziExplanationReport"));
  assert.ok(parent.indexOf("<BaziExplanationReport") < parent.indexOf("<FoundationExplanation"));
  assert.match(report, /我的命盘结构/);
  assert.match(parent, /<details className="bazi-foundation-details">/);
});

test("命盘关系使用年柱出现关系与日主自身的普通用户表达", () => {
  const report = readFileSync(reportPath, "utf8");
  assert.match(report, /relation\.pillarKind === "DAY" \? "日主自身"/);
  assert.match(report, /出现 \{relation\.tenGod\}关系/);
  assert.doesNotMatch(report, /\{relation\.stemChinese\} → \{relation\.tenGod\}/);
});

test("SAFE副标题和说明只读取 Runtime allowedTopics 与 plainLanguage", async () => {
  const runtime = (await loadBaziInterpretationBrowserData(fakeFetch)).data;
  const report = readFileSync(reportPath, "utf8");
  assert.match(report, /safeGloss\.allowedTopics\.join/);
  assert.match(report, /safeGloss\.plainLanguage/);
  assert.match(report, /gloss\.allowedTopics\.join/);
  assert.match(report, /gloss\.plainLanguage/);
  for (const gloss of runtime.safeGlosses) {
    assert.equal(report.includes(gloss.plainLanguage), false, gloss.canonicalTerm);
  }
});

test("复制档案来自当前四柱、日主、关系和 SAFE 观察方向", () => {
  const text = buildBaziClipboardText(["乙酉", "辛卯", "乙未", "丁辰"], input, summary);
  assert.match(text, /^八字基础档案/);
  assert.match(text, /四柱：\n乙酉　辛卯　乙未　丁辰/);
  assert.match(text, /日主：\n乙木/);
  assert.match(text, /年柱：出现七杀关系/);
  assert.match(text, /日柱：日主自身/);
  assert.match(text, /七杀：来自测试 Runtime 的七杀 SAFE 说明/);
});

test("未知时辰不生成时柱关系或虚构四柱", () => {
  const text = buildBaziClipboardText(
    ["乙酉", "辛卯", "乙未", null],
    { ...input, localTime: null, timeKnown: false },
    { ...summary, relationships: [...summary.relationships.slice(0, 3), null] },
  );
  assert.match(text, /乙酉　辛卯　乙未　--/);
  assert.match(text, /时柱：时辰未知，不生成关系/);
});

test("用户语言层不包含个人预测句式且不持久化资料", () => {
  const source = [reportPath, parentPath].map((path) => readFileSync(path, "utf8")).join("\n");
  for (const prohibited of ["你事业压力大", "你适合某行业", "你未来会", "你性格", "命中注定"]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

test("复制成功与失败均提供可判定结果", async () => {
  assert.equal(await copyBaziChartText("档案", { writeText: async () => {} }), true);
  assert.equal(await copyBaziChartText("档案", { writeText: async () => { throw new Error("denied"); } }), false);
  assert.equal(await copyBaziChartText("档案", null), false);
  const report = readFileSync(reportPath, "utf8");
  assert.match(report, /已复制八字基础档案。/);
  assert.match(report, /复制失败，请手动选择页面内容。/);
});

test("BLOCKED 仍由 READY 门禁阻止解释层输出", () => {
  const pillarSource = readFileSync(join(root, "src", "components", "bazi", "bazi-pillar-result.tsx"), "utf8");
  assert.match(pillarSource, /coreResult\.status !== "READY"/);
});
