import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { buildBaziInterpretationBrowserRuntime } from "../scripts/build-bazi-interpretation-browser-runtime.mjs";
import {
  BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH,
  BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256,
  loadBaziInterpretationBrowserData,
  parseBaziInterpretationProtocolAsset,
} from "../src/lib/browser/bazi-interpretation-data.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const runtimeRoot = join(publicRoot, "bazi-interpretation-runtime", "v0.1.0");
const assetPath = join(runtimeRoot, "bazi-interpretation-protocol-v0.1.0.json");
const manifestPath = join(runtimeRoot, "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0.1.0.json");

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function responseFromBytes(bytes, status = 200) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return Promise.resolve({ ok: status === 200, status, arrayBuffer: async () => buffer });
}

function fakeFetch(path) {
  try {
    return responseFromBytes(readFileSync(join(publicRoot, ...path.slice(1).split("/"))));
  } catch {
    return responseFromBytes(Buffer.alloc(0), 404);
  }
}

test("Interpretation Browser资产A/B重复生成文件、SHA与字节完全一致", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "interpretation-browser-test-"));
  try {
    const runA = join(tempRoot, "a");
    const runB = join(tempRoot, "b");
    const a = buildBaziInterpretationBrowserRuntime(runA);
    const b = buildBaziInterpretationBrowserRuntime(runB);
    assert.equal(a.file_count, 2);
    assert.deepEqual(
      { asset: a.asset_sha256, manifest: a.manifest_sha256, bytes: a.total_bytes },
      { asset: b.asset_sha256, manifest: b.manifest_sha256, bytes: b.total_bytes },
    );
    assert.deepEqual(readdirSync(runA).sort(), readdirSync(runB).sort());
    for (const name of readdirSync(runA)) {
      assert.deepEqual(readFileSync(join(runA, name)), readFileSync(join(runB, name)));
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Interpretation Browser正常加载且只请求same-origin路径", async () => {
  const paths = [];
  const loaded = await loadBaziInterpretationBrowserData((path) => {
    paths.push(path);
    return fakeFetch(path);
  });
  assert.equal(loaded.data.version, "0.1.0");
  assert.equal(loaded.data.traditionScope, "ZIPING_BAZI");
  assert.equal(paths.length, 2);
  assert.ok(paths.every((path) => path.startsWith("/bazi-interpretation-runtime/v0.1.0/")));
  assert.ok(Object.isFrozen(loaded));
  assert.ok(Object.isFrozen(loaded.data.safeGlosses));
});

test("Browser Manifest与协议资产SHA、大小均正确", () => {
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const assetBytes = readFileSync(assetPath);
  assert.equal(digest(manifestBytes), BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256);
  assert.equal(digest(assetBytes), manifest.asset.sha256);
  assert.equal(assetBytes.length, manifest.asset.byte_size);
  assert.equal(manifest.asset.path, "/bazi-interpretation-runtime/v0.1.0/bazi-interpretation-protocol-v0.1.0.json");
});

test("Browser Manifest元数据与正式版本正确", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.dataset_id, "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0_1_0");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.tradition_scope, "ZIPING_BAZI");
  assert.equal(manifest.counts.safe_glosses, 7);
  assert.equal(manifest.counts.fact_only_terms, 4);
});

test("协议版本、tradition_scope与Frozen SHA正确", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.equal(loaded.data.version, "0.1.0");
  assert.equal(loaded.data.traditionScope, "ZIPING_BAZI");
  assert.equal(loaded.data.frozenSha256, "084de621127eb4307f025d39a5ef9a7770c2b935a3d70dac872ac6e08ccbac34");
});

test("SAFE恰好7条且正式术语完整", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.deepEqual(
    loaded.data.safeGlosses.map((entry) => entry.canonicalTerm),
    ["日主", "七杀", "伤官", "正官", "正印", "食神", "正财"],
  );
});

test("FACT_ONLY恰好4条且均无SAFE gloss", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.deepEqual(
    loaded.data.factOnlyTerms.map((entry) => entry.canonicalTerm),
    ["比肩", "劫财", "偏财", "偏印"],
  );
  assert.ok(loaded.data.factOnlyTerms.every((entry) => entry.gate === "FACT_ONLY" && !entry.safeGlossAvailable));
});

test("COUNT_ONLY_IS_NOT_INTERPRETATION按FACT_ONLY读取", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.equal(loaded.data.countPolicy.policyId, "COUNT_ONLY_IS_NOT_INTERPRETATION");
  assert.equal(loaded.data.countPolicy.gate, "FACT_ONLY");
  assert.equal(loaded.data.countPolicy.appliesTo, "ALL_TEN_GODS");
});

test("visible_hidden policy只暴露事实层语句", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.equal(loaded.data.visibleHiddenPolicy.gate, "FACT_ONLY");
  assert.deepEqual(loaded.data.visibleHiddenPolicy.allowedStatements, [
    "该十神出现在天干",
    "该十神仅存在于地支藏干",
    "该十神同时存在于天干与藏干",
  ]);
  assert.equal(loaded.data.visibleHiddenPolicy.caseI11.status, "FACT_ONLY");
});

test("prohibited规则20条完整读取", async () => {
  const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
  assert.equal(loaded.data.prohibitedDirectInferences.length, 20);
  assert.equal(loaded.data.prohibitedDirectInferences.filter((entry) => entry.category === "DIRECT_LANGUAGE").length, 12);
  assert.equal(loaded.data.prohibitedDirectInferences.filter((entry) => entry.category === "SINGLE_TEN_GOD_LIFE_INFERENCE").length, 8);
});

test("首次fetch失败不缓存rejected Promise，第二次成功且成功结果缓存", async () => {
  let calls = 0;
  let firstManifestRequest = true;
  const flakyFetch = (path) => {
    calls += 1;
    if (path === BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH && firstManifestRequest) {
      firstManifestRequest = false;
      return responseFromBytes(Buffer.alloc(0), 503);
    }
    return fakeFetch(path);
  };
  await assert.rejects(
    loadBaziInterpretationBrowserData(flakyFetch),
    /INTERPRETATION_BROWSER_ASSET_HTTP_503/,
  );
  const loaded = await loadBaziInterpretationBrowserData(flakyFetch);
  assert.equal(loaded.data.safeGlosses.length, 7);
  const callsAfterSuccess = calls;
  const cached = await loadBaziInterpretationBrowserData(flakyFetch);
  assert.strictEqual(cached, loaded);
  assert.equal(calls, callsAfterSuccess);
});

test("malformed JSON被拒绝", async () => {
  const malformedFetch = (path) => path === BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH
    ? responseFromBytes(Buffer.from("{"))
    : fakeFetch(path);
  await assert.rejects(
    loadBaziInterpretationBrowserData(malformedFetch),
    /INTERPRETATION_DATA_INTEGRITY_ERROR/,
  );
});

test("SHA错误被拒绝", async () => {
  const corrupt = Buffer.from(readFileSync(manifestPath));
  corrupt[0] ^= 1;
  const corruptFetch = (path) => path === BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH
    ? responseFromBytes(corrupt)
    : fakeFetch(path);
  await assert.rejects(
    loadBaziInterpretationBrowserData(corruptFetch),
    /INTERPRETATION_DATA_INTEGRITY_ERROR/,
  );
});

test("协议version错误被解析器拒绝", () => {
  const asset = JSON.parse(readFileSync(assetPath, "utf8"));
  asset.version = "0.1.1";
  assert.throws(
    () => parseBaziInterpretationProtocolAsset(asset),
    /INTERPRETATION_DATA_INTEGRITY_ERROR/,
  );
});
