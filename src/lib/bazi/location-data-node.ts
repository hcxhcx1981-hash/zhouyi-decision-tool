import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrozenLocationRegistry, LoadedLocationData } from "./location-runtime-types";

const REGISTRY_SHA256 = "1635c8cf0c64bf30169027feea073cf6b7d5fa3bfec9828961752cbcc620cb94";
const REGISTRY_FILE = "iana_location_registry_2026c_v0.1.0.json";
const MANIFEST_FILE = "BAZI_LOCATION_MANIFEST_V0.1.0.json";
const DEFAULT_PROJECT_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function loadFrozenLocationData(projectRoot = DEFAULT_PROJECT_ROOT): LoadedLocationData {
  const directory = resolve(projectRoot, "data", "frozen", "bazi_location");
  const registryBytes = readFileSync(resolve(directory, REGISTRY_FILE));
  const manifestBytes = readFileSync(resolve(directory, MANIFEST_FILE));
  const registrySha256 = digest(registryBytes);
  const registry = JSON.parse(registryBytes.toString("utf8")) as FrozenLocationRegistry;
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Record<string, unknown>;
  const sums = new Map(
    readFileSync(resolve(directory, "SHA256SUMS.txt"), "ascii").trim().split(/\r?\n/).map((line) => {
      const [hash, filename] = line.split(/\s+/, 2);
      return [filename, hash];
    }),
  );
  if (
    registrySha256 !== REGISTRY_SHA256 ||
    sums.get(REGISTRY_FILE) !== registrySha256 ||
    sums.get(MANIFEST_FILE) !== digest(manifestBytes) ||
    manifest.registry_sha256 !== registrySha256 ||
    registry.registry_id !== "BAZI_IANA_LOCATION_REGISTRY_2026C_V0_1_0" ||
    registry.version !== "0.1.0" ||
    registry.status !== "FROZEN_RUNTIME_DATA" ||
    registry.iana_release !== "2026c" ||
    registry.python_tzdata_version !== "2026.3" ||
    registry.iana_zone1970_entry_count !== registry.iana_zone_directory.length ||
    registry.product_registered_count !== 4 ||
    registry.product_registered_locations.length !== 4 ||
    registry.total_entry_count !== registry.iana_zone_directory.length + registry.product_registered_locations.length
  ) {
    throw new Error("BAZI_LOCATION_FROZEN_DATA_INTEGRITY_ERROR");
  }
  const allEntries = [...registry.iana_zone_directory, ...registry.product_registered_locations];
  const locationsById = new Map(allEntries.map((entry) => [entry.location_id, entry]));
  if (locationsById.size !== registry.total_entry_count) {
    throw new Error("BAZI_LOCATION_DUPLICATE_LOCATION_ID");
  }
  return Object.freeze({ registry: Object.freeze(registry), registrySha256, locationsById });
}
