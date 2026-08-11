import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildBaziClipboardText,
  copyBaziChartText,
  formatBaziOverview,
  formatBirthDisplay,
  formatGenderDisplay,
  formatLocationDisplay,
  getConfirmedCapabilities,
  UNSUPPORTED_BAZI_CAPABILITIES,
} from "../src/components/bazi/bazi-chart-presentation.ts";

const knownInput = {
  localDate: "2024-03-18",
  localTime: "08:30",
  timeKnown: true,
  gender: "MALE",
  locationName: "北京",
  locationMode: "REGISTERED_LOCATION",
  ianaTimezone: "Asia/Shanghai",
};

test("四柱字符串拼接，未知时柱使用双短线", () => {
  assert.equal(formatBaziOverview(["甲辰", "丙寅", "戊戌", "庚申"]), "甲辰　丙寅　戊戌　庚申");
  assert.equal(formatBaziOverview(["甲辰", "丙寅", "戊戌", null]), "甲辰　丙寅　戊戌　--");
});

test("出生资料摘要只展示输入与已解析 IANA，性别不参与四柱拼接", () => {
  const pillars = ["甲辰", "丙寅", "戊戌", "庚申"];
  assert.equal(formatBirthDisplay(knownInput), "2024-03-18 08:30");
  assert.equal(formatLocationDisplay(knownInput), "中国大陆 · 北京");
  assert.equal(formatGenderDisplay(knownInput.gender), "男");
  assert.equal(formatGenderDisplay("FEMALE"), "女");
  const malePillars = buildBaziClipboardText(pillars, knownInput).split("\n").slice(0, 5);
  const femalePillars = buildBaziClipboardText(pillars, { ...knownInput, gender: "FEMALE" }).split("\n").slice(0, 5);
  assert.deepEqual(femalePillars, malePillars);
  assert.equal(knownInput.ianaTimezone, "Asia/Shanghai");
});

test("未知时辰摘要与当前已确定能力不虚构时柱", () => {
  const unknown = { ...knownInput, localTime: null, timeKnown: false };
  assert.equal(formatBirthDisplay(unknown), "2024-03-18（时辰未知）");
  assert.doesNotMatch(getConfirmedCapabilities(false).join("/"), /时柱/);
  assert.match(getConfirmedCapabilities(true).join("/"), /时柱/);
});

test("能力边界明确列出当前能力与未提供能力", () => {
  assert.deepEqual(getConfirmedCapabilities(true), ["年柱", "月柱", "日柱", "时柱", "正式 IANA 时区换算", "节气边界校验"]);
  assert.deepEqual(UNSUPPORTED_BAZI_CAPABILITIES, ["五行旺衰", "喜用神", "大运", "流年", "运势解读"]);
});

test("复制文本覆盖四柱与出生摘要", () => {
  const text = buildBaziClipboardText(["甲辰", "丙寅", "戊戌", "庚申"], knownInput);
  assert.match(text, /^基础四柱\n年柱：甲辰\n月柱：丙寅\n日柱：戊戌\n时柱：庚申/);
  assert.match(text, /出生：2024-03-18 08:30/);
  assert.match(text, /地点：中国大陆 · 北京/);
  assert.match(text, /时区：Asia\/Shanghai/);
});

test("未知时柱复制为未知", () => {
  const text = buildBaziClipboardText(["甲辰", "丙寅", "戊戌", null], { ...knownInput, localTime: null, timeKnown: false });
  assert.match(text, /时柱：未知/);
  assert.match(text, /出生：2024-03-18（时辰未知）/);
});

test("clipboard成功与失败均返回明确状态", async () => {
  let copied = "";
  assert.equal(await copyBaziChartText("命盘", { writeText: async (text) => { copied = text; } }), true);
  assert.equal(copied, "命盘");
  assert.equal(await copyBaziChartText("命盘", { writeText: async () => { throw new Error("denied"); } }), false);
  assert.equal(await copyBaziChartText("命盘", null), false);
});

test("所有输入变化路径继续清除旧结果、fold和reference", () => {
  const source = readFileSync("src/components/bazi/birth-input-form.tsx", "utf8");
  const updateDraftBody = source.match(/function updateDraft[\s\S]*?\n  }/)?.[0] ?? "";
  assert.match(updateDraftBody, /pipelineRequests\.current\.invalidate\(\)/);
  assert.match(updateDraftBody, /setPipeline\(null\)/);
  assert.match(updateDraftBody, /setSubmittedDraft\(null\)/);
  assert.match(updateDraftBody, /resetBaziPageResolution\(\)/);
});
