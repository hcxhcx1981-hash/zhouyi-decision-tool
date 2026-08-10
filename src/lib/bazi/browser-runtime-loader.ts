import type {
  BaziBrowserRuntimeManifest,
  BrowserAssetDescriptor,
  BrowserFetchImpl,
  BrowserSolarIndex,
  BrowserTimezoneIndex,
  LoadedBrowserPipelineData,
} from "./browser-runtime-types";
import type { BaziCoreData, BaziSolarTermRecord } from "./runtime-types";
import type { FrozenLocationRegistry, LoadedLocationData, RawBaziDeterministicInput } from "./location-runtime-types";
import type { FrozenTimezoneDataset, FrozenTimezoneZone, LoadedTimezoneData } from "./timezone-runtime-types";

export const BAZI_BROWSER_RUNTIME_MANIFEST_PATH = "/bazi-runtime/v0.1/manifest.json";
export const BAZI_BROWSER_RUNTIME_MANIFEST_SHA256 = "e82314a64b914f278ba2c4772504b4cb51d44e925b001b85517515fc25868e5c";

function isSafeAssetPath(path: string): boolean {
  return /^\/bazi-runtime\/v0\.1\/[a-zA-Z0-9._/-]+\.json$/.test(path) && !path.includes("..") && !path.includes("//");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", stableBytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class BaziBrowserRuntimeLoader {
  readonly #fetchImpl: BrowserFetchImpl;
  readonly #cache = new Map<string, Promise<unknown>>();
  readonly #loadedPaths: string[] = [];
  #loadedBytes = 0;

  constructor(fetchImpl: BrowserFetchImpl) {
    this.#fetchImpl = fetchImpl;
  }

  async #loadJson<T>(descriptor: BrowserAssetDescriptor): Promise<T> {
    if (!isSafeAssetPath(descriptor.path)) throw new Error("BROWSER_RUNTIME_UNSAFE_ASSET_PATH");
    const cached = this.#cache.get(descriptor.path);
    if (cached) return cached as Promise<T>;
    const pending = (async () => {
      const response = await this.#fetchImpl(descriptor.path);
      if (!response.ok) throw new Error(`BROWSER_RUNTIME_ASSET_HTTP_${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== descriptor.byte_size || await sha256(bytes) !== descriptor.sha256) {
        throw new Error("BROWSER_RUNTIME_ASSET_INTEGRITY_ERROR");
      }
      this.#loadedPaths.push(descriptor.path);
      this.#loadedBytes += bytes.byteLength;
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    })();
    this.#cache.set(descriptor.path, pending);
    return pending;
  }

  async #manifest(): Promise<BaziBrowserRuntimeManifest> {
    const response = await this.#fetchImpl(BAZI_BROWSER_RUNTIME_MANIFEST_PATH);
    if (!response.ok) throw new Error(`BROWSER_RUNTIME_MANIFEST_HTTP_${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256(bytes) !== BAZI_BROWSER_RUNTIME_MANIFEST_SHA256) {
      throw new Error("BROWSER_RUNTIME_MANIFEST_INTEGRITY_ERROR");
    }
    this.#loadedPaths.push(BAZI_BROWSER_RUNTIME_MANIFEST_PATH);
    this.#loadedBytes += bytes.byteLength;
    const manifest = JSON.parse(new TextDecoder().decode(bytes)) as BaziBrowserRuntimeManifest;
    if (manifest.runtime_asset_version !== "0.1" || manifest.status !== "DERIVED_RUNTIME_ASSETS") {
      throw new Error("BROWSER_RUNTIME_MANIFEST_VERSION_ERROR");
    }
    return manifest;
  }

  async loadForInput(input: RawBaziDeterministicInput): Promise<LoadedBrowserPipelineData> {
    const manifest = await this.#manifest();
    const [registry, timezoneIndex, solarIndex] = await Promise.all([
      this.#loadJson<FrozenLocationRegistry>(manifest.location_asset),
      this.#loadJson<BrowserTimezoneIndex>(manifest.timezone_index_asset),
      this.#loadJson<BrowserSolarIndex>(manifest.solar_index_asset),
    ]);
    if (
      registry.registry_id !== manifest.location_registry_id ||
      timezoneIndex.dataset_id !== manifest.timezone_dataset_id ||
      timezoneIndex.source_dataset_sha256 !== manifest.timezone_dataset_sha256 ||
      solarIndex.dataset_id !== manifest.solar_dataset_id ||
      solarIndex.source_dataset_sha256 !== manifest.solar_dataset_sha256
    ) throw new Error("BROWSER_RUNTIME_SOURCE_BINDING_ERROR");

    const allLocations = [...registry.iana_zone_directory, ...registry.product_registered_locations];
    const locationsById = new Map(allLocations.map((entry) => [entry.location_id, entry]));
    const locationData: LoadedLocationData = Object.freeze({ registry: Object.freeze(registry), registrySha256: manifest.location_registry_sha256, locationsById });

    let requestedZone: string | null = null;
    if (input.locationSelection.mode === "REGISTERED_LOCATION") {
      requestedZone = input.locationSelection.locationId ? locationsById.get(input.locationSelection.locationId)?.zone_id ?? null : null;
    } else {
      requestedZone = input.locationSelection.claimedIanaTimezone;
    }
    const timezoneById = new Map(timezoneIndex.zones.map((entry) => [entry.zone_id, entry]));
    const zoneDescriptor = requestedZone ? timezoneById.get(requestedZone) : undefined;
    const loadedZones: FrozenTimezoneZone[] = [];
    if (zoneDescriptor) {
      const zone = await this.#loadJson<FrozenTimezoneZone & { source_dataset_sha256: string }>(zoneDescriptor);
      if (zone.zone_id !== zoneDescriptor.zone_id || zone.source_dataset_sha256 !== manifest.timezone_dataset_sha256) {
        throw new Error("BROWSER_RUNTIME_TIMEZONE_CHUNK_BINDING_ERROR");
      }
      loadedZones.push(zone);
    }
    const timezoneDataset: FrozenTimezoneDataset = {
      dataset_id: timezoneIndex.dataset_id,
      version: timezoneIndex.version,
      status: "FROZEN_RUNTIME_DATA",
      iana_release: timezoneIndex.iana_release,
      python_tzdata_version: timezoneIndex.python_tzdata_version,
      coverage: timezoneIndex.coverage,
      zone_count: timezoneIndex.source_zone_count,
      transition_count: timezoneIndex.source_transition_count,
      special_behavior_evidence: timezoneIndex.special_behavior_evidence,
      zones: loadedZones,
    };
    const timezoneData: LoadedTimezoneData = Object.freeze({
      dataset: Object.freeze(timezoneDataset),
      datasetSha256: manifest.timezone_dataset_sha256,
      zonesById: new Map(loadedZones.map((zone) => [zone.zone_id, zone])),
    });

    const year = Number(input.localDate.slice(0, 4));
    const solarByYear = new Map(solarIndex.years.map((entry) => [entry.year, entry]));
    const solarTerms: BaziSolarTermRecord[] = [];
    if (Number.isInteger(year)) {
      for (const neededYear of [year - 1, year, year + 1]) {
        const descriptor = solarByYear.get(neededYear);
        if (!descriptor) continue;
        const chunk = await this.#loadJson<{ year: number; record_count: number; source_dataset_sha256: string; records: BaziSolarTermRecord[] }>(descriptor);
        if (chunk.year !== neededYear || chunk.record_count !== 24 || chunk.records.length !== 24 || chunk.source_dataset_sha256 !== manifest.solar_dataset_sha256) {
          throw new Error("BROWSER_RUNTIME_SOLAR_CHUNK_BINDING_ERROR");
        }
        solarTerms.push(...chunk.records);
      }
    }
    const baziData: BaziCoreData = Object.freeze({
      rulesProtocolId: manifest.bazi_rules_protocol_id,
      rulesVersion: manifest.bazi_rules_version,
      datasetId: solarIndex.dataset_id,
      datasetVersion: solarIndex.version,
      datasetSha256: manifest.solar_dataset_sha256,
      solarTerms: Object.freeze(solarTerms),
    });
    return {
      data: { locationData, timezoneData, baziData },
      loadedAssetPaths: Object.freeze([...this.#loadedPaths]),
      loadedBytes: this.#loadedBytes,
    };
  }
}
