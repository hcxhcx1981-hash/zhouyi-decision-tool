import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { BaziCoreData, BaziSolarTermRecord } from "./runtime-types";

const RULES_SHA256 = "bd5a534ac449c838dbdb9b49f7ac7447da2b95d35d5ba215d8d33cf965e1d9da";
const SOLAR_SHA256 = "0e22ce7738ee0aedfb15056a3888959907a2e0b88b06ed2b54bce838fc5d5ea2";
const RULES_VERSION = "0.1.1";
const DEFAULT_PROJECT_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function readJson(path: string): { value: unknown; sha256: string } {
  const bytes = readFileSync(path);
  return {
    value: JSON.parse(bytes.toString("utf-8")),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function loadFrozenBaziData(projectRoot = DEFAULT_PROJECT_ROOT): BaziCoreData {
  const directory = resolve(projectRoot, "data", "frozen", "bazi");
  const rulesFilename = `bazi_calendar_rules_v${RULES_VERSION}.json`;
  const rules = readJson(resolve(directory, rulesFilename));
  const solar = readJson(resolve(directory, "solar_terms_1969_2101_v0.1.0.json"));
  const manifest = readJson(resolve(directory, "BAZI_FROZEN_MANIFEST_V0.1.1.json"));
  const rulesValue = rules.value as Record<string, unknown>;
  const solarValue = solar.value as Record<string, unknown>;
  const manifestValue = manifest.value as Record<string, unknown>;
  const entries = manifestValue.files as Array<Record<string, unknown>>;
  const manifestHashes = new Map(entries.map((entry) => [entry.relative_path, entry.sha256]));
  const rulesPath = `data/frozen/bazi/${rulesFilename}`;
  const solarPath = "data/frozen/bazi/solar_terms_1969_2101_v0.1.0.json";

  if (
    rules.sha256 !== RULES_SHA256 ||
    solar.sha256 !== SOLAR_SHA256 ||
    manifestHashes.get(rulesPath) !== rules.sha256 ||
    manifestHashes.get(solarPath) !== solar.sha256 ||
    rulesValue.protocol_id !== "BAZI_CALENDAR_RULES_V0_1_1" ||
    rulesValue.version !== RULES_VERSION ||
    rulesValue.status !== "FROZEN" ||
    solarValue.dataset_id !== "BAZI_SOLAR_TERMS_1969_2101_V0_1_0" ||
    solarValue.version !== "0.1.0" ||
    solarValue.record_count !== 3192 ||
    !Array.isArray(solarValue.records) ||
    solarValue.records.length !== 3192
  ) {
    throw new Error("BAZI_FROZEN_DATA_INTEGRITY_ERROR");
  }

  const solarTerms = Object.freeze(
    (solarValue.records as BaziSolarTermRecord[]).map((record) => Object.freeze(record)),
  );
  return Object.freeze({
    rulesProtocolId: rulesValue.protocol_id as string,
    rulesVersion: rulesValue.version as string,
    datasetId: solarValue.dataset_id as string,
    datasetVersion: solarValue.version as string,
    datasetSha256: solar.sha256,
    solarTerms,
  });
}
