import type {
  CountPolicy,
  FactOnlyTerm,
  InterpretationGate,
  InterpretationProtocol,
  ProhibitedDirectInference,
  SafeGloss,
  VisibleHiddenPolicy,
} from "../bazi/interpretation-runtime-types.ts";

export const BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH =
  "/bazi-interpretation-runtime/v0.1.0/BAZI_INTERPRETATION_BROWSER_MANIFEST_V0.1.0.json";
export const BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256 =
  "afa7dd44b6ccbac2153661dba2ba5377e96715af98dd0160087f627d5d437a25";
export const BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256 =
  "084de621127eb4307f025d39a5ef9a7770c2b935a3d70dac872ac6e08ccbac34";

const RUNTIME_PREFIX = "/bazi-interpretation-runtime/v0.1.0/";
const SAFE_TERMS = ["日主", "七杀", "伤官", "正官", "正印", "食神", "正财"] as const;
const FACT_ONLY_TERMS = ["比肩", "劫财", "偏财", "偏印"] as const;
const GATE_NAMES = [
  "FACT_ONLY",
  "SAFE_SEMANTIC_GLOSS",
  "CONTEXT_REQUIRED",
  "PROHIBITED_DIRECT_INFERENCE",
] as const;
const ASSET_KEYS = [
  "context_required_topics",
  "count_policy",
  "dataset_id",
  "fact_only_terms",
  "interpretation_gates",
  "known_limitations",
  "prohibited_direct_inferences",
  "safe_glosses",
  "schema_version",
  "source_frozen_sha256",
  "status",
  "tradition_scope",
  "version",
  "visible_hidden_policy",
] as const;

type JsonRecord = Record<string, unknown>;

export interface InterpretationBrowserFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type InterpretationBrowserFetch = (
  path: string,
) => Promise<InterpretationBrowserFetchResponse>;

export interface InterpretationBrowserLoadResult {
  readonly data: InterpretationProtocol;
  readonly loadedBytes: number;
  readonly loadedAssetPaths: readonly string[];
}

function failIntegrity(): never {
  throw new Error("INTERPRETATION_DATA_INTEGRITY_ERROR");
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function hasExactMembers(values: readonly string[], expected: readonly string[]): boolean {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
  return hasExactMembers(Object.keys(value), expected);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

async function digest(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) failIntegrity();
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeRuntimePath(path: string): boolean {
  return path.startsWith(RUNTIME_PREFIX) && !path.includes("..") && !/^https?:/i.test(path);
}

async function readVerifiedJson(
  fetchImpl: InterpretationBrowserFetch,
  path: string,
  expectedSha256: string,
): Promise<{ value: JsonRecord; bytes: number }> {
  if (!safeRuntimePath(path)) failIntegrity();
  const response = await fetchImpl(path);
  if (!response.ok) throw new Error(`INTERPRETATION_BROWSER_ASSET_HTTP_${response.status}`);
  const buffer = await response.arrayBuffer();
  if ((await digest(buffer)) !== expectedSha256) failIntegrity();
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(buffer));
    if (!isRecord(value)) failIntegrity();
    return { value, bytes: buffer.byteLength };
  } catch {
    failIntegrity();
  }
}

function parseSafeGloss(value: unknown): SafeGloss {
  if (!isRecord(value)) failIntegrity();
  if (
    typeof value.semantic_id !== "string" ||
    !SAFE_TERMS.includes(value.canonical_term as (typeof SAFE_TERMS)[number]) ||
    (value.standard_expression !== undefined && typeof value.standard_expression !== "string") ||
    typeof value.plain_language !== "string" ||
    !isStringArray(value.allowed_topics) ||
    value.gate !== "SAFE_SEMANTIC_GLOSS" ||
    !isStringArray(value.source_ids) ||
    value.source_ids.length === 0
  ) {
    failIntegrity();
  }
  return {
    semanticId: value.semantic_id,
    canonicalTerm: value.canonical_term as SafeGloss["canonicalTerm"],
    ...(value.standard_expression === undefined
      ? {}
      : { standardExpression: value.standard_expression }),
    plainLanguage: value.plain_language,
    allowedTopics: value.allowed_topics,
    gate: "SAFE_SEMANTIC_GLOSS",
    sourceIds: value.source_ids,
  };
}

function parseFactOnlyTerm(value: unknown): FactOnlyTerm {
  if (!isRecord(value)) failIntegrity();
  if (
    !FACT_ONLY_TERMS.includes(value.canonical_term as (typeof FACT_ONLY_TERMS)[number]) ||
    value.gate !== "FACT_ONLY" ||
    typeof value.allowed !== "string" ||
    value.safe_gloss_available !== false
  ) {
    failIntegrity();
  }
  return {
    canonicalTerm: value.canonical_term as FactOnlyTerm["canonicalTerm"],
    gate: "FACT_ONLY",
    allowed: value.allowed,
    safeGlossAvailable: false,
  };
}

function parseCountPolicy(value: unknown): CountPolicy {
  if (!isRecord(value)) failIntegrity();
  if (
    value.policy_id !== "COUNT_ONLY_IS_NOT_INTERPRETATION" ||
    value.gate !== "FACT_ONLY" ||
    typeof value.allowed_example !== "string" ||
    !isStringArray(value.prohibited_modifiers) ||
    value.applies_to !== "ALL_TEN_GODS"
  ) {
    failIntegrity();
  }
  return {
    policyId: "COUNT_ONLY_IS_NOT_INTERPRETATION",
    gate: "FACT_ONLY",
    allowedExample: value.allowed_example,
    prohibitedModifiers: value.prohibited_modifiers,
    appliesTo: "ALL_TEN_GODS",
  };
}

function parseVisibleHiddenPolicy(value: unknown): VisibleHiddenPolicy {
  if (!isRecord(value) || !isRecord(value.case_i11)) failIntegrity();
  if (
    value.gate !== "FACT_ONLY" ||
    !isStringArray(value.allowed_statements) ||
    value.allowed_statements.length !== 3 ||
    !isStringArray(value.prohibited_interpretations) ||
    !isStringArray(value.deferred_gate) ||
    value.case_i11.case_id !== "CASE-I11" ||
    value.case_i11.status !== "FACT_ONLY"
  ) {
    failIntegrity();
  }
  return {
    gate: "FACT_ONLY",
    allowedStatements: value.allowed_statements,
    prohibitedInterpretations: value.prohibited_interpretations,
    deferredGate: value.deferred_gate,
    caseI11: { caseId: "CASE-I11", status: "FACT_ONLY" },
  };
}

function parseProhibitedInference(value: unknown): ProhibitedDirectInference {
  if (!isRecord(value)) failIntegrity();
  if (
    typeof value.text !== "string" ||
    (value.category !== "DIRECT_LANGUAGE" && value.category !== "SINGLE_TEN_GOD_LIFE_INFERENCE")
  ) {
    failIntegrity();
  }
  return { text: value.text, category: value.category };
}

export function parseBaziInterpretationProtocolAsset(
  asset: JsonRecord,
  manifestSha256 = BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256,
): InterpretationProtocol {
  const rawGates = asset.interpretation_gates;
  if (
    !hasExactKeys(asset, ASSET_KEYS) ||
    asset.dataset_id !== "BAZI_INTERPRETATION_BROWSER_RUNTIME_V0_1_0" ||
    asset.schema_version !== "0.1.0" ||
    asset.version !== "0.1.0" ||
    asset.status !== "DERIVED_BROWSER_RUNTIME_ASSET" ||
    asset.tradition_scope !== "ZIPING_BAZI" ||
    asset.source_frozen_sha256 !== BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256 ||
    !Array.isArray(asset.safe_glosses) ||
    !Array.isArray(asset.fact_only_terms) ||
    !isRecord(rawGates) ||
    !Array.isArray(asset.prohibited_direct_inferences) ||
    !isStringArray(asset.context_required_topics) ||
    !isStringArray(asset.known_limitations)
  ) {
    failIntegrity();
  }

  const safeGlosses = asset.safe_glosses.map(parseSafeGloss);
  const factOnlyTerms = asset.fact_only_terms.map(parseFactOnlyTerm);
  if (
    !hasExactMembers(safeGlosses.map((entry) => entry.canonicalTerm), SAFE_TERMS) ||
    !hasExactMembers(factOnlyTerms.map((entry) => entry.canonicalTerm), FACT_ONLY_TERMS) ||
    !hasExactMembers(Object.keys(rawGates), GATE_NAMES) ||
    !Object.values(rawGates).every((entry) => typeof entry === "string") ||
    asset.prohibited_direct_inferences.length !== 20 ||
    asset.context_required_topics.length !== 8 ||
    asset.known_limitations.length !== 3
  ) {
    failIntegrity();
  }

  const interpretationGates = Object.fromEntries(
    GATE_NAMES.map((gate) => [gate, rawGates[gate]]),
  ) as Record<InterpretationGate, string>;
  const data: InterpretationProtocol = {
    version: "0.1.0",
    traditionScope: "ZIPING_BAZI",
    frozenSha256: BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256,
    manifestSha256,
    safeGlosses,
    factOnlyTerms,
    interpretationGates,
    countPolicy: parseCountPolicy(asset.count_policy),
    visibleHiddenPolicy: parseVisibleHiddenPolicy(asset.visible_hidden_policy),
    prohibitedDirectInferences: asset.prohibited_direct_inferences.map(parseProhibitedInference),
    contextRequiredTopics: asset.context_required_topics,
    knownLimitations: asset.known_limitations,
  };
  return deepFreeze(data);
}

export const defaultInterpretationBrowserFetch: InterpretationBrowserFetch = async (path) => {
  if (!safeRuntimePath(path)) failIntegrity();
  return fetch(path, { cache: "force-cache" });
};

async function loadUncached(
  fetchImpl: InterpretationBrowserFetch,
): Promise<InterpretationBrowserLoadResult> {
  const manifestFile = await readVerifiedJson(
    fetchImpl,
    BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH,
    BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256,
  );
  const manifest = manifestFile.value;
  if (
    manifest.dataset_id !== "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0_1_0" ||
    manifest.version !== "0.1.0" ||
    manifest.status !== "DERIVED_BROWSER_RUNTIME_MANIFEST" ||
    manifest.tradition_scope !== "ZIPING_BAZI" ||
    manifest.source_frozen_sha256 !== BAZI_INTERPRETATION_FROZEN_PROTOCOL_SHA256 ||
    !isRecord(manifest.asset) ||
    !isRecord(manifest.counts) ||
    manifest.counts.safe_glosses !== 7 ||
    manifest.counts.fact_only_terms !== 4 ||
    manifest.counts.interpretation_gates !== 4 ||
    manifest.counts.prohibited_direct_inferences !== 20 ||
    manifest.counts.visible_hidden_allowed_statements !== 3
  ) {
    failIntegrity();
  }
  const descriptor = manifest.asset;
  if (
    typeof descriptor.path !== "string" ||
    typeof descriptor.sha256 !== "string" ||
    typeof descriptor.byte_size !== "number"
  ) {
    failIntegrity();
  }
  const assetFile = await readVerifiedJson(fetchImpl, descriptor.path, descriptor.sha256);
  if (assetFile.bytes !== descriptor.byte_size) failIntegrity();
  const data = parseBaziInterpretationProtocolAsset(
    assetFile.value,
    BAZI_INTERPRETATION_BROWSER_MANIFEST_SHA256,
  );
  return deepFreeze({
    data,
    loadedBytes: manifestFile.bytes + assetFile.bytes,
    loadedAssetPaths: [BAZI_INTERPRETATION_BROWSER_MANIFEST_PATH, descriptor.path],
  });
}

const loadCache = new WeakMap<InterpretationBrowserFetch, Promise<InterpretationBrowserLoadResult>>();

export function loadBaziInterpretationBrowserData(
  fetchImpl: InterpretationBrowserFetch = defaultInterpretationBrowserFetch,
): Promise<InterpretationBrowserLoadResult> {
  const cached = loadCache.get(fetchImpl);
  if (cached) return cached;
  const pending = loadUncached(fetchImpl);
  loadCache.set(fetchImpl, pending);
  void pending.catch(() => {
    if (loadCache.get(fetchImpl) === pending) loadCache.delete(fetchImpl);
  });
  return pending;
}
