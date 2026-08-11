import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildBaziFoundationBrowserRuntime } from "./build-bazi-foundation-browser-runtime.mjs";
import {
  BAZI_FOUNDATION_BROWSER_MANIFEST_PATH,
  BAZI_FOUNDATION_BROWSER_MANIFEST_SHA256,
  loadBaziFoundationBrowserData,
} from "../src/lib/browser/bazi-foundation-data.ts";
import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import {
  deriveTenGod,
  getHiddenStemSet,
  resolveElementRelation,
} from "../src/lib/bazi/foundation-engine.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const runtimeRoot = join(publicRoot, "bazi-foundation-runtime", "v0.2.0");

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fakeFetch(path) {
  if (!path.startsWith("/bazi-foundation-runtime/v0.2.0/") || path.includes("..")) {
    return Promise.resolve({ ok: false, status: 400, arrayBuffer: async () => new ArrayBuffer(0) });
  }
  try {
    const bytes = readFileSync(join(publicRoot, ...path.slice(1).split("/")));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => buffer });
  } catch {
    return Promise.resolve({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  }
}

function unwrap(result) {
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

function normalizedHiddenSets(data) {
  return Object.fromEntries(
    data.hiddenStemSets.map((entry) => [
      entry.branchId,
      { members: [...entry.hiddenStemSet].sort(), orderSemantics: entry.orderSemantics },
    ]),
  );
}

function compareDirectoryBytes(left, right) {
  const leftNames = readdirSync(left).sort();
  const rightNames = readdirSync(right).sort();
  assert.deepEqual(leftNames, rightNames);
  for (const name of leftNames) {
    assert.deepEqual(readFileSync(join(left, name)), readFileSync(join(right, name)), name);
  }
  return leftNames;
}

const manifestBytes = readFileSync(
  join(runtimeRoot, "BAZI_FOUNDATION_BROWSER_MANIFEST_V0.2.0.json"),
);
assert.equal(digest(manifestBytes), BAZI_FOUNDATION_BROWSER_MANIFEST_SHA256);
assert.equal(
  BAZI_FOUNDATION_BROWSER_MANIFEST_PATH,
  "/bazi-foundation-runtime/v0.2.0/BAZI_FOUNDATION_BROWSER_MANIFEST_V0.2.0.json",
);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const assetBytes = readFileSync(join(publicRoot, ...manifest.asset.path.slice(1).split("/")));
assert.equal(assetBytes.length, manifest.asset.byte_size);
assert.equal(digest(assetBytes), manifest.asset.sha256);

const tempRoot = mkdtempSync(join(tmpdir(), "bazi-foundation-browser-validation-"));
let deterministicFiles;
try {
  const runA = join(tempRoot, "run-a");
  const runB = join(tempRoot, "run-b");
  const summaryA = buildBaziFoundationBrowserRuntime(runA);
  const summaryB = buildBaziFoundationBrowserRuntime(runB);
  assert.deepEqual(summaryA.asset_sha256, summaryB.asset_sha256);
  assert.deepEqual(summaryA.manifest_sha256, summaryB.manifest_sha256);
  assert.deepEqual(summaryA.total_bytes, summaryB.total_bytes);
  deterministicFiles = compareDirectoryBytes(runA, runB);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const browser = await loadBaziFoundationBrowserData(fakeFetch);
const node = loadFrozenBaziFoundationData(root);
assert.deepEqual(browser.data.heavenlyStems, node.heavenlyStems);
assert.deepEqual(browser.data.earthlyBranches, node.earthlyBranches);
assert.deepEqual(normalizedHiddenSets(browser.data), normalizedHiddenSets(node));
assert.deepEqual(browser.data.fiveElementRelations, node.fiveElementRelations);
assert.deepEqual(browser.data.tenGodFormula, node.tenGodFormula);
assert.deepEqual(browser.data.tenGodCanonicalNames, node.tenGodCanonicalNames);

const elements = [...new Set(node.heavenlyStems.map((stem) => stem.element))];
let elementPairCount = 0;
for (const dayElement of elements) {
  for (const targetElement of elements) {
    assert.equal(
      resolveElementRelation(browser.data, dayElement, targetElement),
      resolveElementRelation(node, dayElement, targetElement),
    );
    elementPairCount += 1;
  }
}

let tenGodCount = 0;
for (const day of node.heavenlyStems) {
  const browserRow = node.heavenlyStems.map((target) =>
    unwrap(deriveTenGod(browser.data, day.stemId, target.stemId)),
  );
  const nodeRow = node.heavenlyStems.map((target) =>
    unwrap(deriveTenGod(node, day.stemId, target.stemId)),
  );
  assert.deepEqual(browserRow, nodeRow);
  assert.equal(new Set(browserRow).size, 10);
  tenGodCount += browserRow.length;
}
assert.deepEqual(
  new Set(unwrap(getHiddenStemSet(browser.data, "WU"))),
  new Set(["DING", "JI"]),
);
assert.ok(browser.data.hiddenStemSets.every((entry) => entry.orderSemantics === "NONE"));

const asset = JSON.parse(assetBytes.toString("utf8"));
const assetText = JSON.stringify(asset);
for (const forbidden of [
  "matrix",
  "main_hidden_stem",
  "other_hidden_stems",
  "weight",
  "本气",
  "中气",
  "余气",
]) {
  assert.equal(assetText.includes(forbidden), false, forbidden);
}
const loaderSource = readFileSync(join(root, "src", "lib", "browser", "bazi-foundation-data.ts"), "utf8");
for (const forbidden of [
  /node:fs/,
  /node:path/,
  /node:crypto/,
  /https?:\/\//,
  /research[\\/]/i,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /document\.cookie/,
]) {
  assert.doesNotMatch(loaderSource, forbidden);
}
assert.equal(readdirSync(runtimeRoot).length, 2);

console.log(`BROWSER_ASSET_FILES=${deterministicFiles.length}/2`);
console.log(`BROWSER_ASSET_SHA256=${manifest.asset.sha256}`);
console.log(`BROWSER_MANIFEST_SHA256=${digest(manifestBytes)}`);
console.log(`BROWSER_ASSET_BYTES=${assetBytes.length}`);
console.log(`BROWSER_TOTAL_BYTES=${assetBytes.length + manifestBytes.length}`);
console.log("DETERMINISTIC_RUN_A_B=BYTE_IDENTICAL");
console.log(`STEMS_NODE_BROWSER=${browser.data.heavenlyStems.length}/10`);
console.log(`BRANCHES_NODE_BROWSER=${browser.data.earthlyBranches.length}/12`);
console.log(`HIDDEN_SETS_NODE_BROWSER=${browser.data.hiddenStemSets.length}/12`);
console.log(`ELEMENT_RELATIONS_NODE_BROWSER=${elementPairCount}/25`);
console.log(`TEN_GOD_NODE_BROWSER=${tenGodCount}/100`);
console.log("WU_HIDDEN_STEMS=DING,JI");
console.log("ORDER_SEMANTICS=NONE");
console.log("FOUNDATION_BROWSER_NODE_EQUAL=100%");
console.log(`FOUNDATION_BROWSER_LOADED_BYTES=${browser.loadedBytes}`);
console.log(`FOUNDATION_BROWSER_FILE_BYTES=${statSync(runtimeRoot).isDirectory() ? assetBytes.length + manifestBytes.length : 0}`);
console.log("BAZI_FOUNDATION_BROWSER_RUNTIME: ALL PASS");
