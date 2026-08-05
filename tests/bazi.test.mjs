import assert from "node:assert/strict";
import test from "node:test";
import {
  createBlockedBaziResult,
  INITIAL_BAZI_DRAFT,
  toBaziBirthInput,
  validateBaziBirthDraft,
} from "../src/lib/bazi/form.ts";

function validDraft(overrides = {}) {
  return {
    ...INITIAL_BAZI_DRAFT,
    birthDate: "2000-01-02",
    birthHour: "3",
    birthMinute: "4",
    countryOrRegion: "fixture-region",
    city: "fixture-city",
    ...overrides,
  };
}

test("公历出生资料可转换为输入协议", () => {
  const input = toBaziBirthInput(validDraft());
  assert.equal(input?.calendarType, "solar");
  assert.equal(input?.birthTime, "03:04");
});

test("农历模式不可提交并返回规则阻断", () => {
  assert.deepEqual(validateBaziBirthDraft(validDraft({ calendarType: "lunar" })), [
    "LUNAR_NOT_IMPLEMENTED",
  ]);
});

test("未知时辰时输入协议禁用具体时间", () => {
  const input = toBaziBirthInput(validDraft({
    timePrecision: "unknown",
    birthHour: "",
    birthMinute: "",
  }));
  assert.equal(input?.timePrecision, "unknown");
  assert.equal(input?.birthTime, null);
});

test("缺少出生日期不可提交", () => {
  assert.equal(
    validateBaziBirthDraft(validDraft({ birthDate: "" })).includes("BIRTH_DATE_REQUIRED"),
    true,
  );
});

test("已知时辰但缺少时间不可提交", () => {
  assert.equal(
    validateBaziBirthDraft(validDraft({ birthHour: "", birthMinute: "" })).includes(
      "BIRTH_TIME_REQUIRED",
    ),
    true,
  );
});

test("提交后只生成 NOT_IMPLEMENTED 阻断结果", () => {
  const result = createBlockedBaziResult();
  assert.equal(result.status, "NOT_IMPLEMENTED");
  assert.match(result.blockingReason ?? "", /不生成四柱和运势结论/);
});

test("八字阻断结果不包含模拟四柱", () => {
  assert.equal(createBlockedBaziResult().chart, null);
});
