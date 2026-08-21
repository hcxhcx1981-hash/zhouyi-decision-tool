import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildBaziInterpretationBrowserRuntime } from "./build-bazi-interpretation-browser-runtime.mjs";
import {
  BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH,
  BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256,
  BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256,
  loadBaziInterpretationBrowserData,
} from "../src/lib/browser/bazi-interpretation-data.ts";

const root = resolve(import.meta.dirname, "..");
const publicRoot = join(root, "public");
const frozenPath = join(root, "data", "frozen", "bazi_interpretation", "bazi_interpretation_protocol_v0.1.0.json");
const runtimeRoot = join(publicRoot, "bazi-interpretation-runtime", "v0.1.0");
const assetPath = join(runtimeRoot, "bazi-interpretation-protocol-v0.1.0.json");
const manifestPath = join(runtimeRoot, "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0.1.0.json");
const safeTerms = ["日主", "七杀", "伤官", "正官", "正印", "食神", "正财"];
const factOnlyTerms = ["比肩", "劫财", "偏财", "偏印"];

class Checks {
  total = 0;
  failures = [];

  check(condition, label) {
    this.total += 1;
    if (condition) console.log(`PASS ${String(this.total).padStart(2, "0")}: ${label}`);
    else {
      this.failures.push(label);
      console.log(`FAIL ${String(this.total).padStart(2, "0")}: ${label}`);
    }
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function responseFromBytes(bytes, status = 200) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return Promise.resolve({ ok: status === 200, status, arrayBuffer: async () => buffer });
}

function fakeFetch(path) {
  if (!path.startsWith("/bazi-interpretation-runtime/v0.1.0/") || path.includes("..")) {
    return responseFromBytes(Buffer.alloc(0), 400);
  }
  try {
    return responseFromBytes(readFileSync(join(publicRoot, ...path.slice(1).split("/"))));
  } catch {
    return responseFromBytes(Buffer.alloc(0), 404);
  }
}

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function sameTerms(entries, expected) {
  const actual = entries.map((entry) => entry.canonical_term);
  return actual.length === expected.length && expected.every((term) => actual.includes(term));
}

const c = new Checks();
let frozen;
let asset;
let manifest;
let assetBytes;
let manifestBytes;

try {
  const frozenBytes = readFileSync(frozenPath);
  assetBytes = readFileSync(assetPath);
  manifestBytes = readFileSync(manifestPath);
  frozen = JSON.parse(frozenBytes.toString("utf8"));
  asset = JSON.parse(assetBytes.toString("utf8"));
  manifest = JSON.parse(manifestBytes.toString("utf8"));
  c.check(true, "Frozen、Browser asset与Browser manifest存在且可读");
  c.check(digest(frozenBytes) === BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256, "Frozen Protocol SHA正确");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  throw error;
}

c.check(readdirSync(runtimeRoot).length === 2, "Browser Runtime目录仅含两个正式文件");
c.check(digest(manifestBytes) === BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256, "Browser Manifest SHA正确");
c.check(digest(assetBytes) === manifest.asset.sha256, "Browser asset SHA正确");
c.check(assetBytes.length === manifest.asset.byte_size, "Browser asset字节数正确");
c.check(manifest.version === frozen.version && asset.version === frozen.version, "version与Frozen一致");
c.check(manifest.tradition_scope === "ZIPING_BAZI" && asset.tradition_scope === "ZIPING_BAZI", "tradition_scope=ZIPING_BAZI");
c.check(manifest.source_frozen_sha256 === BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256, "Manifest绑定正式Frozen SHA");
c.check(asset.source_frozen_sha256 === BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256, "Browser asset绑定正式Frozen SHA");

const projectionFields = [
  "schema_version",
  "version",
  "tradition_scope",
  "safe_glosses",
  "fact_only_terms",
  "interpretation_gates",
  "count_policy",
  "visible_hidden_policy",
  "prohibited_direct_inferences",
  "context_required_topics",
  "known_limitations",
];
for (const field of projectionFields) {
  c.check(JSON.stringify(asset[field]) === JSON.stringify(frozen[field]), `Browser projection保持Frozen字段：${field}`);
}

const tempRoot = mkdtempSync(join(tmpdir(), "bazi-interpretation-browser-validation-"));
try {
  const runA = join(tempRoot, "run-a");
  const runB = join(tempRoot, "run-b");
  const a = buildBaziInterpretationBrowserRuntime(runA);
  const b = buildBaziInterpretationBrowserRuntime(runB);
  c.check(a.asset_sha256 === b.asset_sha256 && a.manifest_sha256 === b.manifest_sha256, "重复生成SHA一致");
  c.check(
    readdirSync(runA).every((name) => readFileSync(join(runA, name)).equals(readFileSync(join(runB, name)))),
    "重复生成字节一致",
  );
  c.check(readFileSync(join(runA, "bazi-interpretation-protocol-v0.1.0.json")).equals(assetBytes), "生成asset与正式Browser asset一致");
  c.check(readFileSync(join(runA, "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0.1.0.json")).equals(manifestBytes), "生成manifest与正式Browser manifest一致");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

c.check(asset.safe_glosses.length === 7 && sameTerms(asset.safe_glosses, safeTerms), "SAFE数量7且正式术语完整");
for (const term of safeTerms) c.check(asset.safe_glosses.some((entry) => entry.canonical_term === term), `${term} SAFE存在`);
c.check(asset.fact_only_terms.length === 4 && sameTerms(asset.fact_only_terms, factOnlyTerms), "FACT_ONLY数量4且术语完整");
for (const term of factOnlyTerms) {
  c.check(
    !asset.safe_glosses.some((entry) => entry.canonical_term === term) &&
      asset.fact_only_terms.some((entry) => entry.canonical_term === term && entry.gate === "FACT_ONLY" && entry.safe_gloss_available === false),
    `${term}无SAFE且仅FACT_ONLY`,
  );
}
c.check(asset.count_policy.policy_id === "COUNT_ONLY_IS_NOT_INTERPRETATION" && asset.count_policy.gate === "FACT_ONLY", "COUNT_ONLY_IS_NOT_INTERPRETATION存在");
c.check(asset.visible_hidden_policy.gate === "FACT_ONLY" && asset.visible_hidden_policy.allowed_statements.length === 3, "visible_hidden只允许事实层");
c.check(asset.visible_hidden_policy.case_i11.status === "FACT_ONLY", "CASE-I11为FACT_ONLY");
c.check(asset.prohibited_direct_inferences.length === 20, "prohibited列表总数20");
c.check(
  JSON.stringify(asset.prohibited_direct_inferences) === JSON.stringify(frozen.prohibited_direct_inferences),
  "prohibited列表与Frozen完整一致",
);
c.check(Object.keys(asset.interpretation_gates).length === 4, "四个Interpretation Gate完整");
c.check(asset.context_required_topics.length === 8, "CONTEXT_REQUIRED主题边界完整");
c.check(asset.known_limitations.length === 3, "known limitations完整");

const allKeys = collectKeys(asset);
for (const forbidden of [
  "strength_algorithm",
  "strengthScore",
  "yongshen_algorithm",
  "favorableElement",
  "pattern_algorithm",
  "dayun_algorithm",
  "liunian_algorithm",
  "fortune",
  "career",
  "wealth",
  "marriage",
  "health",
  "personality",
  "luck",
]) {
  c.check(!allKeys.has(forbidden), `无禁止字段：${forbidden}`);
}
const serialized = JSON.stringify(asset);
c.check(!/https?:\/\//i.test(serialized) && !serialized.includes("short_excerpt") && !serialized.includes("source_evidence"), "无网络来源、古籍摘录或research证据正文");
c.check(!["birth_name", "identity_card", "phone_number", "user_profile"].some((key) => allKeys.has(key)), "无用户真实资料字段");

const loaderSource = readFileSync(join(root, "src", "lib", "browser", "bazi-interpretation-data.ts"), "utf8");
for (const forbidden of [/node:fs/, /node:path/, /node:crypto/, /https?:\/\//, /research[\\/]/i, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/]) {
  c.check(!forbidden.test(loaderSource), `Loader不包含 ${forbidden}`);
}
c.check(loaderSource.includes("globalThis.crypto.subtle.digest(\"SHA-256\""), "Loader使用Web Crypto SHA-256");
c.check(BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH.startsWith("/bazi-interpretation-runtime/"), "Loader使用same-origin manifest路径");

const loaded = await loadBaziInterpretationBrowserData(fakeFetch);
c.check(loaded.data.safeGlosses.length === 7 && loaded.data.factOnlyTerms.length === 4, "Loader正常读取SAFE与FACT_ONLY");
c.check(Object.isFrozen(loaded) && Object.isFrozen(loaded.data) && Object.isFrozen(loaded.data.safeGlosses), "Loader返回深只读数据");

let first = true;
let calls = 0;
const retryFetch = (path) => {
  calls += 1;
  if (first) {
    first = false;
    return responseFromBytes(Buffer.alloc(0), 503);
  }
  return fakeFetch(path);
};
await assert.rejects(loadBaziInterpretationBrowserData(retryFetch), /HTTP_503/);
const retried = await loadBaziInterpretationBrowserData(retryFetch);
const callsAfterSuccess = calls;
const cached = await loadBaziInterpretationBrowserData(retryFetch);
c.check(retried.data.version === "0.1.0", "首次失败后第二次调用成功");
c.check(cached === retried && calls === callsAfterSuccess, "成功结果缓存且rejected Promise未永久缓存");

if (c.failures.length > 0) {
  console.log(`RESULT: FAIL (${c.total - c.failures.length}/${c.total} PASS)`);
  process.exitCode = 1;
} else {
  console.log(`BROWSER_ASSET_SHA256=${digest(assetBytes)}`);
  console.log(`BROWSER_MANIFEST_SHA256=${digest(manifestBytes)}`);
  console.log(`RESULT: PASS (${c.total}/${c.total})`);
}
