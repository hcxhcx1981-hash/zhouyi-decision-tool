import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BaziFoundationData } from "./foundation-runtime-types.ts";

const FROZEN_SHA256 = "de157cf196f766cb919cded0d016087714328e248ad407d9d092b418eeb8e299";
const MANIFEST_SHA256 = "ecb9b0eb330b11252329f16bdaa8edcc8251f8186bdaa6ee241fb87547fa348a";
const DEFAULT_PROJECT_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

interface JsonFile {
  value: Record<string, unknown>;
  sha256: string;
}

function readJson(path: string): JsonFile {
  const bytes = readFileSync(path);
  return {
    value: JSON.parse(bytes.toString("utf-8")) as Record<string, unknown>,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
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

function failIntegrity(): never {
  throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
}

export function loadFrozenBaziFoundationData(
  projectRoot = DEFAULT_PROJECT_ROOT,
): BaziFoundationData {
  const directory = resolve(projectRoot, "data", "frozen", "bazi_foundation");
  const frozen = readJson(resolve(directory, "bazi_foundation_rules_v0.2.0.json"));
  const manifest = readJson(resolve(directory, "BAZI_FOUNDATION_MANIFEST_V0.2.0.json"));
  const value = frozen.value;
  const manifestValue = manifest.value;

  if (
    frozen.sha256 !== FROZEN_SHA256 ||
    manifest.sha256 !== MANIFEST_SHA256 ||
    value.dataset_id !== "BAZI_FOUNDATION_RULES_V0_2_0" ||
    value.version !== "0.2.0" ||
    value.status !== "FROZEN_RUNTIME_DATA" ||
    value.tradition_scope !== "ZIPING_BAZI" ||
    manifestValue.dataset_id !== "BAZI_FOUNDATION_MANIFEST_V0_2_0" ||
    manifestValue.version !== "0.2.0" ||
    manifestValue.status !== "FROZEN" ||
    manifestValue.tradition_scope !== "ZIPING_BAZI" ||
    manifestValue.frozen_rules_sha256 !== frozen.sha256 ||
    !Array.isArray(value.heavenly_stems) ||
    !Array.isArray(value.earthly_branches) ||
    !Array.isArray(value.hidden_stem_sets) ||
    typeof value.five_element_relations !== "object" ||
    value.five_element_relations === null ||
    typeof value.ten_god_formula !== "object" ||
    value.ten_god_formula === null ||
    !Array.isArray(value.ten_god_canonical_names)
  ) {
    failIntegrity();
  }

  const rawRelations = value.five_element_relations as Record<string, unknown>;
  if (!Array.isArray(rawRelations.generates) || !Array.isArray(rawRelations.controls)) {
    failIntegrity();
  }

  const data = {
    datasetId: value.dataset_id,
    version: value.version,
    status: value.status,
    traditionScope: value.tradition_scope,
    frozenSha256: frozen.sha256,
    manifestSha256: manifest.sha256,
    heavenlyStems: (value.heavenly_stems as Array<Record<string, unknown>>).map((stem) => ({
      stemId: stem.stem_id,
      chinese: stem.chinese,
      yinYang: stem.yin_yang,
      element: stem.element,
    })),
    earthlyBranches: (value.earthly_branches as Array<Record<string, unknown>>).map((branch) => ({
      branchId: branch.branch_id,
      chinese: branch.chinese,
      yinYang: branch.yin_yang,
      element: branch.element,
    })),
    hiddenStemSets: (value.hidden_stem_sets as Array<Record<string, unknown>>).map((entry) => ({
      branchId: entry.branch_id,
      hiddenStemSet: entry.hidden_stem_set,
      orderSemantics: entry.order_semantics,
    })),
    fiveElementRelations: {
      generates: rawRelations.generates,
      controls: rawRelations.controls,
    },
    tenGodFormula: value.ten_god_formula,
    tenGodCanonicalNames: value.ten_god_canonical_names,
  } as BaziFoundationData;

  return deepFreeze(data);
}
