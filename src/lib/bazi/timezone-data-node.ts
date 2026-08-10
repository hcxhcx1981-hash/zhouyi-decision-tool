import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrozenTimezoneDataset, LoadedTimezoneData } from "./timezone-runtime-types";

const DATASET_SHA256 = "a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2";
const DEFAULT_PROJECT_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function loadFrozenTimezoneData(projectRoot = DEFAULT_PROJECT_ROOT): LoadedTimezoneData {
  const directory = resolve(projectRoot, "data", "frozen", "bazi_timezone");
  const datasetPath = resolve(directory, "iana_tzdb_2026c_v0.1.0.json");
  const manifestPath = resolve(directory, "BAZI_TIMEZONE_MANIFEST_V0.1.0.json");
  const sumsPath = resolve(directory, "SHA256SUMS.txt");
  const datasetBytes = readFileSync(datasetPath);
  const manifestBytes = readFileSync(manifestPath);
  const datasetSha256 = digest(datasetBytes);
  const manifestSha256 = digest(manifestBytes);
  const dataset = JSON.parse(datasetBytes.toString("utf8")) as FrozenTimezoneDataset;
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Record<string, unknown>;
  const sums = new Map(
    readFileSync(sumsPath, "ascii").trim().split(/\r?\n/).map((line) => {
      const [hash, filename] = line.split(/\s+/, 2);
      return [filename, hash];
    }),
  );

  if (
    datasetSha256 !== DATASET_SHA256 ||
    sums.get("iana_tzdb_2026c_v0.1.0.json") !== datasetSha256 ||
    sums.get("BAZI_TIMEZONE_MANIFEST_V0.1.0.json") !== manifestSha256 ||
    manifest.data_sha256 !== datasetSha256 ||
    dataset.dataset_id !== "BAZI_IANA_TZDB_2026C_V0_1_0" ||
    dataset.version !== "0.1.0" ||
    dataset.status !== "FROZEN_RUNTIME_DATA" ||
    dataset.iana_release !== "2026c" ||
    dataset.python_tzdata_version !== "2026.3" ||
    dataset.zone_count !== 598 ||
    dataset.zones.length !== 598 ||
    dataset.transition_count !== 55642
  ) {
    throw new Error("BAZI_TIMEZONE_FROZEN_DATA_INTEGRITY_ERROR");
  }

  const zonesById = new Map(dataset.zones.map((zone) => [zone.zone_id, zone]));
  if (zonesById.size !== dataset.zone_count) {
    throw new Error("BAZI_TIMEZONE_DUPLICATE_ZONE_ID");
  }
  return Object.freeze({ dataset: Object.freeze(dataset), datasetSha256, zonesById });
}
