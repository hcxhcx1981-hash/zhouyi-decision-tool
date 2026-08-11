import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import {
  deriveTenGod,
  getHeavenlyStemById,
  getHiddenStemSet,
  resolveElementRelation,
} from "../src/lib/bazi/foundation-engine.ts";

const root = resolve(import.meta.dirname, "..");
const frozenPath = join(
  root,
  "data",
  "frozen",
  "bazi_foundation",
  "bazi_foundation_rules_v0.2.0.json",
);
const manifestPath = join(
  root,
  "data",
  "frozen",
  "bazi_foundation",
  "BAZI_FOUNDATION_MANIFEST_V0.2.0.json",
);
const expectedFrozenSha = "de157cf196f766cb919cded0d016087714328e248ad407d9d092b418eeb8e299";
const expectedManifestSha = "ecb9b0eb330b11252329f16bdaa8edcc8251f8186bdaa6ee241fb87547fa348a";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function unwrap(result) {
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

function collectKeys(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, result);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      result.push(key);
      collectKeys(child, result);
    }
  }
  return result;
}

assert.equal(sha256(frozenPath), expectedFrozenSha);
assert.equal(sha256(manifestPath), expectedManifestSha);
const rawFrozen = JSON.parse(readFileSync(frozenPath, "utf8"));
const rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(rawFrozen.dataset_id, "BAZI_FOUNDATION_RULES_V0_2_0");
assert.equal(rawFrozen.version, "0.2.0");
assert.equal(rawFrozen.tradition_scope, "ZIPING_BAZI");
assert.equal(rawManifest.frozen_rules_sha256, expectedFrozenSha);

const data = loadFrozenBaziFoundationData(root);
assert.equal(data.heavenlyStems.length, 10);
assert.equal(new Set(data.heavenlyStems.map((stem) => stem.stemId)).size, 10);
assert.equal(data.earthlyBranches.length, 12);
assert.equal(new Set(data.earthlyBranches.map((branch) => branch.branchId)).size, 12);
assert.equal(data.hiddenStemSets.length, 12);
assert.ok(data.hiddenStemSets.every((entry) => entry.orderSemantics === "NONE"));

const elements = [...new Set(data.heavenlyStems.map((stem) => stem.element))];
let elementPairCount = 0;
for (const dayElement of elements) {
  for (const targetElement of elements) {
    assert.ok(resolveElementRelation(data, dayElement, targetElement));
    elementPairCount += 1;
  }
}
assert.equal(elementPairCount, 25);

let tenGodCount = 0;
for (const dayStem of data.heavenlyStems) {
  const row = data.heavenlyStems.map((targetStem) =>
    unwrap(deriveTenGod(data, dayStem.stemId, targetStem.stemId)),
  );
  assert.equal(new Set(row).size, 10);
  assert.deepEqual(new Set(row), new Set(data.tenGodCanonicalNames));
  assert.equal(unwrap(deriveTenGod(data, dayStem.stemId, dayStem.stemId)), "比肩");
  tenGodCount += row.length;
}
assert.equal(tenGodCount, 100);

let hiddenMemberCount = 0;
for (const entry of data.hiddenStemSets) {
  for (const stemId of unwrap(getHiddenStemSet(data, entry.branchId))) {
    assert.equal(getHeavenlyStemById(data, stemId).ok, true);
    for (const dayStem of data.heavenlyStems) {
      assert.equal(deriveTenGod(data, dayStem.stemId, stemId).ok, true);
    }
    hiddenMemberCount += 1;
  }
}
assert.deepEqual(new Set(unwrap(getHiddenStemSet(data, "WU"))), new Set(["DING", "JI"]));

const rawKeys = collectKeys(rawFrozen);
assert.equal(rawKeys.some((key) => key.toLowerCase().includes("matrix")), false);

const foundationFiles = readdirSync(join(root, "src", "lib", "bazi"))
  .filter((name) => /^foundation.*\.ts$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(root, "src", "lib", "bazi", name), "utf8") }));
const forbidden = [
  "BZ-C",
  "main_hidden_stem",
  "other_hidden_stems",
  "本气",
  "中气",
  "余气",
  "60/30/10",
  "70/20/10",
  "hiddenStemWeight",
  "旺衰",
  "喜用神",
  "fetch",
  "research/",
];
for (const file of foundationFiles) {
  for (const token of forbidden) {
    assert.equal(file.text.includes(token), false, `${file.name} contains forbidden token ${token}`);
  }
}

console.log(`FROZEN_SHA256=${expectedFrozenSha}`);
console.log(`MANIFEST_SHA256=${expectedManifestSha}`);
console.log(`HEAVENLY_STEMS=${data.heavenlyStems.length}/10`);
console.log(`EARTHLY_BRANCHES=${data.earthlyBranches.length}/12`);
console.log(`HIDDEN_STEM_SETS=${data.hiddenStemSets.length}/12`);
console.log(`HIDDEN_MEMBER_TOTAL=${hiddenMemberCount}`);
console.log(`ELEMENT_RELATIONS=${elementPairCount}/25`);
console.log(`TEN_GOD_DERIVATIONS=${tenGodCount}/100`);
console.log("TEN_GOD_PER_ROW=10/10 UNIQUE");
console.log("SELF_TEN_GOD=比肩");
console.log("WU_HIDDEN_STEMS=DING,JI");
console.log("RUNTIME_MATRIX=ABSENT");
console.log("RESEARCH_RUNTIME_READ=ABSENT");
console.log("INTERPRETIVE_CAPABILITY=ABSENT");
console.log("BAZI_FOUNDATION_RUNTIME: ALL PASS");
