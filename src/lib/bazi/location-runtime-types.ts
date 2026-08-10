import type { BaziCoreResult, BaziCaseScope } from "./runtime-types";
import type { BaziTimezoneNormalizationResult, LoadedTimezoneData, LocationTimezoneStatus } from "./timezone-runtime-types";

export type LocationSelectionMode = "REGISTERED_LOCATION" | "MANUAL_IANA";

export interface RawLocationSelection {
  mode: LocationSelectionMode;
  locationId: string | null;
  locationName: string | null;
  claimedIanaTimezone: string | null;
}

export interface FrozenIanaLocationEntry {
  location_id: string;
  zone_id: string;
  country_codes: readonly string[];
  coordinates_raw: string;
  latitude: number;
  longitude: number;
  comment: string;
  source_kind: "IANA_ZONE1970";
}

export interface FrozenProductLocationEntry {
  location_id: string;
  zone_id: string;
  mapping_class: "FROZEN_PRODUCT_LOCATION_POLICY" | "FROZEN_TEST_AND_PRODUCT_MAPPING";
  source_kind: "PRODUCT_REGISTERED_LOCATION";
}

export interface FrozenLocationRegistry {
  registry_id: string;
  version: string;
  status: "FROZEN_RUNTIME_DATA";
  iana_release: string;
  python_tzdata_version: string;
  wheel_sha256: string;
  country_count: number;
  iana_zone1970_entry_count: number;
  product_registered_count: number;
  total_entry_count: number;
  iana_zone_directory: readonly FrozenIanaLocationEntry[];
  product_registered_locations: readonly FrozenProductLocationEntry[];
}

export type FrozenRegisteredLocation = FrozenIanaLocationEntry | FrozenProductLocationEntry;

export interface LoadedLocationData {
  registry: FrozenLocationRegistry;
  registrySha256: string;
  locationsById: ReadonlyMap<string, FrozenRegisteredLocation>;
}

export interface ResolvedLocationBinding {
  locationId: string | null;
  locationName: string | null;
  ianaTimezone: string | null;
  locationTimezoneStatus: LocationTimezoneStatus;
  registryId: string;
  registryVersion: string;
  selectionMode: LocationSelectionMode;
  sourceKind: string;
}

export interface RawBaziDeterministicInput {
  calendarType: "GREGORIAN" | "LUNAR";
  caseScope: BaziCaseScope;
  localDate: string;
  localTime: string | null;
  timeKnown: boolean;
  foldChoice: "EARLIER" | "LATER" | null;
  referenceInstantUtc: string;
  locationSelection: RawLocationSelection;
}

export interface BaziLocationAudit {
  locationRegistryId: string;
  locationRegistryVersion: string;
  locationSelectionMode: LocationSelectionMode;
  locationId: string | null;
  locationName: string | null;
  locationTimezoneStatus: LocationTimezoneStatus;
  resolvedIanaTimezone: string | null;
  sourceKind: string;
}

export interface BaziDeterministicPipelineResult {
  locationAudit: BaziLocationAudit;
  timezoneAudit: BaziTimezoneNormalizationResult;
  coreResult: BaziCoreResult;
}

export interface BaziDeterministicPipelineData {
  locationData: LoadedLocationData;
  timezoneData: LoadedTimezoneData;
  baziData: Parameters<typeof import("./pillar-core").calculateBaziPillars>[1];
}
