import type { BaziFoundationData } from "../bazi/foundation-runtime-types.ts";

export const BAZI_FOUNDATION_BROWSER_MANIFEST_PATH =
  "/bazi-foundation-runtime/v0.2.0/BAZI_FOUNDATION_BROWSER_MANIFEST_V0.2.0.json";
export const BAZI_FOUNDATION_BROWSER_MANIFEST_SHA256 =
  "7a7d7a2f607d365f337b0f6a3007dfcf8e68eece0fe5817b1c6c349573a08140";

const RUNTIME_PREFIX = "/bazi-foundation-runtime/v0.2.0/";

export interface FoundationBrowserFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FoundationBrowserFetch = (
  path: string,
) => Promise<FoundationBrowserFetchResponse>;

export interface FoundationBrowserLoadResult {
  readonly data: BaziFoundationData;
  readonly loadedBytes: number;
  readonly loadedAssetPaths: readonly string[];
}

function failIntegrity(): never {
  throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
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
  fetchImpl: FoundationBrowserFetch,
  path: string,
  expectedSha256: string,
): Promise<{ value: Record<string, unknown>; bytes: number }> {
  if (!safeRuntimePath(path)) failIntegrity();
  const response = await fetchImpl(path);
  if (!response.ok) throw new Error(`FOUNDATION_BROWSER_ASSET_HTTP_${response.status}`);
  const buffer = await response.arrayBuffer();
  if ((await digest(buffer)) !== expectedSha256) failIntegrity();
  try {
    return {
      value: JSON.parse(new TextDecoder().decode(buffer)) as Record<string, unknown>,
      bytes: buffer.byteLength,
    };
  } catch {
    failIntegrity();
  }
}

export const defaultFoundationBrowserFetch: FoundationBrowserFetch = async (path) => {
  if (!safeRuntimePath(path)) failIntegrity();
  return fetch(path, { cache: "force-cache" });
};

export async function loadBaziFoundationBrowserData(
  fetchImpl: FoundationBrowserFetch = defaultFoundationBrowserFetch,
): Promise<FoundationBrowserLoadResult> {
  const manifestFile = await readVerifiedJson(
    fetchImpl,
    BAZI_FOUNDATION_BROWSER_MANIFEST_PATH,
    BAZI_FOUNDATION_BROWSER_MANIFEST_SHA256,
  );
  const manifest = manifestFile.value;
  if (
    manifest.dataset_id !== "BAZI_FOUNDATION_BROWSER_MANIFEST_V0_2_0" ||
    manifest.version !== "0.2.0" ||
    manifest.status !== "DERIVED_BROWSER_RUNTIME_MANIFEST" ||
    manifest.tradition_scope !== "ZIPING_BAZI" ||
    manifest.source_dataset_id !== "BAZI_FOUNDATION_RULES_V0_2_0" ||
    typeof manifest.asset !== "object" ||
    manifest.asset === null
  ) {
    failIntegrity();
  }
  const descriptor = manifest.asset as Record<string, unknown>;
  if (
    typeof descriptor.path !== "string" ||
    typeof descriptor.sha256 !== "string" ||
    typeof descriptor.byte_size !== "number"
  ) {
    failIntegrity();
  }
  const assetFile = await readVerifiedJson(fetchImpl, descriptor.path, descriptor.sha256);
  if (assetFile.bytes !== descriptor.byte_size) failIntegrity();
  const asset = assetFile.value;
  const relations = asset.five_element_relations as Record<string, unknown> | undefined;
  const formula = asset.ten_god_formula as Record<string, unknown> | undefined;
  if (
    asset.dataset_id !== "BAZI_FOUNDATION_BROWSER_RUNTIME_V0_2_0" ||
    asset.version !== "0.2.0" ||
    asset.status !== "DERIVED_BROWSER_RUNTIME_ASSET" ||
    asset.tradition_scope !== "ZIPING_BAZI" ||
    asset.source_dataset_id !== "BAZI_FOUNDATION_RULES_V0_2_0" ||
    asset.source_frozen_sha256 !== manifest.source_frozen_sha256 ||
    !Array.isArray(asset.heavenly_stems) ||
    asset.heavenly_stems.length !== 10 ||
    !Array.isArray(asset.earthly_branches) ||
    asset.earthly_branches.length !== 12 ||
    !Array.isArray(asset.hidden_stem_sets) ||
    asset.hidden_stem_sets.length !== 12 ||
    !relations ||
    !Array.isArray(relations.generates) ||
    relations.generates.length !== 5 ||
    !Array.isArray(relations.controls) ||
    relations.controls.length !== 5 ||
    !formula ||
    Object.keys(formula).length !== 5 ||
    !Array.isArray(asset.ten_god_canonical_names) ||
    asset.ten_god_canonical_names.length !== 10
  ) {
    failIntegrity();
  }

  const data = {
    datasetId: asset.source_dataset_id,
    version: asset.version,
    status: "FROZEN_RUNTIME_DATA",
    traditionScope: asset.tradition_scope,
    frozenSha256: asset.source_frozen_sha256,
    manifestSha256: BAZI_FOUNDATION_BROWSER_MANIFEST_SHA256,
    heavenlyStems: (asset.heavenly_stems as Array<Record<string, unknown>>).map((stem) => ({
      stemId: stem.stem_id,
      chinese: stem.chinese,
      yinYang: stem.yin_yang,
      element: stem.element,
    })),
    earthlyBranches: (asset.earthly_branches as Array<Record<string, unknown>>).map((branch) => ({
      branchId: branch.branch_id,
      chinese: branch.chinese,
      yinYang: branch.yin_yang,
      element: branch.element,
    })),
    hiddenStemSets: (asset.hidden_stem_sets as Array<Record<string, unknown>>).map((entry) => ({
      branchId: entry.branch_id,
      hiddenStemSet: entry.hidden_stem_set,
      orderSemantics: entry.order_semantics,
    })),
    fiveElementRelations: {
      generates: relations.generates,
      controls: relations.controls,
    },
    tenGodFormula: formula,
    tenGodCanonicalNames: asset.ten_god_canonical_names,
  } as unknown as BaziFoundationData;

  return deepFreeze({
    data: deepFreeze(data),
    loadedBytes: manifestFile.bytes + assetFile.bytes,
    loadedAssetPaths: [BAZI_FOUNDATION_BROWSER_MANIFEST_PATH, descriptor.path],
  });
}
