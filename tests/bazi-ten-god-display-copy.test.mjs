import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import { deriveTenGod } from "../src/lib/bazi/foundation-engine.ts";
import {
  DISPLAY_EXPLANATION_ONLY,
  FOUNDATION_CURRENTLY_DETERMINABLE,
  FOUNDATION_NOT_YET_DETERMINABLE,
  TEN_GOD_DISPLAY_COPY,
} from "../src/components/bazi/ten-god-display-copy.ts";

const foundation = loadFrozenBaziFoundationData();

function unwrap(result) {
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

test("10种十神均有标准定义和白话说明，且逐项对应Frozen公式", () => {
  assert.equal(DISPLAY_EXPLANATION_ONLY, true);
  assert.deepEqual(new Set(Object.keys(TEN_GOD_DISPLAY_COPY)), new Set(foundation.tenGodCanonicalNames));
  for (const [tenGod, copy] of Object.entries(TEN_GOD_DISPLAY_COPY)) {
    assert.ok(copy.standard.length > 5, tenGod);
    assert.ok(copy.plain.length > 12, tenGod);
    assert.equal(foundation.tenGodFormula[copy.elementRelation][copy.polarityRelation], tenGod);
  }
});

test("乙日主的辛、戊与自身关系继续由Foundation公式得出", () => {
  assert.equal(unwrap(deriveTenGod(foundation, "YI", "XIN")), "七杀");
  assert.equal(unwrap(deriveTenGod(foundation, "YI", "WU")), "正财");
  assert.equal(unwrap(deriveTenGod(foundation, "YI", "YI")), "比肩");
});

test("能力边界完整且展示helper不含解释业务字段", () => {
  assert.ok(FOUNDATION_CURRENTLY_DETERMINABLE.includes("各天干及藏干相对日主的十神关系"));
  assert.deepEqual(FOUNDATION_NOT_YET_DETERMINABLE, ["日主强弱", "命局旺衰", "喜用神", "格局", "大运", "流年", "财运", "事业", "感情", "吉凶"]);
  const source = readFileSync("src/components/bazi/ten-god-display-copy.ts", "utf8");
  for (const forbidden of ["fortune", "personality", "career", "marriage", "wealthPrediction", "lucky", "unlucky", "strong", "weak", "favorable"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.doesNotMatch(source, /一定有钱|一定压力大|一定叛逆|一定聪明|一定朋友多|官运/);
});
