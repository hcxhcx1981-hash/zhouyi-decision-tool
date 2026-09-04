import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateDivination, parseRuntimeDivinationRules } from "../src/lib/divination.ts";
import {
  createBlockedAdvancedReading,
  createEmptyYaoValues,
  getEvidenceAvailability,
  nextYaoIndexAfterSelection,
  toLiuyaoCastInput,
  validateLiuyaoCastDraft,
  YAO_POSITION_LABELS,
} from "../src/lib/liuyao/input.ts";
import {
  areSixClash,
  areSixHarmony,
  buildLiuyaoChart,
  getBranchElement,
  getChangeTags,
  getElementRelation,
  getSexagenaryDayIndex,
  getXunKong,
} from "../src/lib/liuyao/rules.ts";

const runtimeRules = parseRuntimeDivinationRules(
  JSON.parse(fs.readFileSync("data/frozen/zhouyi_divination_rules_v0.1.json", "utf8")),
);
const validQuestion = { title: "fixture-question", detail: "", timeRange: "fixture-range" };

test("问题标题为空不可开始", () => {
  const errors = validateLiuyaoCastDraft(
    { ...validQuestion, title: "" },
    [7, 7, 7, 7, 7, 7],
  );
  assert.equal(errors.includes("QUESTION_TITLE_REQUIRED"), true);
});

test("时间范围为空不可开始", () => {
  const errors = validateLiuyaoCastDraft(
    { ...validQuestion, timeRange: "" },
    [7, 7, 7, 7, 7, 7],
  );
  assert.equal(errors.includes("TIME_RANGE_REQUIRED"), true);
});

test("六神所需日干缺失不可开始", () => {
  assert.equal(
    validateLiuyaoCastDraft(validQuestion, [7, 7, 7, 7, 7, 7], "").includes("DAY_STEM_REQUIRED"),
    true,
  );
});

test("日月旺衰证据所需月建和日辰缺失不可开始", () => {
  assert.equal(
    validateLiuyaoCastDraft(validQuestion, [7, 7, 7, 7, 7, 7], "甲", "", "子").includes("MONTH_BRANCH_REQUIRED"),
    true,
  );
  assert.equal(
    validateLiuyaoCastDraft(validQuestion, [7, 7, 7, 7, 7, 7], "甲", "子", "").includes("DAY_BRANCH_REQUIRED"),
    true,
  );
});

test("无效日干日辰组合阻断旬空计算", () => {
  assert.equal(
    validateLiuyaoCastDraft(validQuestion, [7, 7, 7, 7, 7, 7], "甲", "子", "丑").includes("INVALID_DAY_PILLAR"),
    true,
  );
  assert.equal(toLiuyaoCastInput(validQuestion, [7, 7, 7, 7, 7, 7], "甲", "子", "丑"), null);
});

test("六爻不足不可核准", () => {
  assert.equal(
    validateLiuyaoCastDraft(validQuestion, createEmptyYaoValues()).includes(
      "YAO_VALUES_INCOMPLETE",
    ),
    true,
  );
});

test("逐爻顺序固定为初爻至上爻", () => {
  assert.deepEqual(YAO_POSITION_LABELS, ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"]);
});

test("选择当前爻后自动进入下一爻且不上溢", () => {
  assert.equal(nextYaoIndexAfterSelection(2), 3);
  assert.equal(nextYaoIndexAfterSelection(5), 5);
});

test("六爻完成后生成合法核准输入", () => {
  const cast = toLiuyaoCastInput(validQuestion, [7, 7, 7, 7, 7, 7], "丙", "寅", "午");
  assert.deepEqual(cast?.yaoValues, [7, 7, 7, 7, 7, 7]);
  assert.equal(cast?.dayStem, "丙");
  assert.equal(cast?.monthBranch, "寅");
  assert.equal(cast?.dayBranch, "午");
});

test("固定乾卦例生成完整基础卦盘", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [7, 7, 7, 7, 7, 7], dayStem: "甲", monthBranch: "子", dayBranch: "午" });
  assert.equal(chart.originalHexagram.key, "111111");
  assert.equal(chart.changedHexagram.key, "111111");
  assert.deepEqual(chart.movingPositions, []);
  assert.equal(chart.shiPosition, 6);
  assert.equal(chart.yingPosition, 3);
  assert.deepEqual(chart.lines.map((line) => line.naJia), ["甲子", "甲寅", "甲辰", "壬午", "壬申", "壬戌"]);
  assert.deepEqual(chart.lines.map((line) => line.sixSpirit), ["青龙", "朱雀", "勾陈", "腾蛇", "白虎", "玄武"]);
  assert.deepEqual(chart.lines.map((line) => line.sixRelative), ["子孙", "妻财", "父母", "官鬼", "兄弟", "父母"]);
});

test("动爻、阴阳与变卦在固定卦例中保持一致", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [6, 7, 8, 9, 7, 8], dayStem: "己", monthBranch: "卯", dayBranch: "酉" });
  assert.equal(chart.originalHexagram.key, "010110");
  assert.equal(chart.changedHexagram.key, "110010");
  assert.deepEqual(chart.movingPositions, [1, 4]);
  assert.deepEqual(chart.lines.map((line) => [line.polarity, line.moving]), [["阴", true], ["阳", false], ["阴", false], ["阳", true], ["阳", false], ["阴", false]]);
  assert.equal(chart.lines[0].sixSpirit, "腾蛇");
});

test("基础排盘对相同输入恒定，且输出结构完整", () => {
  const cast = { question: validQuestion, yaoValues: [9, 8, 7, 6, 7, 8], dayStem: "壬", monthBranch: "申", dayBranch: "辰" };
  const first = buildLiuyaoChart(cast);
  const second = buildLiuyaoChart(cast);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["changedHexagram", "input", "lines", "movingPositions", "originalHexagram", "ruleLayer", "shiPosition", "xunKong", "yingPosition"].sort());
  assert.equal(first.lines.length, 6);
  assert.equal(first.lines.every((line) => typeof line.naJia === "string" && typeof line.sixRelative === "string" && typeof line.sixSpirit === "string" && line.evidence !== undefined), true);
});

test("十二地支映射与五行生克关系固定", () => {
  assert.equal(getBranchElement("子"), "水");
  assert.equal(getBranchElement("未"), "土");
  assert.equal(getElementRelation("水", "金"), "生我");
  assert.equal(getElementRelation("水", "木"), "我生");
  assert.equal(getElementRelation("水", "土"), "克我");
  assert.equal(getElementRelation("水", "火"), "我克");
  assert.equal(getElementRelation("水", "水"), "同类");
});

test("六合与六冲关系固定且不互相混淆", () => {
  assert.equal(areSixHarmony("子", "丑"), true);
  assert.equal(areSixHarmony("子", "午"), false);
  assert.equal(areSixClash("子", "午"), true);
  assert.equal(areSixClash("子", "丑"), false);
});

test("每爻日月关系、证据标签和完整三合均可验证", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [7, 7, 7, 7, 7, 7], dayStem: "甲", monthBranch: "申", dayBranch: "辰" });
  const first = chart.lines[0].evidence;
  assert.equal(first.branch, "子");
  assert.equal(first.branchElement, "水");
  assert.deepEqual(first.month, { branch: "申", element: "金", relation: "生我", sameBranch: false, clash: false, harmony: false });
  assert.deepEqual(first.day, { branch: "辰", element: "土", relation: "克我", sameBranch: false, clash: false, harmony: false });
  assert.deepEqual(first.tags, ["月扶", "日克"]);
  assert.deepEqual(first.threeHarmony, { branches: ["申", "子", "辰"], element: "水" });
});

test("同支、冲与不完整三合只生成对应结构标签", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [7, 7, 7, 7, 7, 7], dayStem: "甲", monthBranch: "子", dayBranch: "午" });
  const first = chart.lines[0].evidence;
  assert.equal(first.month.sameBranch, true);
  assert.equal(first.day.clash, true);
  assert.deepEqual(first.tags, ["得月", "月扶", "失日"]);
  assert.equal(first.threeHarmony, null);
});

test("显式日柱按六十甲子推导旬与旬空", () => {
  assert.equal(getSexagenaryDayIndex("甲", "子"), 0);
  assert.equal(getSexagenaryDayIndex("甲", "戌"), 10);
  assert.equal(getSexagenaryDayIndex("甲", "丑"), null);
  assert.deepEqual(getXunKong("甲", "子"), { dayPillar: "甲子", xun: "甲子旬", emptyBranches: ["戌", "亥"] });
  assert.deepEqual(getXunKong("甲", "戌"), { dayPillar: "甲戌", xun: "甲戌旬", emptyBranches: ["申", "酉"] });
  assert.equal(getXunKong("甲", "丑"), null);
});

test("每爻旬空 evidence 标记本旬空支而不猜测", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [7, 7, 7, 7, 7, 7], dayStem: "甲", monthBranch: "申", dayBranch: "子" });
  assert.deepEqual(chart.xunKong, { dayPillar: "甲子", xun: "甲子旬", emptyBranches: ["戌", "亥"] });
  assert.equal(chart.lines[0].evidence.xunKong.isEmpty, false);
  assert.equal(chart.lines[5].evidence.xunKong.isEmpty, true);
});

test("动爻输出本变纳甲、变后生克与回头标签，静爻不输出变化", () => {
  const chart = buildLiuyaoChart({ question: validQuestion, yaoValues: [9, 7, 7, 7, 7, 7], dayStem: "甲", monthBranch: "申", dayBranch: "子" });
  assert.deepEqual(chart.lines[0].changeEvidence, {
    originalBranch: "子",
    changedBranch: "丑",
    originalElement: "水",
    changedElement: "土",
    relationAfterChange: "克我",
    tags: ["回头克"],
  });
  assert.equal(chart.lines[1].changeEvidence, null);
});

test("进退神及回头生克只作为结构标签输出", () => {
  assert.deepEqual(getChangeTags("亥", "子", "水", "水"), ["进神"]);
  assert.deepEqual(getChangeTags("子", "亥", "水", "水"), ["退神"]);
  assert.deepEqual(getChangeTags("申", "丑", "金", "土"), ["回头生"]);
  assert.deepEqual(getChangeTags("子", "丑", "水", "土"), ["回头克"]);
});

test("六爻模块乾卦结果保持", () => {
  const result = calculateDivination([7, 7, 7, 7, 7, 7], runtimeRules);
  assert.equal(result.originalKey, "111111");
  assert.equal(result.ruleId, "M0_ORIGINAL_TUANCI");
});

test("六爻模块三爻动阻断保持", () => {
  const result = calculateDivination([9, 6, 7, 7, 9, 7], runtimeRules);
  assert.equal(result.movingCount, 3);
  assert.equal(result.blocked, true);
  assert.equal(result.automaticDecision, false);
});

test("未收录卦证据状态保持 NOT_INCLUDED", () => {
  assert.equal(getEvidenceAvailability("101111", ["111111", "000000", "100010"]), "NOT_INCLUDED");
});

test("六爻进阶判断保持来源规则阻断", () => {
  const reading = createBlockedAdvancedReading();
  assert.equal(reading.status, "BLOCKED_SOURCE_RULES_REQUIRED");
  assert.match(reading.blockingReason, /规则尚未接入/);
});

test("未实现的进阶用神和结局字段保持为 null", () => {
  const reading = createBlockedAdvancedReading();
  assert.deepEqual(
    [
      reading.naJia,
      reading.shiYing,
      reading.sixRelatives,
      reading.sixSpirits,
      reading.usefulGod,
      reading.progressJudgment,
      reading.obstacleJudgment,
      reading.outcomeJudgment,
    ],
    [null, null, null, null, null, null, null, null],
  );
});
