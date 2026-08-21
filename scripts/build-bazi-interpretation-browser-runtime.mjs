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
const defaultOutput = join(root, "public", "bazi-interpretation-runtime", "v0.1.0");
const frozenPath = join(
  root,
  "data",
  "frozen",
  "bazi_interpretation",
  "bazi_interpretation_protocol_v0.1.0.json",
);
const expectedFrozenSha = "084de621127eb4307f025d39a5ef9a7770c2b935a3d70dac872ac6e08ccbac34";
const assetName = "bazi-interpretation-protocol-v0.1.0.json";
const manifestName = "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0.1.0.json";
const safeTerms = ["日主", "七杀", "伤官", "正官", "正印", "食神", "正财"];
const factOnlyTerms = ["比肩", "劫财", "偏财", "偏印"];
const gateNames = [
  "FACT_ONLY",
  "SAFE_SEMANTIC_GLOSS",
  "CONTEXT_REQUIRED",
  "PROHIBITED_DIRECT_INFERENCE",
];

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

function sameMembers(values, expected) {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function validateFrozenSource(frozen) {
  if (
    frozen.schema_version !== "0.1.0" ||
    frozen.version !== "0.1.0" ||
    frozen.status !== "FROZEN_RUNTIME_DATA" ||
    frozen.tradition_scope !== "ZIPING_BAZI"
  ) {
    throw new Error("INTERPRETATION_FROZEN_METADATA_MISMATCH");
  }
  if (
    !Array.isArray(frozen.safe_glosses) ||
    !sameMembers(frozen.safe_glosses.map((entry) => entry.canonical_term), safeTerms) ||
    !frozen.safe_glosses.every((entry) => entry.gate === "SAFE_SEMANTIC_GLOSS")
  ) {
    throw new Error("INTERPRETATION_FROZEN_SAFE_GLOSS_MISMATCH");
  }
  if (
    !Array.isArray(frozen.fact_only_terms) ||
    !sameMembers(frozen.fact_only_terms.map((entry) => entry.canonical_term), factOnlyTerms) ||
    !frozen.fact_only_terms.every(
      (entry) => entry.gate === "FACT_ONLY" && entry.safe_gloss_available === false,
    )
  ) {
    throw new Error("INTERPRETATION_FROZEN_FACT_ONLY_MISMATCH");
  }
  if (
    !frozen.interpretation_gates ||
    !sameMembers(Object.keys(frozen.interpretation_gates), gateNames) ||
    frozen.count_policy?.policy_id !== "COUNT_ONLY_IS_NOT_INTERPRETATION" ||
    frozen.count_policy?.gate !== "FACT_ONLY" ||
    frozen.visible_hidden_policy?.gate !== "FACT_ONLY" ||
    frozen.visible_hidden_policy?.allowed_statements?.length !== 3 ||
    frozen.prohibited_direct_inferences?.length !== 20 ||
    frozen.context_required_topics?.length !== 8 ||
    frozen.known_limitations?.length !== 3
  ) {
    throw new Error("INTERPRETATION_FROZEN_POLICY_MISMATCH");
  }
}

export function buildBaziInterpretationBrowserRuntime(destination = defaultOutput) {
  const frozenBytes = readFileSync(frozenPath);
  const frozenSha = digest(frozenBytes);
  if (frozenSha !== expectedFrozenSha) throw new Error("INTERPRETATION_FROZEN_SHA_MISMATCH");
  const frozen = JSON.parse(frozenBytes.toString("utf8"));
  validateFrozenSource(frozen);

  const browserAsset = {
    dataset_id: "BAZI_INTERPRETATION_BROWSER_RUNTIME_V0_1_0",
    schema_version: frozen.schema_version,
    version: frozen.version,
    status: "DERIVED_BROWSER_RUNTIME_ASSET",
    tradition_scope: frozen.tradition_scope,
    source_frozen_sha256: frozenSha,
    safe_glosses: frozen.safe_glosses,
    fact_only_terms: frozen.fact_only_terms,
    interpretation_gates: frozen.interpretation_gates,
    count_policy: frozen.count_policy,
    visible_hidden_policy: frozen.visible_hidden_policy,
    prohibited_direct_inferences: frozen.prohibited_direct_inferences,
    context_required_topics: frozen.context_required_topics,
    known_limitations: frozen.known_limitations,
  };
  const assetBytes = stableBytes(browserAsset);
  const assetDescriptor = {
    path: `/bazi-interpretation-runtime/v0.1.0/${assetName}`,
    sha256: digest(assetBytes),
    byte_size: assetBytes.length,
  };
  const manifest = {
    dataset_id: "BAZI_INTERPRETATION_BROWSER_MANIFEST_V0_1_0",
    version: frozen.version,
    status: "DERIVED_BROWSER_RUNTIME_MANIFEST",
    tradition_scope: frozen.tradition_scope,
    source_frozen_sha256: frozenSha,
    asset: assetDescriptor,
    counts: {
      safe_glosses: frozen.safe_glosses.length,
      fact_only_terms: frozen.fact_only_terms.length,
      interpretation_gates: Object.keys(frozen.interpretation_gates).length,
      prohibited_direct_inferences: frozen.prohibited_direct_inferences.length,
      visible_hidden_allowed_statements: frozen.visible_hidden_policy.allowed_statements.length,
    },
    generation_policy: {
      frozen_protocol_is_single_source_of_truth: true,
      deterministic_json: true,
      research_content_included: false,
      network_sources: false,
      user_data: false,
    },
  };
  const manifestBytes = stableBytes(manifest);

  mkdirSync(dirname(destination), { recursive: true });
  const tempRoot = mkdtempSync(join(dirname(destination), ".bazi-interpretation-v0.1.0-"));
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
  const summary = buildBaziInterpretationBrowserRuntime(outputArgument());
  for (const [key, value] of Object.entries(summary)) console.log(`${key.toUpperCase()}=${value}`);
}
