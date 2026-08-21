import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { buildBaziFoundationBrowserRuntime } from "../scripts/build-bazi-foundation-browser-runtime.mjs";
import {
  BAZI_FOUNDATION_BROWSER_MANIFEST_PATH,
  loadBaziFoundationBrowserData,
} from "../src/lib/browser/bazi-foundation-data.ts";
import { loadFrozenBaziFoundationData } from "../src/lib/bazi/foundation-data-node.ts";
import { deriveTenGod, getHiddenStemSet, resolveElementRelation } from "../src/lib/bazi/foundation-engine.ts";
import { runBaziBrowserPipeline } from "../src/lib/bazi/bazi-browser-pipeline.ts";
import { createLatestRequestGate, settleLatestRequest } from "../src/lib/bazi/bazi-page-contract.ts";
import { deriveReadyCoreFoundation } from "../src/components/bazi/bazi-foundation-presentation.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const nodeData = loadFrozenBaziFoundationData(root);
const formalCases = JSON.parse(
  readFileSync(join(root, "data", "frozen", "bazi", "bazi_calendar_test_cases_v0.1.1.json"), "utf8"),
);
const normalCase = formalCases.cases.find((entry) => entry.case_id === "BZ-C001-WINTER-MORNING");
const referenceInstantUtc = "2026-08-07T12:00:00Z";

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

function pipelineDraft(overrides = {}) {
  return {
    calendarType: "GREGORIAN",
    localDate: normalCase.input.local_date,
    localTime: normalCase.input.local_time,
    timeKnown: true,
    gender: "MALE",
    locationName: "fixture display",
    selectionMode: "REGISTERED_LOCATION",
    registeredLocationId: "CN-MAINLAND",
    manualIanaTimezone: null,
    foldChoice: null,
    referenceInstantUtc,
    ...overrides,
  };
}

async function runPipeline(overrides = {}) {
  return runBaziBrowserPipeline(pipelineDraft(overrides), { fetchImpl: fakeFetch, referenceInstantUtc });
}

function unwrap(result) {
  assert.equal(result.ok, true, result.ok ? "" : result.error.code);
  return result.value;
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolvePromise = resolveValue;
    rejectPromise = rejectValue;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

test("Foundation Browser资产A/B重复生成文件、SHA与字节完全一致", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "foundation-browser-test-"));
  try {
    const runA = join(tempRoot, "a");
    const runB = join(tempRoot, "b");
    const a = buildBaziFoundationBrowserRuntime(runA);
    const b = buildBaziFoundationBrowserRuntime(runB);
    assert.equal(a.file_count, 2);
    assert.deepEqual(
      { asset: a.asset_sha256, manifest: a.manifest_sha256, bytes: a.total_bytes },
      { asset: b.asset_sha256, manifest: b.manifest_sha256, bytes: b.total_bytes },
    );
    for (const name of readdirSync(runA)) {
      assert.deepEqual(readFileSync(join(runA, name)), readFileSync(join(runB, name)));
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Browser与Node数据、25种五行关系及100种十神结果完全一致", async () => {
  const browser = await loadBaziFoundationBrowserData(fakeFetch);
  assert.deepEqual(browser.data.heavenlyStems, nodeData.heavenlyStems);
  assert.deepEqual(browser.data.earthlyBranches, nodeData.earthlyBranches);
  for (const entry of nodeData.hiddenStemSets) {
    assert.deepEqual(
      new Set(unwrap(getHiddenStemSet(browser.data, entry.branchId))),
      new Set(unwrap(getHiddenStemSet(nodeData, entry.branchId))),
    );
    assert.equal(entry.orderSemantics, "NONE");
  }
  const elements = [...new Set(nodeData.heavenlyStems.map((stem) => stem.element))];
  let relations = 0;
  for (const dayElement of elements) {
    for (const targetElement of elements) {
      assert.equal(
        resolveElementRelation(browser.data, dayElement, targetElement),
        resolveElementRelation(nodeData, dayElement, targetElement),
      );
      relations += 1;
    }
  }
  let tenGods = 0;
  for (const day of nodeData.heavenlyStems) {
    const row = nodeData.heavenlyStems.map((target) =>
      unwrap(deriveTenGod(browser.data, day.stemId, target.stemId)),
    );
    assert.equal(new Set(row).size, 10);
    tenGods += row.length;
  }
  assert.equal(relations, 25);
  assert.equal(tenGods, 100);
  assert.deepEqual(new Set(unwrap(getHiddenStemSet(browser.data, "WU"))), new Set(["DING", "JI"]));
});

test("Browser Foundation fetch失败或SHA错误会单独失败", async () => {
  await assert.rejects(
    loadBaziFoundationBrowserData(() => responseFromBytes(Buffer.alloc(0), 503)),
    /FOUNDATION_BROWSER_ASSET_HTTP_503/,
  );
  const manifestBytes = readFileSync(
    join(publicRoot, ...BAZI_FOUNDATION_BROWSER_MANIFEST_PATH.slice(1).split("/")),
  );
  const corrupt = Buffer.from(manifestBytes);
  corrupt[0] ^= 1;
  await assert.rejects(
    loadBaziFoundationBrowserData((path) =>
      path === BAZI_FOUNDATION_BROWSER_MANIFEST_PATH ? responseFromBytes(corrupt) : fakeFetch(path),
    ),
    /FOUNDATION_DATA_INTEGRITY_ERROR/,
  );
});

test("普通四柱展示日主、四柱十神和各藏干十神", async () => {
  const browser = await loadBaziFoundationBrowserData(fakeFetch);
  const pipeline = await runPipeline();
  const result = unwrap(deriveReadyCoreFoundation(browser.data, pipeline.result.coreResult));
  assert.equal(result.day.stem.tenGod, "比肩");
  assert.ok(result.hour);
  for (const pillar of [result.year, result.month, result.day, result.hour]) {
    assert.ok(pillar.stem.tenGod);
    for (const hidden of pillar.branch.hiddenStems) {
      assert.equal(hidden.tenGod, unwrap(deriveTenGod(browser.data, result.day.stem.stemId, hidden.stemId)));
    }
    assert.equal(pillar.branch.hiddenStemOrderSemantics, "NONE");
  }
});

test("未知时辰保留三柱，Blocked不读取Foundation，边界提醒不被覆盖", async () => {
  const browser = await loadBaziFoundationBrowserData(fakeFetch);
  const unknown = await runPipeline({ timeKnown: false, localTime: null });
  const unknownResult = unwrap(deriveReadyCoreFoundation(browser.data, unknown.result.coreResult));
  assert.equal(unknownResult.hour, null);

  const blocked = await runPipeline({ localDate: "2024-02-04", localTime: "16:26" });
  const forbiddenData = new Proxy({}, { get: () => { throw new Error("Foundation should not execute"); } });
  assert.equal(deriveReadyCoreFoundation(forbiddenData, blocked.result.coreResult), null);

  const boundary = await runPipeline({ localDate: "2024-02-04", localTime: "16:27" });
  assert.ok(boundary.result.coreResult.warnings.includes("BOUNDARY_SENSITIVE"));
  assert.equal(deriveReadyCoreFoundation(browser.data, boundary.result.coreResult)?.ok, true);
});

test("旧Foundation异步结果在输入身份变化后被latest-only gate丢弃", async () => {
  const gate = createLatestRequestGate();
  const state = { identity: "B", result: null };
  const old = deferred();
  const oldId = gate.begin();
  const settlement = settleLatestRequest(gate, oldId, old.promise, {
    onSuccess: (value) => { state.identity = "A"; state.result = value; },
    onError: () => {},
    onFinally: () => {},
  });
  gate.invalidate();
  old.resolve("A-result");
  assert.equal(await settlement, false);
  assert.deepEqual(state, { identity: "B", result: null });
});

test("Foundation页面链不持久化用户资料，失败提示不清空四柱", () => {
  const files = [
    "src/lib/browser/bazi-foundation-data.ts",
    "src/components/bazi/bazi-foundation-result.tsx",
    "src/components/bazi/bazi-foundation-presentation.ts",
    "src/components/bazi/ten-god-display-copy.ts",
    "src/components/bazi/bazi-pillar-result.tsx",
    "src/components/bazi/birth-input-form.tsx",
  ];
  const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
  for (const forbidden of [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.match(source, /基础命理说明暂时无法加载，四柱排盘结果不受影响。/);
  assert.match(source, /data-foundation-identity/);
  assert.match(source, /标准命理 \+ 白话解释/);
  assert.match(source, /藏干仅按成员展示，不区分主次。/);
  assert.match(source, /orderSemantics=NONE/);
  assert.match(source, /查看完整命盘结构与技术资料/);
  assert.match(source, /基础命理技术资料/);
});
