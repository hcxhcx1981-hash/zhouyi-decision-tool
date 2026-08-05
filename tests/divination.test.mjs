import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  calculateDivination,
  DivinationInputError,
  parseRuntimeDivinationRules,
} from "../src/lib/divination.ts";

const runtimeRules = parseRuntimeDivinationRules(
  JSON.parse(fs.readFileSync("data/frozen/zhouyi_divination_rules_v0.1.json", "utf8")),
);
const frozenCases = JSON.parse(
  fs.readFileSync("data/frozen/zhouyi_rule_test_cases_v0.1.json", "utf8"),
).cases;

function comparable(result) {
  const primaryTargets = result.targets.filter((target) => target.role === "primary");
  const secondaryTargets = result.targets.filter((target) => target.role === "secondary");
  const firstPrimary = primaryTargets[0];
  return {
    moving_count: result.movingCount,
    rule_id: result.ruleId,
    automatic_decision: result.automaticDecision,
    blocked: result.blocked,
    primary_hexagram: firstPrimary?.hexagram,
    primary_positions: primaryTargets.flatMap((target) =>
      target.position === undefined ? [] : [target.position],
    ),
    secondary_positions: secondaryTargets.flatMap((target) =>
      target.position === undefined ? [] : [target.position],
    ),
    special_line: firstPrimary?.specialLine ?? null,
    text_selector: firstPrimary?.selector,
  };
}

for (const fixture of frozenCases) {
  test(`冻结规则案例 ${fixture.id}`, () => {
    if (fixture.expected_error) {
      assert.throws(
        () => calculateDivination(fixture.yao_values, runtimeRules),
        (error) => error instanceof DivinationInputError && error.code === fixture.expected_error,
      );
      return;
    }

    const actual = comparable(calculateDivination(fixture.yao_values, runtimeRules));
    for (const [key, expectedValue] of Object.entries(fixture.expected)) {
      assert.deepEqual(actual[key], expectedValue, `${fixture.id}: ${key}`);
    }
  });
}

test("本卦与之卦六爻码按自下而上计算", () => {
  const result = calculateDivination([9, 8, 8, 8, 7, 8], runtimeRules);
  assert.equal(result.originalKey, "100010");
  assert.equal(result.changedKey, "000010");
  assert.deepEqual(result.movingPositions, [1]);
});

test("任意三爻动都保持阻断且不产生主辞目标", () => {
  const result = calculateDivination([9, 6, 7, 8, 9, 8], runtimeRules);
  assert.equal(result.blocked, true);
  assert.equal(result.automaticDecision, false);
  assert.equal(result.targets.some((target) => target.role === "primary"), false);
});

test("运行时直接服从冻结 JSON 的 rule_id 与目标", () => {
  const modifiedRules = structuredClone(runtimeRules);
  const noMovingRule = modifiedRules.selectionRules.find((rule) => rule.movingCount === 0);
  noMovingRule.ruleId = "JSON_SOURCE_PROBE";
  noMovingRule.targets[0].hexagram = "changed";

  const result = calculateDivination([7, 7, 7, 7, 7, 7], modifiedRules);
  assert.equal(result.ruleId, "JSON_SOURCE_PROBE");
  assert.equal(result.targets[0].hexagram, "changed");
});
