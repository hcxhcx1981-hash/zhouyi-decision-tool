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
  const cast = toLiuyaoCastInput(validQuestion, [7, 7, 7, 7, 7, 7]);
  assert.deepEqual(cast?.yaoValues, [7, 7, 7, 7, 7, 7]);
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

test("未实现的纳甲、用神和结局字段全部为 null", () => {
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
