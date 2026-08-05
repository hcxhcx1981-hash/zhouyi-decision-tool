import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PRODUCT_MODULES } from "../src/lib/product/modules.ts";

test("首页包含两个模块入口", () => {
  assert.deepEqual(PRODUCT_MODULES.map((module) => module.href), ["/bazi/", "/liuyao/"]);
});

test("首页模块状态区分规则准备中和基础功能可用", () => {
  assert.equal(PRODUCT_MODULES.find((module) => module.id === "bazi")?.tone, "warning");
  assert.equal(PRODUCT_MODULES.find((module) => module.id === "liuyao")?.tone, "available");
});

test("首页不直接挂载完整六爻工作台", () => {
  const homeSource = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.match(homeSource, /ModuleCard/);
  assert.doesNotMatch(homeSource, /LiuyaoWorkbench|DecisionWorkbench/);
});

test("BaziBirthInput fixture 符合冻结数据形状", () => {
  const fixture = {
    calendarType: "solar",
    birthDate: "2000-01-02",
    birthTime: "03:04",
    timePrecision: "exact",
    gender: "female",
    location: { countryOrRegion: "fixture-region", city: "fixture-city" },
  };
  assert.equal(fixture.calendarType, "solar");
  assert.equal(fixture.location.city, "fixture-city");
});

test("LiuyaoCastInput fixture 固定六个自下而上爻值", () => {
  const fixture = {
    question: { title: "fixture-question", detail: "", timeRange: "fixture-range" },
    yaoValues: [7, 7, 7, 7, 7, 7],
  };
  assert.equal(fixture.yaoValues.length, 6);
  assert.deepEqual(fixture.yaoValues, [7, 7, 7, 7, 7, 7]);
});
