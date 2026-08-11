import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { calculateBaziPillars } from "../src/lib/bazi/pillar-core.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import {
  FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS,
  derivePillarsFoundation,
  deriveTenGod,
  foundationPillarFromChinese,
  getEarthlyBranchByChinese,
  getEarthlyBranchById,
  getHeavenlyStemByChinese,
  getHeavenlyStemById,
  getHiddenStemSet,
  resolveElementRelation,
} from "../src/lib/bazi/foundation-engine.ts";

const root = resolve(import.meta.dirname, "..");
const foundation = loadFrozenBaziFoundationData(root);
const coreData = loadFrozenBaziData(root);
const fixture = JSON.parse(
  readFileSync(join(root, "tests", "fixtures", "bazi_core_normalized_cases_v0.1.1.json"), "utf8"),
);

function unwrap(result) {
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

function adaptCorePillar(pillar) {
  assert.ok(pillar);
  return unwrap(
    foundationPillarFromChinese(foundation, { stem: pillar.stem, branch: pillar.branch }),
  );
}

test("Foundation Node loader verifies and deeply freezes the formal V0.2.0 data", () => {
  assert.equal(foundation.datasetId, "BAZI_FOUNDATION_RULES_V0_2_0");
  assert.equal(foundation.version, "0.2.0");
  assert.equal(foundation.status, "FROZEN_RUNTIME_DATA");
  assert.equal(foundation.traditionScope, "ZIPING_BAZI");
  assert.equal(
    foundation.frozenSha256,
    "de157cf196f766cb919cded0d016087714328e248ad407d9d092b418eeb8e299",
  );
  assert.equal(
    foundation.manifestSha256,
    "ecb9b0eb330b11252329f16bdaa8edcc8251f8186bdaa6ee241fb87547fa348a",
  );
  assert.ok(Object.isFrozen(foundation));
  assert.ok(Object.isFrozen(foundation.heavenlyStems));
  assert.ok(Object.isFrozen(foundation.heavenlyStems[0]));
});

test("strict ID and Chinese lookups cover 10 stems and 12 branches without guessing", () => {
  assert.equal(foundation.heavenlyStems.length, 10);
  assert.equal(foundation.earthlyBranches.length, 12);
  for (const stem of foundation.heavenlyStems) {
    assert.deepEqual(unwrap(getHeavenlyStemById(foundation, stem.stemId)), stem);
    assert.deepEqual(unwrap(getHeavenlyStemByChinese(foundation, stem.chinese)), stem);
  }
  for (const branch of foundation.earthlyBranches) {
    assert.deepEqual(unwrap(getEarthlyBranchById(foundation, branch.branchId)), branch);
    assert.deepEqual(unwrap(getEarthlyBranchByChinese(foundation, branch.chinese)), branch);
  }
  assert.deepEqual(getHeavenlyStemByChinese(foundation, "甲木"), {
    ok: false,
    error: { code: "FOUNDATION_UNKNOWN_STEM", input: "甲木" },
  });
  assert.deepEqual(getEarthlyBranchById(foundation, "UNKNOWN"), {
    ok: false,
    error: { code: "FOUNDATION_UNKNOWN_BRANCH", input: "UNKNOWN" },
  });
});

test("12 hidden-stem sets expose membership only and all members resolve", () => {
  assert.equal(foundation.hiddenStemSets.length, 12);
  assert.equal(FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS, "NONE");
  let memberCount = 0;
  for (const entry of foundation.hiddenStemSets) {
    const members = unwrap(getHiddenStemSet(foundation, entry.branchId));
    assert.deepEqual(members, entry.hiddenStemSet);
    assert.equal(entry.orderSemantics, "NONE");
    for (const stemId of members) {
      assert.equal(getHeavenlyStemById(foundation, stemId).ok, true);
      memberCount += 1;
    }
  }
  assert.equal(memberCount, 28);
  assert.deepEqual(new Set(unwrap(getHiddenStemSet(foundation, "WU"))), new Set(["DING", "JI"]));
});

test("all 25 element pairs resolve exactly once and malformed data fails fast", () => {
  const elements = [...new Set(foundation.heavenlyStems.map((stem) => stem.element))];
  let count = 0;
  for (const dayElement of elements) {
    for (const targetElement of elements) {
      assert.ok(resolveElementRelation(foundation, dayElement, targetElement));
      count += 1;
    }
  }
  assert.equal(count, 25);

  const malformed = {
    ...foundation,
    fiveElementRelations: { generates: [], controls: [] },
  };
  assert.throws(
    () => resolveElementRelation(malformed, "WOOD", "FIRE"),
    /FOUNDATION_DATA_INTEGRITY_ERROR/,
  );
});

test("ten-god formula derives 100/100 cells and each day-stem row contains all ten", () => {
  let count = 0;
  for (const day of foundation.heavenlyStems) {
    const row = foundation.heavenlyStems.map((target) =>
      unwrap(deriveTenGod(foundation, day.stemId, target.stemId)),
    );
    assert.equal(row.length, 10);
    assert.equal(new Set(row).size, 10);
    assert.deepEqual(new Set(row), new Set(foundation.tenGodCanonicalNames));
    assert.equal(unwrap(deriveTenGod(foundation, day.stemId, day.stemId)), "比肩");
    count += row.length;
  }
  assert.equal(count, 100);
  assert.equal(deriveTenGod(foundation, "UNKNOWN", "JIA").ok, false);
});

test("an existing four-pillar result is unchanged and receives Foundation attributes only", () => {
  const fixtureCase = fixture.cases.find((item) => item.source_case_id === "BZ-C001-WINTER-MORNING");
  const coreResult = calculateBaziPillars(fixtureCase.normalized_input, coreData);
  assert.equal(coreResult.status, "READY");
  assert.ok(coreResult.hourPillar);
  const before = JSON.stringify(coreResult);
  const result = unwrap(
    derivePillarsFoundation(foundation, {
      year: adaptCorePillar(coreResult.yearPillar),
      month: adaptCorePillar(coreResult.monthPillar),
      day: adaptCorePillar(coreResult.dayPillar),
      hour: adaptCorePillar(coreResult.hourPillar),
    }),
  );
  assert.equal(JSON.stringify(coreResult), before);
  assert.equal(result.day.stem.tenGod, "比肩");
  assert.ok(result.hour);
  assert.equal(result.hour.branch.hiddenStemOrderSemantics, "NONE");
});

test("an existing unknown-hour result remains three pillars and Foundation hour stays null", () => {
  const fixtureCase = fixture.cases.find((item) => item.source_case_id === "BZ-C009-UNKNOWN-HOUR");
  const coreResult = calculateBaziPillars(fixtureCase.normalized_input, coreData);
  assert.equal(coreResult.status, "READY");
  assert.equal(coreResult.completeness, "THREE_PILLARS_ONLY");
  assert.equal(coreResult.hourPillar, null);
  const before = JSON.stringify(coreResult);
  const result = unwrap(
    derivePillarsFoundation(foundation, {
      year: adaptCorePillar(coreResult.yearPillar),
      month: adaptCorePillar(coreResult.monthPillar),
      day: adaptCorePillar(coreResult.dayPillar),
      hour: null,
    }),
  );
  assert.equal(JSON.stringify(coreResult), before);
  assert.equal(result.hour, null);
  assert.equal(result.day.stem.tenGod, "比肩");
});
