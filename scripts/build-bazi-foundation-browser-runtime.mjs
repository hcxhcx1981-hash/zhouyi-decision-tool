import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const defaultOutput = join(root, "public", "bazi-foundation-runtime", "v0.2.0");
const frozenPath = join(
  root,
  "data",
  "frozen",
  "bazi_foundation",
  "bazi_foundation_rules_v0.2.0.json",
);
const expectedFrozenSha = "de157cf196f766cb919cded0d016087714328e248ad407d9d092b418eeb8e299";
const assetName = "bazi-foundation-browser-v0.2.0.json";
const manifestName = "BAZI_FOUNDATION_BROWSER_MANIFEST_V0.2.0.json";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function outputArgument() {
  const index = process.argv.indexOf("--output");
  if (index === -1) return defaultOutput;
  if (!process.argv[index + 1]) throw new Error("OUTPUT_PATH_REQUIRED");
  return resolve(process.argv[index + 1]);
}

function replaceAtomically(tempRoot, destination) {
  const backup = `${destination}.previous`;
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  if (!existsSync(destination)) {
    renameSync(tempRoot, destination);
    return;
  }
  renameSync(destination, backup);
  try {
    renameSync(tempRoot, destination);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
    renameSync(backup, destination);
    throw error;
  }
}

export function buildBaziFoundationBrowserRuntime(destination = defaultOutput) {
  const frozenBytes = readFileSync(frozenPath);
  const frozenSha = digest(frozenBytes);
  if (frozenSha !== expectedFrozenSha) throw new Error("FOUNDATION_FROZEN_SHA_MISMATCH");
  const frozen = JSON.parse(frozenBytes.toString("utf8"));
  if (
    frozen.dataset_id !== "BAZI_FOUNDATION_RULES_V0_2_0" ||
    frozen.version !== "0.2.0" ||
    frozen.status !== "FROZEN_RUNTIME_DATA" ||
    frozen.tradition_scope !== "ZIPING_BAZI"
  ) {
    throw new Error("FOUNDATION_FROZEN_METADATA_MISMATCH");
  }

  const browserAsset = {
    dataset_id: "BAZI_FOUNDATION_BROWSER_RUNTIME_V0_2_0",
    version: frozen.version,
    status: "DERIVED_BROWSER_RUNTIME_ASSET",
    tradition_scope: frozen.tradition_scope,
    source_dataset_id: frozen.dataset_id,
    source_frozen_sha256: frozenSha,
    heavenly_stems: frozen.heavenly_stems,
    earthly_branches: frozen.earthly_branches,
    hidden_stem_sets: frozen.hidden_stem_sets,
    five_element_relations: frozen.five_element_relations,
    ten_god_formula: frozen.ten_god_formula,
    ten_god_canonical_names: frozen.ten_god_canonical_names,
  };
  const assetBytes = stableBytes(browserAsset);
  const assetDescriptor = {
    path: `/bazi-foundation-runtime/v0.2.0/${assetName}`,
    sha256: digest(assetBytes),
    byte_size: assetBytes.length,
  };
  const manifest = {
    dataset_id: "BAZI_FOUNDATION_BROWSER_MANIFEST_V0_2_0",
    version: "0.2.0",
    status: "DERIVED_BROWSER_RUNTIME_MANIFEST",
    tradition_scope: frozen.tradition_scope,
    source_dataset_id: frozen.dataset_id,
    source_frozen_sha256: frozenSha,
    asset: assetDescriptor,
    generation_policy: {
      frozen_asset_is_single_source_of_truth: true,
      deterministic_json: true,
      hidden_stem_order_semantics: "NONE",
      ten_god_formula_not_matrix: true,
      network_sources: false,
    },
  };
  const manifestBytes = stableBytes(manifest);

  mkdirSync(dirname(destination), { recursive: true });
  const tempRoot = mkdtempSync(join(dirname(destination), ".bazi-foundation-v0.2.0-"));
  try {
    writeFileSync(join(tempRoot, assetName), assetBytes);
    writeFileSync(join(tempRoot, manifestName), manifestBytes);
    replaceAtomically(tempRoot, destination);
  } catch (error) {
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    output: destination,
    file_count: 2,
    asset_sha256: assetDescriptor.sha256,
    manifest_sha256: digest(manifestBytes),
    asset_bytes: assetBytes.length,
    manifest_bytes: manifestBytes.length,
    total_bytes: assetBytes.length + manifestBytes.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const summary = buildBaziFoundationBrowserRuntime(outputArgument());
  for (const [key, value] of Object.entries(summary)) console.log(`${key.toUpperCase()}=${value}`);
}
