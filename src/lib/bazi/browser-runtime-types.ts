import type { BaziDeterministicPipelineData, RawBaziDeterministicInput } from "./location-runtime-types";

export interface BrowserAssetDescriptor {
  path: string;
  sha256: string;
  byte_size: number;
}

export interface BaziBrowserRuntimeManifest {
  runtime_asset_version: "0.1";
  status: "DERIVED_RUNTIME_ASSETS";
  bazi_rules_protocol_id: string;
  bazi_rules_version: string;
  bazi_rules_sha256: string;
  solar_dataset_id: string;
  solar_dataset_sha256: string;
  timezone_dataset_id: string;
  timezone_dataset_sha256: string;
  location_registry_id: string;
  location_registry_sha256: string;
  generated_from_commit: string;
  location_asset: BrowserAssetDescriptor;
  timezone_index_asset: BrowserAssetDescriptor;
  solar_index_asset: BrowserAssetDescriptor;
}

export interface BrowserTimezoneIndexEntry extends BrowserAssetDescriptor {
  zone_id: string;
}

export interface BrowserTimezoneIndex {
  dataset_id: string;
  version: string;
  source_dataset_sha256: string;
  iana_release: string;
  python_tzdata_version: string;
  coverage: { start_utc: string; end_utc_exclusive: string };
  timestamp_resolution: string;
  source_zone_count: number;
  source_transition_count: number;
  special_behavior_evidence: {
    international_date_line_jump: { zone_id: string; instant_utc: string; offset_change_seconds: number };
  };
  zones: readonly BrowserTimezoneIndexEntry[];
}

export interface BrowserSolarIndexEntry extends BrowserAssetDescriptor {
  year: number;
}

export interface BrowserSolarIndex {
  dataset_id: string;
  version: string;
  source_dataset_sha256: string;
  source_record_count: number;
  years: readonly BrowserSolarIndexEntry[];
}

export interface BrowserFetchResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type BrowserFetchImpl = (path: string) => Promise<BrowserFetchResponse>;

export interface LoadedBrowserPipelineData {
  data: BaziDeterministicPipelineData;
  loadedAssetPaths: readonly string[];
  loadedBytes: number;
}

export interface BrowserPipelineLoadRequest {
  input: RawBaziDeterministicInput;
}
